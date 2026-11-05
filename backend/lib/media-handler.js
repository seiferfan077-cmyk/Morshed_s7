import { verifyFirebaseSignedInIdToken } from './firebase-auth.js';

const MAX_MEDIA_BYTES = 95_000_000;
const MAX_PAGE_SIZE = 100;
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff', 'image/x-adobe-dng',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v', 'video/x-matroska', 'video/x-msvideo',
]);
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const error = (status, code) => json({ error: { code } }, status);

async function authenticate(request, env, verify) {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!projectId || !token) return null;
  try { return await verify(token, projectId); } catch { return null; }
}

function configured(env) {
  return Boolean(env.CHANNEL_DB && env.MEDIA_BUCKET && env.FIREBASE_PROJECT_ID);
}

function safeFilename(value) {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* retain the original, then sanitize it */ }
  const cleaned = decoded.replace(/[\\/\u0000-\u001f\u007f"<>:|?*]/g, '_').trim().slice(0, 180);
  return cleaned || 'media';
}

function mediaShape(row) {
  return {
    id: row.id,
    clientMediaId: row.client_media_id,
    filename: row.filename,
    type: row.media_type,
    contentType: row.content_type,
    size: Number(row.size),
    createdAt: Number(row.created_at),
    contentPath: `/api/media/${encodeURIComponent(row.id)}/content`,
  };
}

function contentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function startsWithBytes(bytes, signature, offset = 0) {
  return bytes.length >= offset + signature.length && signature.every((byte, index) => bytes[offset + index] === byte);
}

function asciiAt(bytes, offset, length) {
  if (bytes.length < offset + length) return '';
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function isFtyp(bytes) {
  return bytes.length >= 12 && asciiAt(bytes, 4, 4) === 'ftyp';
}

function matchesSignature(contentType, prefix) {
  const ftypBrand = isFtyp(prefix) ? asciiAt(prefix, 8, 4) : '';
  switch (contentType) {
    case 'image/jpeg': return startsWithBytes(prefix, [0xff, 0xd8, 0xff]);
    case 'image/png': return startsWithBytes(prefix, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/gif': return ['GIF87a', 'GIF89a'].includes(asciiAt(prefix, 0, 6));
    case 'image/webp': return asciiAt(prefix, 0, 4) === 'RIFF' && asciiAt(prefix, 8, 4) === 'WEBP';
    case 'image/bmp': return asciiAt(prefix, 0, 2) === 'BM';
    case 'image/tiff':
    case 'image/x-adobe-dng': return startsWithBytes(prefix, [0x49, 0x49, 0x2a, 0x00]) || startsWithBytes(prefix, [0x4d, 0x4d, 0x00, 0x2a]);
    case 'image/heic':
    case 'image/heif': return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(ftypBrand);
    case 'image/avif': return ['avif', 'avis'].includes(ftypBrand);
    case 'video/quicktime': return ftypBrand === 'qt  ';
    case 'video/x-m4v': return ftypBrand === 'M4V ';
    case 'video/3gpp': return ftypBrand.startsWith('3gp');
    case 'video/mp4': return Boolean(ftypBrand) && !ftypBrand.startsWith('3gp') && ftypBrand !== 'qt  ' && ftypBrand !== 'M4V ';
    case 'video/webm':
    case 'video/x-matroska': return startsWithBytes(prefix, [0x1a, 0x45, 0xdf, 0xa3]);
    case 'video/x-msvideo': return asciiAt(prefix, 0, 4) === 'RIFF' && asciiAt(prefix, 8, 4) === 'AVI ';
    default: return false;
  }
}

function checkedBody(body, expectedLength, contentType, stats) {
  let prefix = new Uint8Array(0);
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      stats.size += bytes.byteLength;
      if (stats.size > MAX_MEDIA_BYTES) { stats.failure = 'media_too_large'; throw new Error(stats.failure); }
      if (prefix.length < 16) {
        const needed = Math.min(16 - prefix.length, bytes.length);
        const next = new Uint8Array(prefix.length + needed);
        next.set(prefix);
        next.set(bytes.subarray(0, needed), prefix.length);
        prefix = next;
      }
      if (prefix.length === 16 && !matchesSignature(contentType, prefix)) { stats.failure = 'media_content_mismatch'; throw new Error(stats.failure); }
      controller.enqueue(bytes);
    },
    flush() {
      if (stats.size !== expectedLength) { stats.failure = 'content_length_mismatch'; throw new Error(stats.failure); }
      if (!matchesSignature(contentType, prefix)) { stats.failure = 'media_content_mismatch'; throw new Error(stats.failure); }
    },
  }));
}

