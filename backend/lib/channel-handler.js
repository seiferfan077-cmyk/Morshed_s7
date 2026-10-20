import { verifyFirebaseIdToken } from './firebase-auth.js';

const MAX_BODY = 8_000;
const ALLOWED_EMOJI = new Set(['❤️', '👍', '👏', 'جزاك الله خيرًا', '🤍']);
const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extra } });
const error = (status, code) => json({ error: { code } }, status);
const now = () => Date.now();
const id = () => crypto.randomUUID();

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
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, material, 256);
  return { salt: saltText, hash: [...new Uint8Array(bits)].map((v) => v.toString(16).padStart(2, '0')).join('') };
}
async function matchesPassword(password, record) { return Boolean(record?.password_hash && record?.password_salt && (await hashPassword(password, record.password_salt)).hash === record.password_hash); }
function validText(value) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= MAX_BODY; }
async function readJson(request) { try { return await request.json(); } catch { return null; } }
async function adminRecord(env, uid) { return requireDb(env).prepare('SELECT * FROM channel_admins WHERE uid = ?').bind(uid).first(); }
function adminRole(record) { return record?.role === 'owner' || record?.role === 'admin' ? record.role : null; }
function bootstrapAllowed(env, role, uid) {
  const key = role === 'owner' ? 'CHANNEL_OWNER_BOOTSTRAP_UIDS' : 'CHANNEL_ADMIN_BOOTSTRAP_UIDS';
  const allowed = String(env[key] || '').split(',').map((value) => value.trim()).filter(Boolean);
  return allowed.includes(uid);
}
async function requireAdmin(request, env) { const user = await auth(request, env); if (!user?.uid) return { response: error(401, 'unauthorized') }; const record = await adminRecord(env, user.uid); if (!adminRole(record)) return { response: error(403, 'admin_required') }; if (Number(record.locked_until) > now()) return { response: error(429, 'admin_temporarily_locked') }; return { user, record }; }

