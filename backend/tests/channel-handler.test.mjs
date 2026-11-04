import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker.js';
import { handleChannelRequest, handleChannelAdminRequest } from '../lib/channel-handler.js';
import { sendChannelPostNotifications } from '../lib/channel-push.js';

const baseEnv = {
  FIREBASE_PROJECT_ID: 'test-project',
  CHANNEL_OWNER_TEMP_PASSWORD: 'test-owner-password',
};
const verify = async () => ({ uid: 'user-1' });
const request = (path, method = 'GET', body, token = 'token', extraHeaders = {}) => new Request(`https://example.test${path}`, {
  method,
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...extraHeaders },
  body: body === undefined ? undefined : JSON.stringify(body),
});

function fakeDb({ first, all, runs = [], runError } = {}) {
  return {
    runs,
    prepare(sql) {
      let values = [];
      const statement = {
        bind(...parameters) { values = parameters; return statement; },
        async first() { return first ? first(sql, values) : null; },
        async all() { return all ? all(sql, values) : { results: [] }; },
        async run() {
          if (runError) throw runError;
          runs.push({ sql, values });
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
    async batch() { return []; },
  };
}

test('channel routes reject unauthenticated users', async () => {
  const response = await worker.fetch(new Request('https://example.test/api/channel/feed'), { ...baseEnv, CHANNEL_DB: fakeDb() });
  assert.equal(response.status, 401);
});

test('channel routes require D1 configuration', async () => {
  const response = await handleChannelRequest(request('/api/channel/feed'), { ...baseEnv, CHANNEL_DB: undefined }, verify);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: { code: 'channel_not_configured' } });
});

test('the configured temporary password opens the admin panel without creating a server session', async () => {
  const response = await handleChannelAdminRequest(request('/api/channel/admin/login', 'POST', { password: 'test-owner-password' }), baseEnv, verify);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, role: 'owner' });
});
test('an incorrect temporary password cannot open the admin panel', async () => {
  const response = await handleChannelAdminRequest(request('/api/channel/admin/login', 'POST', { password: 'wrong-password' }), baseEnv, verify);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: { code: 'invalid_admin_password' } });
});
test('the configured password verifies stored local access without a server-side session', async () => {
  const response = await handleChannelAdminRequest(request('/api/channel/admin/access', 'GET', undefined, 'token', { 'x-channel-admin-password': 'test-owner-password' }), baseEnv, verify);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, role: 'owner' });
});
test('the configured temporary password can publish a post', async () => {
  const db = fakeDb();
  const response = await handleChannelAdminRequest(request('/api/channel/admin/posts', 'POST', { body: 'رسالة من المسؤول' }, 'token', { 'x-channel-admin-password': 'test-owner-password' }), { ...baseEnv, CHANNEL_DB: db }, verify);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).post.body, 'رسالة من المسؤول');
  assert.ok(db.runs.some(({ sql }) => sql.includes('INSERT INTO channel_posts')));
  assert.equal(db.runs.some(({ sql }) => sql.includes('channel_admin_sessions')), false);
});
test('publishing is rejected if the temporary password header is missing or wrong', async () => {
  const db = fakeDb();
  const missing = await handleChannelRequest(request('/api/channel/posts', 'POST', { body: 'محاولة نشر' }), { ...baseEnv, CHANNEL_DB: db }, verify);
  const wrong = await handleChannelRequest(request('/api/channel/posts', 'POST', { body: 'محاولة نشر' }, 'token', { 'x-channel-admin-password': 'wrong-password' }), { ...baseEnv, CHANNEL_DB: db }, verify);
  assert.equal(missing.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(db.runs.some(({ sql }) => sql.includes('INSERT INTO channel_posts')), false);
});
test('admin login fails closed when the temporary password secret is not configured', async () => {
  const response = await handleChannelAdminRequest(request('/api/channel/admin/login', 'POST', { password: 'test-owner-password' }), { FIREBASE_PROJECT_ID: 'test-project' }, verify);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: { code: 'channel_admin_password_not_configured' } });
});
test('device registration requires a valid Expo push token and stores it in D1', async () => {
  const db = fakeDb();
  const invalid = await handleChannelRequest(request('/api/channel/devices', 'POST', { token: 'not-a-push-token' }), { ...baseEnv, CHANNEL_DB: db }, verify);
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { error: { code: 'invalid_push_token' } });

  const valid = await handleChannelRequest(request('/api/channel/devices', 'POST', { token: 'ExpoPushToken[abcdefghijk123456]' }), { ...baseEnv, CHANNEL_DB: db }, verify);
  assert.equal(valid.status, 201);
  assert.ok(db.runs.some(({ sql }) => sql.includes('INSERT INTO channel_devices')));
});

test('feed returns a stable cursor for loading older messages', async () => {
  const rows = [
    { id: 'post-2', body: 'الأحدث', created_at: 200, updated_at: 200 },
    { id: 'post-1', body: 'الأقدم', created_at: 100, updated_at: 100 },
  ];
  const db = fakeDb({ all: (_sql, values) => ({ results: rows.slice(0, values.at(-1)) }) });
  const response = await handleChannelRequest(request('/api/channel/feed?limit=1'), { ...baseEnv, CHANNEL_DB: db }, verify);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.posts.length, 1);
  assert.equal(body.nextCursor.createdAt, 200);
  assert.equal(body.nextCursor.id, 'post-2');
});

test('channel publish notifications are sent to every registered Expo device', async () => {
  const tokens = ['ExpoPushToken[abcdefghijk123456]', 'ExponentPushToken[zyxwvutsrq987654]'];
  const db = fakeDb({ all: (sql) => sql.includes('channel_devices') ? { results: tokens.map((token) => ({ token })) } : { results: [] } });
  let posted;
  const result = await sendChannelPostNotifications({ CHANNEL_DB: db, EXPO_ACCESS_TOKEN: 'test-access-token' }, { id: 'post-1', body: 'تحديث جديد', created_at: 1 }, async (_url, init) => {
    posted = { headers: init.headers, messages: JSON.parse(init.body) };
    return new Response(JSON.stringify({ data: [{ status: 'ok' }, { status: 'ok' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  assert.equal(result.sent, 2);
  assert.equal(posted.headers.Authorization, 'Bearer test-access-token');
  assert.equal(posted.messages[0].data.route, 'channel');
  assert.equal(posted.messages[1].to, tokens[1]);
});