async function uploadMedia(request, env, user) {
  const contentLength = Number(request.headers.get('content-length'));
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) return error(411, 'content_length_required');
  if (contentLength > MAX_MEDIA_BYTES) return error(413, 'media_too_large');
  if (!request.body) return error(400, 'media_body_required');

  const clientMediaId = request.headers.get('x-client-media-id') ?? '';
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(clientMediaId)) return error(400, 'invalid_media_id');
  const filename = safeFilename(request.headers.get('x-media-filename') ?? 'media');
  const contentType = (request.headers.get('x-media-type') ?? '').split(';', 1)[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) return error(415, 'unsupported_media_type');
  const mediaType = contentType.startsWith('image/') ? 'image' : 'video';
  const db = env.CHANNEL_DB;

  const existing = await db.prepare(`SELECT id, client_media_id, filename, media_type, content_type, size, created_at
    FROM user_media_objects WHERE owner_uid = ? AND client_media_id = ?`).bind(user.uid, clientMediaId).first();
  if (existing) return json({ media: mediaShape(existing), alreadyUploaded: true });

  const id = crypto.randomUUID();
  const objectKey = `users/${encodeURIComponent(user.uid)}/media/${id}`;
  const createdAt = Date.now();
  const stats = { size: 0, failure: null };
  const body = checkedBody(request.body, contentLength, contentType, stats);
  try {
    await env.MEDIA_BUCKET.put(objectKey, body, {
      httpMetadata: { contentType, contentDisposition: contentDisposition(filename) },
      customMetadata: { ownerUid: user.uid, mediaId: id },
    });
  } catch (cause) {
    await env.MEDIA_BUCKET.delete(objectKey).catch(() => undefined);
    if (stats.failure === 'media_too_large') return error(413, 'media_too_large');
    if (stats.failure === 'content_length_mismatch') return error(400, 'content_length_mismatch');
    if (stats.failure === 'media_content_mismatch') return error(415, 'media_content_mismatch');
    throw cause;
  }

  try {
    await db.prepare(`INSERT INTO user_media_objects
      (id, owner_uid, client_media_id, object_key, filename, media_type, content_type, size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, user.uid, clientMediaId, objectKey, filename, mediaType, contentType, stats.size, createdAt).run();
  } catch (cause) {
    await env.MEDIA_BUCKET.delete(objectKey).catch(() => undefined);
    const raced = await db.prepare(`SELECT id, client_media_id, filename, media_type, content_type, size, created_at
      FROM user_media_objects WHERE owner_uid = ? AND client_media_id = ?`).bind(user.uid, clientMediaId).first().catch(() => null);
    if (raced) return json({ media: mediaShape(raced), alreadyUploaded: true });
    throw cause;
  }

  return json({ media: mediaShape({ id, client_media_id: clientMediaId, filename, media_type: mediaType, content_type: contentType, size: stats.size, created_at: createdAt }), alreadyUploaded: false }, 201);
}

async function listMedia(request, env, user) {
  const url = new URL(request.url);
  const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
  const requestedOffset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(MAX_PAGE_SIZE, requestedLimit)) : 50;
  const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.min(100_000, requestedOffset)) : 0;
  const rows = await env.CHANNEL_DB.prepare(`SELECT id, client_media_id, filename, media_type, content_type, size, created_at
    FROM user_media_objects WHERE owner_uid = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(user.uid, limit, offset).all();
  return json({ media: (rows.results ?? []).map(mediaShape), nextOffset: (rows.results ?? []).length === limit ? offset + limit : null });
}

async function readMedia(request, env, user, mediaId) {
  const row = await env.CHANNEL_DB.prepare(`SELECT id, object_key, filename, content_type, size
    FROM user_media_objects WHERE owner_uid = ? AND id = ?`).bind(user.uid, mediaId).first();
  if (!row) return error(404, 'media_not_found');
  const object = await env.MEDIA_BUCKET.get(row.object_key);
  if (!object) return error(404, 'media_not_found');
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', row.content_type);
  headers.set('Content-Length', String(row.size));
  headers.set('Content-Disposition', contentDisposition(row.filename));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Vary', 'Authorization');
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  return new Response(object.body, { headers });
}

export async function handleMediaRequest(request, env, verify = verifyFirebaseSignedInIdToken) {
  try {
    const user = await authenticate(request, env, verify);
    if (!user?.uid) return error(401, 'unauthorized');
    if (!configured(env)) return error(503, 'media_storage_not_configured');

    const url = new URL(request.url);
    if (url.pathname === '/api/media' && request.method === 'POST') return await uploadMedia(request, env, user);
    if (url.pathname === '/api/media' && request.method === 'GET') return await listMedia(request, env, user);
    const contentMatch = url.pathname.match(/^\/api\/media\/([A-Za-z0-9-]{1,64})\/content$/);
    if (contentMatch && request.method === 'GET') return await readMedia(request, env, user, contentMatch[1]);
    return error(404, 'not_found');
  } catch (cause) {
    const name = typeof cause?.name === 'string' ? cause.name : 'unknown';
    console.error('[media] request failed', { errorName: name });
    return error(500, 'media_unavailable');
  }
}
