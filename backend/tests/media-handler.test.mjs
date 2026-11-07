import assert from 'node:assert/strict';
import test from 'node:test';
import { handleMediaRequest } from '../lib/media-handler.js';

const verify = async (token) => ({ uid: token === 'other-token' ? 'user-2' : 'user-1' });
const baseEnv = { FIREBASE_PROJECT_ID: 'test-project' };

function request(path, { method = 'GET', token = 'test-token', body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (token) requestHeaders.authorization = `Bearer ${token}`;
  return new Request(`https://example.test${path}`, { method, headers: requestHeaders, body });
}

function fakeDb() {
  const records = [];
  return {
    records,
    prepare(sql) {
      let values = [];
      const statement = {
        bind(...parameters) { values = parameters; return statement; },
        async first() {
          if (sql.includes('client_media_id = ?')) return records.find((row) => row.owner_uid === values[0] && row.client_media_id === values[1]) ?? null;
          if (sql.includes('id = ?')) return records.find((row) => row.owner_uid === values[0] && row.id === values[1]) ?? null;
          return null;
        },
        async all() {
          const [uid, limit, offset] = values;
          const rows = records.filter((row) => row.owner_uid === uid).sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id));
          return { results: rows.slice(offset, offset + limit) };
        },
        async run() {
          if (sql.startsWith('INSERT INTO user_media_objects')) {
            const [id, owner_uid, client_media_id, object_key, filename, media_type, content_type, size, created_at] = values;
            if (records.some((row) => row.owner_uid === owner_uid && row.client_media_id === client_media_id)) throw new Error('unique_constraint');
            records.push({ id, owner_uid, client_media_id, object_key, filename, media_type, content_type, size, created_at });
          }
          return { success: true };
        },
      };
      return statement;
    },
  };
}

function fakeBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, stream, options) {
      const bytes = Buffer.from(await new Response(stream).arrayBuffer());
      objects.set(key, { bytes, options });
      return { key, size: bytes.length };
    },
    async get(key) {
      const stored = objects.get(key);
      if (!stored) return null;
      return {
        body: new Blob([stored.bytes]).stream(),
        size: stored.bytes.length,
        httpEtag: '"test-etag"',
        writeHttpMetadata(headers) { headers.set('Content-Type', stored.options.httpMetadata.contentType); },
      };
    },
    async delete(key) { objects.delete(key); },
  };
}

function envWithStorage(db = fakeDb(), bucket = fakeBucket()) {
  return { ...baseEnv, CHANNEL_DB: db, MEDIA_BUCKET: bucket };
}

function uploadRequest({ clientId = 'vault-item-1', filename = 'photo.jpg', contentType = 'image/jpeg', bytes = [255, 216, 255, 217], token = 'test-token', declaredLength } = {}) {
  const body = new Uint8Array(bytes);
  return request('/api/media', {
    method: 'POST', token, body,
    headers: {
      'content-length': String(declaredLength ?? body.byteLength),
      'content-type': 'application/octet-stream',
      'x-client-media-id': clientId,
      'x-media-filename': encodeURIComponent(filename),
      'x-media-type': contentType,
    },
  });
}

test('media endpoints reject missing or invalid Firebase identity', async () => {
  const missing = await handleMediaRequest(request('/api/media', { token: null }), envWithStorage(), verify);
  const invalid = await handleMediaRequest(uploadRequest(), envWithStorage(), async () => null);
  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
});

test('media endpoints fail closed when R2, D1, or Firebase project settings are missing', async () => {
  const response = await handleMediaRequest(request('/api/media'), { ...baseEnv, CHANNEL_DB: fakeDb() }, verify);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: { code: 'media_storage_not_configured' } });
});

test('uploads are stored under the authenticated UID and return no storage key', async () => {
  const env = envWithStorage();
  const response = await handleMediaRequest(uploadRequest({ filename: 'صورة 1.jpg' }), env, verify);
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.media.filename, 'صورة 1.jpg');
  assert.equal(body.media.type, 'image');
  assert.equal(body.media.size, 4);
  assert.equal(body.alreadyUploaded, false);
  assert.equal(env.MEDIA_BUCKET.objects.size, 1);
  assert.ok([...env.MEDIA_BUCKET.objects.keys()][0].startsWith('users/user-1/media/'));
  assert.equal(JSON.stringify(body).includes('object_key'), false);
  assert.equal(JSON.stringify(body).includes('users/user-1'), false);
});

test('repeated uploads with the same per-user local media ID are idempotent', async () => {
  const env = envWithStorage();
  const first = await handleMediaRequest(uploadRequest(), env, verify);
  const second = await handleMediaRequest(uploadRequest(), env, verify);
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal((await second.json()).alreadyUploaded, true);
  assert.equal(env.MEDIA_BUCKET.objects.size, 1);
  assert.equal(env.CHANNEL_DB.records.length, 1);
});

test('unsupported media types and oversized files are rejected before writing to R2', async () => {
  const env = envWithStorage();
  const unsupported = await handleMediaRequest(uploadRequest({ contentType: 'application/pdf' }), env, verify);
  const oversized = await handleMediaRequest(request('/api/media', {
    method: 'POST', body: new Uint8Array([1]),
    headers: { 'content-length': '95000001', 'x-client-media-id': 'large-video', 'x-media-filename': 'large.mp4', 'x-media-type': 'video/mp4' },
  }), env, verify);
  assert.equal(unsupported.status, 415);
  assert.equal(oversized.status, 413);
  assert.equal(env.MEDIA_BUCKET.objects.size, 0);
});

test('uploads reject mismatched actual length and false image signatures before storing data', async () => {
  const env = envWithStorage();
  const wrongLength = await handleMediaRequest(uploadRequest({ declaredLength: 3 }), env, verify);
  const falseImage = await handleMediaRequest(uploadRequest({ clientId: 'forged-image', bytes: [0, 1, 2, 3] }), env, verify);
  assert.equal(wrongLength.status, 400);
  assert.deepEqual(await wrongLength.json(), { error: { code: 'content_length_mismatch' } });
  assert.equal(falseImage.status, 415);
  assert.deepEqual(await falseImage.json(), { error: { code: 'media_content_mismatch' } });
  assert.equal(env.MEDIA_BUCKET.objects.size, 0);
  assert.equal(env.CHANNEL_DB.records.length, 0);
});

test('listing and downloads are scoped to the Firebase UID and downloads stay private', async () => {
  const env = envWithStorage();
  const uploaded = await handleMediaRequest(uploadRequest(), env, verify);
  const mediaId = (await uploaded.json()).media.id;
  const listResponse = await handleMediaRequest(request('/api/media'), env, verify);
  const listBody = await listResponse.json();
  assert.equal(listBody.media.length, 1);
  assert.equal(listBody.media[0].contentPath, `/api/media/${mediaId}/content`);

  const denied = await handleMediaRequest(request(`/api/media/${mediaId}/content`, { token: 'other-token' }), env, verify);
  assert.equal(denied.status, 404);
  assert.deepEqual(await denied.json(), { error: { code: 'media_not_found' } });

  const downloaded = await handleMediaRequest(request(`/api/media/${mediaId}/content`), env, verify);
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get('cache-control'), 'private, no-store');
  assert.equal(downloaded.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(downloaded.headers.get('content-disposition')?.includes('attachment'), true);
  assert.deepEqual([...new Uint8Array(await downloaded.arrayBuffer())], [255, 216, 255, 217]);
});
