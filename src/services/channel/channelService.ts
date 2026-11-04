import * as SecureStore from 'expo-secure-store';
import { getFirebaseAIIdToken, getFirebaseSignedInIdToken } from '../firebase/firebaseAuthService';

export const CHANNEL_API_BASE = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL?.trim()) || 'https://murshid-ai-backend.murshid-s7.workers.dev';
const ADMIN_ENABLED_KEY = 'murshid.channel.admin-enabled';
const LEGACY_ADMIN_SESSION_KEY = 'murshid.channel.admin-session';

export type ChannelPost = { id: string; body: string; audio_key?: string | null; file_key?: string | null; created_at: number; updated_at: number };
export type ChannelCursor = { createdAt: number; id: string };
export type ChannelFeed = { posts: ChannelPost[]; nextCursor: ChannelCursor | null };
export type ChannelAdminRole = 'owner' | 'admin';
type ChannelErrorBody = { error?: { code?: string } };

async function call(path: string, init: RequestInit = {}, requireSignedInAccount = false) {
  const token = requireSignedInAccount ? await getFirebaseSignedInIdToken() : await getFirebaseAIIdToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
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
export async function loginChannelAdmin(): Promise<{ role: ChannelAdminRole }> {
  const result = await call('/api/channel/admin/access', { method: 'GET' }, true);
  if (result.role !== 'owner' && result.role !== 'admin') throw new Error('admin_required');
  await SecureStore.deleteItemAsync(LEGACY_ADMIN_SESSION_KEY);
  await SecureStore.setItemAsync(ADMIN_ENABLED_KEY, '1', {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return { role: result.role };
}
export async function hasChannelAdminAccess() {
  if (await SecureStore.getItemAsync(ADMIN_ENABLED_KEY) !== '1') return false;
  try {
    await call('/api/channel/admin/access', { method: 'GET' }, true);
    return true;
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (['admin_required', 'unauthorized', 'firebase_account_signin_required'].includes(code)) {
      await SecureStore.deleteItemAsync(ADMIN_ENABLED_KEY);
      await SecureStore.deleteItemAsync(LEGACY_ADMIN_SESSION_KEY);
      return false;
    }
    throw error;
  }
}
export async function logoutChannelAdmin() {
  await SecureStore.deleteItemAsync(ADMIN_ENABLED_KEY);
  await SecureStore.deleteItemAsync(LEGACY_ADMIN_SESSION_KEY);
}
export async function publishChannelPost(body: string) {
  return call('/api/channel/admin/posts', { method: 'POST', body: JSON.stringify({ body }) }, true);
}
