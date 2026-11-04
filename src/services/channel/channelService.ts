import * as SecureStore from 'expo-secure-store';
import { getFirebaseAIIdToken } from '../firebase/firebaseAuthService';

export const CHANNEL_API_BASE = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL?.trim()) || 'https://murshid-ai-backend.murshid-s7.workers.dev';
const ADMIN_PASSWORD_KEY = 'murshid.channel.admin-password';
const LEGACY_ADMIN_SESSION_KEY = 'murshid.channel.admin-session';
const LEGACY_ADMIN_ENABLED_KEY = 'murshid.channel.admin-enabled';

export type ChannelPost = { id: string; body: string; audio_key?: string | null; file_key?: string | null; created_at: number; updated_at: number };
export type ChannelCursor = { createdAt: number; id: string };
export type ChannelFeed = { posts: ChannelPost[]; nextCursor: ChannelCursor | null };
export type ChannelAdminRole = 'owner' | 'admin';
type ChannelErrorBody = { error?: { code?: string } };

async function call(path: string, init: RequestInit = {}, adminPassword?: string) {
  const token = await getFirebaseAIIdToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  if (adminPassword) headers.set('X-Channel-Admin-Password', adminPassword);
  const response = await fetch(`${CHANNEL_API_BASE}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({})) as ChannelErrorBody & Record<string, unknown>;
  if (!response.ok) throw new Error(body.error?.code || 'channel_request_failed');
  return body;
}
export async function listChannelPosts(cursor?: ChannelCursor): Promise<ChannelFeed> {
  const query = new URLSearchParams({ limit: '50' });
  if (cursor) {
    query.set('before', String(cursor.createdAt));
    query.set('beforeId', cursor.id);
  }
  const body = await call(`/api/channel/feed?${query.toString()}`);
  return { posts: (body.posts as ChannelPost[]) ?? [], nextCursor: (body.nextCursor as ChannelCursor | null) ?? null };
}
export async function reactToChannelPost(postId: string, emoji: string) {
  return call(`/api/channel/posts/${encodeURIComponent(postId)}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) });
}
export async function registerChannelPushToken(token: string) {
  return call('/api/channel/devices', { method: 'POST', body: JSON.stringify({ token }) });
}
export async function loginChannelAdmin(password: string): Promise<{ role: ChannelAdminRole }> {
  const result = await call('/api/channel/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
  if (result.role !== 'owner' && result.role !== 'admin') throw new Error('admin_required');
  await SecureStore.deleteItemAsync(LEGACY_ADMIN_SESSION_KEY);
  await SecureStore.deleteItemAsync(LEGACY_ADMIN_ENABLED_KEY);
  await SecureStore.setItemAsync(ADMIN_PASSWORD_KEY, password, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return { role: result.role };
}
export async function hasChannelAdminAccess() {
  const password = await SecureStore.getItemAsync(ADMIN_PASSWORD_KEY);
  if (!password) return false;
  try {
    const result = await call('/api/channel/admin/access', { method: 'GET' }, password);
    if (result.role !== 'owner' && result.role !== 'admin') throw new Error('invalid_admin_password');
    return true;
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (['invalid_admin_password', 'channel_admin_password_not_configured'].includes(code)) {
      await SecureStore.deleteItemAsync(ADMIN_PASSWORD_KEY);
      await SecureStore.deleteItemAsync(LEGACY_ADMIN_SESSION_KEY);
      await SecureStore.deleteItemAsync(LEGACY_ADMIN_ENABLED_KEY);
      return false;
    }
    throw error;
  }
}
export async function logoutChannelAdmin() {
  await SecureStore.deleteItemAsync(ADMIN_PASSWORD_KEY);
  await SecureStore.deleteItemAsync(LEGACY_ADMIN_SESSION_KEY);
  await SecureStore.deleteItemAsync(LEGACY_ADMIN_ENABLED_KEY);
}
export async function publishChannelPost(body: string) {
  const password = await SecureStore.getItemAsync(ADMIN_PASSWORD_KEY);
  if (!password) throw new Error('admin_password_required');
  return call('/api/channel/admin/posts', { method: 'POST', body: JSON.stringify({ body }) }, password);
}
