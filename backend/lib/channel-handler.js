import { verifyFirebaseIdToken } from './firebase-auth.js';
import { sendChannelPostNotifications } from './channel-push.js';

const MAX_BODY = 8_000;
const MAX_PAGE_SIZE = 100;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ALLOWED_EMOJI = new Set(['❤️', '👍', '👏', 'جزاك الله خيرًا', '🤍']);
const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extra } });
const error = (status, code) => json({ error: { code } }, status);
const now = () => Date.now();
const id = () => crypto.randomUUID();
const toHex = (bytes) => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');

async function auth(request, env, verify = verifyFirebaseIdToken) {
  const project = env.FIREBASE_PROJECT_ID?.trim();
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!project || !token) return null;
  try { return await verify(token, project); } catch { return null; }
}
function db(env) { return env.CHANNEL_DB; }
function requireDb(env) { if (!db(env)) throw new Error('channel_db_not_configured'); return db(env); }
async function hashPassword(password, saltText = crypto.randomUUID()) {
  const salt = new TextEncoder().encode(saltText);
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120_000, hash: 'SHA-256' }, material, 256);
  return { salt: saltText, hash: toHex(bits) };
}
async function matchesPassword(password, record) {
  if (!record?.password_hash || !record?.password_salt) return false;
  const candidate = await hashPassword(password, record.password_salt);
  return candidate.hash === record.password_hash;
}
async function createSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}
async function hashSessionToken(token) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
}
function validText(value) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= MAX_BODY; }
async function readJson(request) { try { return await request.json(); } catch { return null; } }
async function adminRecord(env, uid) { return requireDb(env).prepare('SELECT * FROM channel_admins WHERE uid = ?').bind(uid).first(); }
function adminRole(record) { return record?.role === 'owner' || record?.role === 'admin' ? record.role : null; }
function bootstrapAllowed(env, role, uid) {
  const key = role === 'owner' ? 'CHANNEL_OWNER_BOOTSTRAP_UIDS' : 'CHANNEL_ADMIN_BOOTSTRAP_UIDS';
  const allowed = String(env[key] || '').split(',').map((value) => value.trim()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(uid);
}
function validExpoPushToken(token) {
  return typeof token === 'string' && token.length <= 512 && /^(?:ExponentPushToken|ExpoPushToken)\[[^\]]{10,480}\]$/.test(token);
}

async function requireAdmin(request, env, user) {
  if (!user?.uid) return { response: error(401, 'unauthorized') };
  const database = requireDb(env);
  const record = await adminRecord(env, user.uid);
  if (!adminRole(record) || !Number(record.bootstrap_used)) return { response: error(403, 'admin_required') };
  if (Number(record.locked_until) > now()) return { response: error(429, 'admin_temporarily_locked') };
  const token = request.headers.get('x-channel-admin-session')?.trim();
  if (!token) return { response: error(401, 'admin_session_required') };
  const tokenHash = await hashSessionToken(token);
  const session = await database.prepare('SELECT expires_at FROM channel_admin_sessions WHERE uid = ? AND token_hash = ?').bind(user.uid, tokenHash).first();
  if (!session || Number(session.expires_at) <= now()) return { response: error(401, 'admin_session_expired') };
  return { user, record };
}

async function readFeed(database, url) {
  const requested = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(MAX_PAGE_SIZE, requested)) : 50;
  const before = Number(url.searchParams.get('before'));
  const beforeId = url.searchParams.get('beforeId') ?? '';
  let query;
  if (Number.isFinite(before) && before > 0 && beforeId) {
    query = database.prepare(`SELECT id, body, audio_key, file_key, created_at, updated_at FROM channel_posts
      WHERE deleted_at IS NULL AND (created_at < ? OR (created_at = ? AND id < ?))
      ORDER BY created_at DESC, id DESC LIMIT ?`).bind(before, before, beforeId, limit + 1);
  } else {
    query = database.prepare(`SELECT id, body, audio_key, file_key, created_at, updated_at FROM channel_posts
      WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT ?`).bind(limit + 1);
  }
  const result = await query.all();
  const rows = result.results ?? [];
  const hasMore = rows.length > limit;
  const posts = rows.slice(0, limit);
  const oldest = posts.at(-1);
  return { posts, nextCursor: hasMore && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null };
}