export async function handleChannelRequest(request, env, verify = verifyFirebaseIdToken) {
  try {
    const user = await auth(request, env, verify);
    if (!user?.uid) return error(401, 'unauthorized');
    const database = requireDb(env);
    const url = new URL(request.url);
    if (url.pathname === '/api/channel/feed' && request.method === 'GET') {
      const posts = await database.prepare('SELECT id, body, audio_key, file_key, created_at, updated_at FROM channel_posts WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 50').all();
      return json({ posts: posts.results ?? [] });
    }
    if (url.pathname === '/api/channel/posts' && request.method === 'POST') {
      const body = await readJson(request); if (!validText(body?.body)) return error(400, 'invalid_post');
      const timestamp = now(); const postId = id();
      await database.prepare('INSERT INTO channel_posts (id, author_uid, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(postId, user.uid, body.body.trim(), timestamp, timestamp).run();
      return json({ id: postId }, 201);
    }
    const reaction = url.pathname.match(/^\/api\/channel\/posts\/([^/]+)\/reactions$/);
    if (reaction && request.method === 'POST') {
      const body = await readJson(request); if (!ALLOWED_EMOJI.has(body?.emoji)) return error(400, 'invalid_reaction');
      await database.prepare('INSERT OR IGNORE INTO channel_reactions (post_id, uid, emoji, created_at) VALUES (?, ?, ?, ?)').bind(reaction[1], user.uid, body.emoji, now()).run();
      return json({ ok: true });
    }
    return error(404, 'not_found');
  } catch (caught) { return error(caught?.message === 'channel_db_not_configured' ? 503 : 500, caught?.message === 'channel_db_not_configured' ? 'channel_not_configured' : 'channel_unavailable'); }
}

export async function handleChannelAdminRequest(request, env, verify = verifyFirebaseIdToken) {
  try {
    const user = await auth(request, env, verify); if (!user?.uid) return error(401, 'unauthorized');
    const database = requireDb(env); const url = new URL(request.url); const body = await readJson(request) ?? {};
    if (url.pathname === '/api/channel/admin/bootstrap' && request.method === 'POST') {
      const role = body.role === 'owner' ? 'owner' : body.role === 'admin' ? 'admin' : null;
      if (!role || typeof body.password !== 'string') return error(400, 'invalid_bootstrap');
      if (!bootstrapAllowed(env, role, user.uid)) return error(403, 'bootstrap_not_authorized');
      const temp = role === 'owner' ? env.CHANNEL_OWNER_TEMP_PASSWORD : env.CHANNEL_ADMIN_TEMP_PASSWORD;
      if (!temp || body.password !== temp) return error(401, 'invalid_bootstrap');
      const existing = await adminRecord(env, user.uid);
      if (existing?.bootstrap_used) return error(409, 'bootstrap_already_used');
      const stamp = now();
      await database.prepare('INSERT INTO channel_admins (uid, role, bootstrap_used, created_at, updated_at) VALUES (?, ?, 0, ?, ?) ON CONFLICT(uid) DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at').bind(user.uid, role, stamp, stamp).run();
      return json({ ok: true, requiresPasswordChange: role === 'owner' });
    }
    if (url.pathname === '/api/channel/admin/password' && request.method === 'POST') {
      const record = await adminRecord(env, user.uid); if (!record || record.role !== 'owner') return error(403, 'owner_required');
      if (!validText(body.password) || body.password !== body.confirmation || body.password.length < 10) return error(400, 'invalid_password');
      const hashed = await hashPassword(body.password); const stamp = now();
      await database.prepare('UPDATE channel_admins SET password_hash = ?, password_salt = ?, bootstrap_used = 1, failed_attempts = 0, locked_until = 0, updated_at = ? WHERE uid = ?').bind(hashed.hash, hashed.salt, stamp, user.uid).run();
      return json({ ok: true });
    }
    if (url.pathname === '/api/channel/admin/login' && request.method === 'POST') {
      const record = await adminRecord(env, user.uid); if (!record || !adminRole(record)) return error(403, 'admin_required');
      if (Number(record.locked_until) > now()) return error(429, 'admin_temporarily_locked');
      const valid = typeof body.password === 'string' && await matchesPassword(body.password, record);
      if (!valid) {
        const attempts = Number(record.failed_attempts || 0) + 1; const locked = attempts >= 5 ? now() + 15 * 60_000 : 0;
        await database.prepare('UPDATE channel_admins SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE uid = ?').bind(attempts, locked, now(), user.uid).run();
        return error(401, 'invalid_admin_password');
      }
      await database.prepare('UPDATE channel_admins SET failed_attempts = 0, locked_until = 0, updated_at = ? WHERE uid = ?').bind(now(), user.uid).run();
      return json({ ok: true, role: record.role, requiresPasswordChange: record.role === 'owner' && !record.bootstrap_used });
    }
    const admin = await requireAdmin(request, env); if (admin.response) return admin.response;
    if (url.pathname === '/api/channel/admin/posts' && request.method === 'POST') {
      if (!validText(body.body)) return error(400, 'invalid_post'); const stamp = now(); const postId = id();
      await database.prepare('INSERT INTO channel_posts (id, author_uid, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(postId, user.uid, body.body.trim(), stamp, stamp).run();
      return json({ id: postId }, 201);
    }
    const postMatch = url.pathname.match(/^\/api\/channel\/admin\/posts\/([^/]+)$/);
    if (postMatch && ['PATCH', 'DELETE'].includes(request.method)) {
      const target = await database.prepare('SELECT author_uid FROM channel_posts WHERE id = ? AND deleted_at IS NULL').bind(postMatch[1]).first(); if (!target) return error(404, 'post_not_found');
      if (request.method === 'PATCH') { if (!validText(body.body)) return error(400, 'invalid_post'); await database.prepare('UPDATE channel_posts SET body = ?, updated_at = ? WHERE id = ?').bind(body.body.trim(), now(), postMatch[1]).run(); }
      else await database.prepare('UPDATE channel_posts SET deleted_at = ?, updated_at = ? WHERE id = ?').bind(now(), now(), postMatch[1]).run();
      return json({ ok: true });
    }
    return error(404, 'not_found');
  } catch (caught) { return error(caught?.message === 'channel_db_not_configured' ? 503 : 500, caught?.message === 'channel_db_not_configured' ? 'channel_not_configured' : 'channel_unavailable'); }
}
