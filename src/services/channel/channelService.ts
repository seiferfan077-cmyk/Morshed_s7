import { getFirebaseAIIdToken } from '../firebase/firebaseAuthService';
export const CHANNEL_API_BASE = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL?.trim()) || 'https://murshid-ai-backend.murshid-s7.workers.dev';
export type ChannelPost = { id: string; body: string; audio_key?: string | null; file_key?: string | null; created_at: number; updated_at: number };
async function call(path: string, init: RequestInit = {}) {
  const token = await getFirebaseAIIdToken();
  const response = await fetch(`${CHANNEL_API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.code || 'channel_request_failed');
  return body;
}
export async function listChannelPosts() { return (await call('/api/channel/feed')).posts as ChannelPost[]; }
export async function reactToChannelPost(postId: string, emoji: string) { return call(`/api/channel/posts/${encodeURIComponent(postId)}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }); }
export async function bootstrapChannelAdmin(role: 'owner' | 'admin', password: string) { return call('/api/channel/admin/bootstrap', { method: 'POST', body: JSON.stringify({ role, password }) }); }
export async function setOwnerPassword(password: string, confirmation: string) { return call('/api/channel/admin/password', { method: 'POST', body: JSON.stringify({ password, confirmation }) }); }
export async function loginChannelAdmin(password: string) { return call('/api/channel/admin/login', { method: 'POST', body: JSON.stringify({ password }) }); }
export async function publishChannelPost(body: string) { return call('/api/channel/admin/posts', { method: 'POST', body: JSON.stringify({ body }) }); }
