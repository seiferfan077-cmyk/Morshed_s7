import * as SecureStore from 'expo-secure-store';
import { getFirebaseAIIdToken } from '../firebase/firebaseAuthService';

export const CHANNEL_API_BASE = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL?.trim()) || 'https://murshid-ai-backend.murshid-s7.workers.dev';
const ADMIN_SESSION_KEY = 'murshid.channel.admin-session';

export type ChannelPost = { id: string; body: string; audio_key?: string | null; file_key?: string | null; created_at: number; updated_at: number };
export type ChannelCursor = { createdAt: number; id: string };
export type ChannelFeed = { posts: ChannelPost[]; nextCursor: ChannelCursor | null };

type ChannelErrorBody = { error?: { code?: string } };

async function call(path: string, init: RequestInit = {}, withAdminSession = false) {
  const token = await getFirebaseAIIdToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  if (withAdminSession) {
    const session = await SecureStore.getItemAsync(ADMIN_SESSION_KEY);
    if (!session) throw new Error('admin_session_required');
    headers.set('X-Channel-Admin-Session', session);
  }
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

export async function bootstrapChannelAdmin(role: 'owner' | 'admin', password: string) {
  return call('/api/channel/admin/bootstrap', { method: 'POST', body: JSON.stringify({ role, password }) });
}

export async function setAdminPassword(password: string, confirmation: string) {
  return call('/api/channel/admin/password', { method: 'POST', body: JSON.stringify({ password, confirmation }) });
}

export async function loginChannelAdmin(password: string) {
  const result = await call('/api/channel/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
  const sessionToken = result.sessionToken;
  if (typeof sessionToken !== 'string' || !sessionToken) throw new Error('admin_session_missing');
  await SecureStore.setItemAsync(ADMIN_SESSION_KEY, sessionToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return result;
}

export async function hasChannelAdminSession() {
  return Boolean(await SecureStore.getItemAsync(ADMIN_SESSION_KEY));
}

export async function logoutChannelAdmin() {
  try {
    await call('/api/channel/admin/logout', { method: 'POST' }, true);
  } finally {
    await SecureStore.deleteItemAsync(ADMIN_SESSION_KEY);
  }
}

export async function publishChannelPost(body: string) {
  return call('/api/channel/admin/posts', { method: 'POST', body: JSON.stringify({ body }) }, true);
}