async function createPost(database, user, body) {
  if (!validText(body?.body)) return { response: error(400, 'invalid_post') };
  const timestamp = now();
  const post = { id: id(), body: body.body.trim(), created_at: timestamp, updated_at: timestamp };
  await database.prepare('INSERT INTO channel_posts (id, author_uid, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(post.id, user.uid, post.body, timestamp, timestamp).run();
  return { post };
}

async function queuePostNotifications(env, post, ctx) {
  const task = sendChannelPostNotifications(env, post).catch((caught) => {
    console.warn('Channel notification delivery failed:', caught instanceof Error ? caught.message : 'unknown');
  });
  if (ctx?.waitUntil) ctx.waitUntil(task);
  else await task;
}

export async function handleChannelRequest(request, env, verify = verifyFirebaseIdToken, ctx) {
  try {
    const user = await auth(request, env, verify);
    if (!user?.uid) return error(401, 'unauthorized');
    const database = requireDb(env);
    const url = new URL(request.url);
    if (url.pathname === '/api/channel/feed' && request.method === 'GET') {
      return json(await readFeed(database, url));
    }
    if (url.pathname === '/api/channel/devices' && request.method === 'POST') {
      const body = await readJson(request);
      if (!validExpoPushToken(body?.token)) return error(400, 'invalid_push_token');
      const timestamp = now();
      await database.prepare(`INSERT INTO channel_devices (token, uid, created_at, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(token) DO UPDATE SET uid = excluded.uid, updated_at = excluded.updated_at`)
        .bind(body.token, user.uid, timestamp, timestamp).run();
      return json({ ok: true }, 201);
    }
    if (url.pathname === '/api/channel/posts' && request.method === 'POST') {
      const admin = await requireAdmin(request, env, user);
      if (admin.response) return admin.response;
      const result = await createPost(database, user, await readJson(request) ?? {});
      if (result.response) return result.response;
      await queuePostNotifications(env, result.post, ctx);
      return json({ post: result.post }, 201);
    }
    const reaction = url.pathname.match(/^\/api\/channel\/posts\/([^/]+)\/reactions$/);
    if (reaction && request.method === 'POST') {
      const body = await readJson(request);
      if (!ALLOWED_EMOJI.has(body?.emoji)) return error(400, 'invalid_reaction');
      await database.prepare('INSERT OR IGNORE INTO channel_reactions (post_id, uid, emoji, created_at) VALUES (?, ?, ?, ?)')
        .bind(reaction[1], user.uid, body.emoji, now()).run();
      return json({ ok: true });
    }
    return error(404, 'not_found');
  } catch (caught) {
    const missing = caught?.message === 'channel_db_not_configured';
    return error(missing ? 503 : 500, missing ? 'channel_not_configured' : 'channel_unavailable');
  }
}

export async function handleChannelAdminRequest(request, env, verify = verifyFirebaseIdToken, ctx) {
  try {
    const user = await auth(request, env, verify);
    if (!user?.uid) return error(401, 'unauthorized');
    const database = requireDb(env);
    const url = new URL(request.url);
    const body = await readJson(request) ?? {};

    if (url.pathname === '/api/channel/admin/bootstrap' && request.method === 'POST') {
      const role = body.role === 'owner' ? 'owner' : body.role === 'admin' ? 'admin' : null;
      if (!role || typeof body.password !== 'string') return error(400, 'invalid_bootstrap');
      if (!bootstrapAllowed(env, role, user.uid)) return error(403, 'bootstrap_not_authorized');
      const temp = role === 'owner' ? env.CHANNEL_OWNER_TEMP_PASSWORD : env.CHANNEL_ADMIN_TEMP_PASSWORD;
      if (!temp || body.password !== temp) return error(401, 'invalid_bootstrap');
      const existing = await adminRecord(env, user.uid);
      if (Number(existing?.bootstrap_used)) return error(409, 'bootstrap_already_used');
      const stamp = now();
      await database.prepare(`INSERT INTO channel_admins (uid, role, password_hash, password_salt, bootstrap_used, failed_attempts, locked_until, created_at, updated_at)
        VALUES (?, ?, NULL, NULL, 0, 0, 0, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET role = excluded.role, password_hash = NULL, password_salt = NULL,
        bootstrap_used = 0, failed_attempts = 0, locked_until = 0, updated_at = excluded.updated_at`)
        .bind(user.uid, role, stamp, stamp).run();
      return json({ ok: true, role, requiresPasswordChange: true });
    }

    if (url.pathname === '/api/channel/admin/password' && request.method === 'POST') {
      const record = await adminRecord(env, user.uid);
      if (!adminRole(record)) return error(403, 'admin_required');
      if (Number(record.bootstrap_used)) return error(409, 'password_already_set');
      if (!validText(body.password) || body.password !== body.confirmation || body.password.length < 10) return error(400, 'invalid_password');
      const hashed = await hashPassword(body.password);
      const stamp = now();
      await database.prepare('UPDATE channel_admins SET password_hash = ?, password_salt = ?, bootstrap_used = 1, failed_attempts = 0, locked_until = 0, updated_at = ? WHERE uid = ?')
        .bind(hashed.hash, hashed.salt, stamp, user.uid).run();
      return json({ ok: true });
    }

    if (url.pathname === '/api/channel/admin/login' && request.method === 'POST') {
      const record = await adminRecord(env, user.uid);
      if (!record || !adminRole(record)) return error(403, 'admin_required');
      if (Number(record.locked_until) > now()) return error(429, 'admin_temporarily_locked');
      if (!Number(record.bootstrap_used) || !record.password_hash) return error(409, 'password_setup_required');
      const valid = typeof body.password === 'string' && await matchesPassword(body.password, record);
      if (!valid) {
        const attempts = Number(record.failed_attempts || 0) + 1;
        const locked = attempts >= 5 ? now() + 15 * 60_000 : 0;
        await database.prepare('UPDATE channel_admins SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE uid = ?')
          .bind(attempts, locked, now(), user.uid).run();
        return error(401, 'invalid_admin_password');
      }
      const sessionToken = await createSessionToken();
      const tokenHash = await hashSessionToken(sessionToken);
      const expiresAt = now() + SESSION_TTL_MS;
      await database.prepare('UPDATE channel_admins SET failed_attempts = 0, locked_until = 0, updated_at = ? WHERE uid = ?').bind(now(), user.uid).run();
      await database.prepare('INSERT INTO channel_admin_sessions (token_hash, uid, expires_at, created_at) VALUES (?, ?, ?, ?)')
        .bind(tokenHash, user.uid, expiresAt, now()).run();
      return json({ ok: true, role: record.role, sessionToken, expiresAt });
    }

    if (url.pathname === '/api/channel/admin/logout' && request.method === 'POST') {
      const token = request.headers.get('x-channel-admin-session')?.trim();
      if (token) {
        const tokenHash = await hashSessionToken(token);
        await database.prepare('DELETE FROM channel_admin_sessions WHERE uid = ? AND token_hash = ?').bind(user.uid, tokenHash).run();
      }
      return json({ ok: true });
    }

    const admin = await requireAdmin(request, env, user);
    if (admin.response) return admin.response;
    if (url.pathname === '/api/channel/admin/posts' && request.method === 'POST') {
      const result = await createPost(database, user, body);
      if (result.response) return result.response;
      await queuePostNotifications(env, result.post, ctx);
      return json({ post: result.post }, 201);
    }
    const postMatch = url.pathname.match(/^\/api\/channel\/admin\/posts\/([^/]+)$/);
    if (postMatch && ['PATCH', 'DELETE'].includes(request.method)) {
      const target = await database.prepare('SELECT author_uid FROM channel_posts WHERE id = ? AND deleted_at IS NULL').bind(postMatch[1]).first();
      if (!target) return error(404, 'post_not_found');
      if (request.method === 'PATCH') {
        if (!validText(body.body)) return error(400, 'invalid_post');
        await database.prepare('UPDATE channel_posts SET body = ?, updated_at = ? WHERE id = ?').bind(body.body.trim(), now(), postMatch[1]).run();
      } else {
        await database.prepare('UPDATE channel_posts SET deleted_at = ?, updated_at = ? WHERE id = ?').bind(now(), now(), postMatch[1]).run();
      }
      return json({ ok: true });
    }
    return error(404, 'not_found');
  } catch (caught) {
    const missing = caught?.message === 'channel_db_not_configured';
    return error(missing ? 503 : 500, missing ? 'channel_not_configured' : 'channel_unavailable');
  }
}
