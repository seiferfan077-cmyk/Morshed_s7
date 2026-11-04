import { verifyFirebaseIdToken } from './firebase-auth.js';
import { sendChannelPostNotifications } from './channel-push.js';

const MAX_BODY = 8_000;
const MAX_PAGE_SIZE = 100;
const ALLOWED_EMOJI = new Set(['❤️', '👍', '👏', 'جزاك الله خيرًا', '🤍']);
const POST_FIELDS = 'id, body, audio_key, file_key, pinned_at, created_at, updated_at';
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
function validText(value) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= MAX_BODY; }
async function readJson(request) { try { return await request.json(); } catch { return null; } }
function passwordMatches(candidate, expected) {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 256 || typeof expected !== 'string' || !expected) return false;
  const encoder = new TextEncoder();
  const left = encoder.encode(candidate);
  const right = encoder.encode(expected);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}
function adminRoleForPassword(env, password) {
  if (passwordMatches(password, env.CHANNEL_OWNER_TEMP_PASSWORD)) return 'owner';
  if (passwordMatches(password, env.CHANNEL_ADMIN_TEMP_PASSWORD)) return 'admin';
  return null;
}
function passwordNotConfigured(env) {
  return !env.CHANNEL_OWNER_TEMP_PASSWORD && !env.CHANNEL_ADMIN_TEMP_PASSWORD;
}
function validExpoPushToken(token) {
  return typeof token === 'string' && token.length <= 512 && /^(?:ExponentPushToken|ExpoPushToken)\[[^\]]{10,480}\]$/.test(token);
}

async function requireAdmin(request, env, user) {
  if (!user?.uid) return { response: error(401, 'unauthorized') };
  if (passwordNotConfigured(env)) return { response: error(503, 'channel_admin_password_not_configured') };
  const role = adminRoleForPassword(env, request.headers.get('x-channel-admin-password') ?? '');
  if (!role) return { response: error(401, 'invalid_admin_password') };
  return { user, record: { role } };
}

async function readFeed(database, url) {
  const requested = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(MAX_PAGE_SIZE, requested)) : 50;
  const before = Number(url.searchParams.get('before'));
  const beforeId = url.searchParams.get('beforeId') ?? '';
  const hasPinnedCursor = url.searchParams.has('beforePinned');
  const beforePinned = url.searchParams.get('beforePinned') === '1';
  const beforePinnedAt = Number(url.searchParams.get('beforePinnedAt'));
  let query;

  if (hasPinnedCursor && Number.isFinite(before) && before > 0 && beforeId && (!beforePinned || (Number.isFinite(beforePinnedAt) && beforePinnedAt > 0))) {
    if (beforePinned) {
      query = database.prepare(`SELECT ${POST_FIELDS} FROM channel_posts
        WHERE deleted_at IS NULL AND (
          pinned_at IS NULL OR (pinned_at IS NOT NULL AND (
            pinned_at < ? OR (pinned_at = ? AND (created_at < ? OR (created_at = ? AND id < ?)))
          ))
        )
        ORDER BY (pinned_at IS NOT NULL) DESC, pinned_at DESC, created_at DESC, id DESC LIMIT ?`)
        .bind(beforePinnedAt, beforePinnedAt, before, before, beforeId, limit + 1);
    } else {
      query = database.prepare(`SELECT ${POST_FIELDS} FROM channel_posts
        WHERE deleted_at IS NULL AND pinned_at IS NULL AND (created_at < ? OR (created_at = ? AND id < ?))
        ORDER BY (pinned_at IS NOT NULL) DESC, pinned_at DESC, created_at DESC, id DESC LIMIT ?`)
        .bind(before, before, beforeId, limit + 1);
    }
  } else if (Number.isFinite(before) && before > 0 && beforeId) {
    // Backward compatibility for app versions that do not yet send the pinned cursor fields.
    query = database.prepare(`SELECT ${POST_FIELDS} FROM channel_posts
      WHERE deleted_at IS NULL AND (created_at < ? OR (created_at = ? AND id < ?))
      ORDER BY (pinned_at IS NOT NULL) DESC, pinned_at DESC, created_at DESC, id DESC LIMIT ?`)
      .bind(before, before, beforeId, limit + 1);
  } else {
    query = database.prepare(`SELECT ${POST_FIELDS} FROM channel_posts
      WHERE deleted_at IS NULL
      ORDER BY (pinned_at IS NOT NULL) DESC, pinned_at DESC, created_at DESC, id DESC LIMIT ?`)
      .bind(limit + 1);
  }

  const result = await query.all();
  const rows = result.results ?? [];
  const hasMore = rows.length > limit;
  const posts = rows.slice(0, limit);
  const oldest = posts.at(-1);
  const deletedResult = await database.prepare('SELECT id FROM channel_posts WHERE deleted_at IS NOT NULL').all();
  return {
    posts,
    nextCursor: hasMore && oldest ? {
      createdAt: oldest.created_at,
      id: oldest.id,
      pinnedAt: oldest.pinned_at == null ? null : Number(oldest.pinned_at),
    } : null,
    deletedIds: (deletedResult.results ?? []).map((row) => row.id).filter((postId) => typeof postId === 'string'),
  };
}

async function createPost(database, user, body) {
  if (!validText(body?.body)) return { response: error(400, 'invalid_post') };
  const timestamp = now();
  const post = { id: id(), body: body.body.trim(), pinned_at: null, created_at: timestamp, updated_at: timestamp };
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
    const url = new URL(request.url);

    if (url.pathname === '/api/channel/admin/login' && request.method === 'POST') {
      if (passwordNotConfigured(env)) return error(503, 'channel_admin_password_not_configured');
      const body = await readJson(request) ?? {};
      const role = adminRoleForPassword(env, body.password);
      if (!role) return error(401, 'invalid_admin_password');
      return json({ ok: true, role });
    }

    if (url.pathname === '/api/channel/admin/access' && request.method === 'GET') {
      const authorization = await requireAdmin(request, env, user);
      if (authorization.response) return authorization.response;
      return json({ ok: true, role: authorization.record.role });
    }

    const authorization = await requireAdmin(request, env, user);
    if (authorization.response) return authorization.response;
    const database = requireDb(env);
    const body = await readJson(request) ?? {};

    if (url.pathname === '/api/channel/admin/posts' && request.method === 'POST') {
      const result = await createPost(database, user, body);
      if (result.response) return result.response;
      await queuePostNotifications(env, result.post, ctx);
      return json({ post: result.post }, 201);
    }

    const pinMatch = url.pathname.match(/^\/api\/channel\/admin\/posts\/([^/]+)\/pin$/);
    if (pinMatch && request.method === 'POST') {
      if (typeof body.pinned !== 'boolean') return error(400, 'invalid_pin_state');
      const postId = pinMatch[1];
      const target = await database.prepare('SELECT id FROM channel_posts WHERE id = ? AND deleted_at IS NULL').bind(postId).first();
      if (!target) return error(404, 'post_not_found');
      const timestamp = now();
      await database.prepare('UPDATE channel_posts SET pinned_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
        .bind(body.pinned ? timestamp : null, timestamp, postId).run();
      const post = await database.prepare(`SELECT ${POST_FIELDS} FROM channel_posts WHERE id = ? AND deleted_at IS NULL`).bind(postId).first();
      return json({ post });
    }

    const postMatch = url.pathname.match(/^\/api\/channel\/admin\/posts\/([^/]+)$/);
    if (postMatch && ['PATCH', 'DELETE'].includes(request.method)) {
      const postId = postMatch[1];
      const target = await database.prepare('SELECT author_uid FROM channel_posts WHERE id = ? AND deleted_at IS NULL').bind(postId).first();
      if (!target) return error(404, 'post_not_found');
      if (request.method === 'PATCH') {
        if (!validText(body.body)) return error(400, 'invalid_post');
        await database.prepare('UPDATE channel_posts SET body = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
          .bind(body.body.trim(), now(), postId).run();
        const post = await database.prepare(`SELECT ${POST_FIELDS} FROM channel_posts WHERE id = ? AND deleted_at IS NULL`).bind(postId).first();
        return json({ post });
      }
      const timestamp = now();
      await database.prepare('UPDATE channel_posts SET body = ?, audio_key = NULL, file_key = NULL, deleted_at = ?, pinned_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
        .bind('', timestamp, timestamp, postId).run();
      return json({ ok: true, deletedId: postId });
    }
    return error(404, 'not_found');
  } catch (caught) {
    const missing = caught?.message === 'channel_db_not_configured';
    const errorName = typeof caught?.name === 'string' ? caught.name : 'unknown';
    console.error('[channel-admin] request failed', { errorName });
    return error(missing ? 503 : 500, missing ? 'channel_not_configured' : 'channel_unavailable');
  }
}
