import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker.js';
import { handleChannelRequest, handleChannelAdminRequest } from '../lib/channel-handler.js';
import { sendChannelPostNotifications } from '../lib/channel-push.js';

const baseEnv = {
  FIREBASE_PROJECT_ID: 'test-project',
  CHANNEL_OWNER_TEMP_PASSWORD: 'owner-temp',
  CHANNEL_ADMIN_TEMP_PASSWORD: 'admin-temp',
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

test('admin bootstrap rejects a password different from the server-only temporary secret', async () => {
  const response = await handleChannelAdminRequest(request('/api/channel/admin/bootstrap', 'POST', { role: 'owner', password: 'wrong' }), { ...baseEnv, CHANNEL_DB: fakeDb() }, verify);
  assert.equal(response.status, 401);
});

test('both owner and admin bootstrap require setting a permanent password', async () => {
  const response = await handleChannelAdminRequest(request('/api/channel/admin/bootstrap', 'POST', { role: 'admin', password: 'admin-temp' }), { ...baseEnv, CHANNEL_DB: fakeDb() }, async () => ({ uid: 'admin-1' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, role: 'admin', requiresPasswordChange: true });
});

test('permanent owner password is hashed before it is stored', async () => {
  const db = fakeDb({ first: (sql) => sql.includes('FROM channel_admins') ? { uid: 'user-1', role: 'owner', bootstrap_used: 0 } : null });
  const response = await handleChannelAdminRequest(request('/api/channel/admin/password', 'POST', { password: 'long-test-password', confirmation: 'long-test-password' }), { ...baseEnv, CHANNEL_DB: db }, verify);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const update = db.runs.find(({ sql }) => sql.startsWith('UPDATE channel_admins SET password_hash'));
  assert.ok(update);
  assert.equal(update.values[3], 'user-1');
  assert.equal(update.values[0].length, 64);
  assert.notEqual(update.values[0], 'long-test-password');
});

test('password hash exceptions expose only a safe error class', async () => {
  const db = fakeDb({ first: (sql) => sql.includes('FROM channel_admins') ? { uid: 'user-1', role: 'owner', bootstrap_used: 0 } : null });
  const originalImportKey = crypto.subtle.importKey;
  const originalError = console.error;
  const logs = [];
  crypto.subtle.importKey = async () => {
    const caught = new Error('synthetic-crypto-detail');
    caught.name = 'NotSupportedError';
    throw caught;
  };
  console.error = (...args) => logs.push(args);
  let response;
  try {
    response = await handleChannelAdminRequest(request('/api/channel/admin/password', 'POST', { password: 'long-test-password', confirmation: 'long-test-password' }), { ...baseEnv, CHANNEL_DB: db }, verify);
  } finally {
    crypto.subtle.importKey = originalImportKey;
    console.error = originalError;
  }
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: { code: 'password_hash_failed_not_supported' } });
  assert.deepEqual(logs[0][1], { stage: 'password_hash', errorName: 'NotSupportedError' });
  assert.equal(JSON.stringify(logs).includes('synthetic-crypto-detail'), false);
});

test('password storage exceptions return a safe stage diagnostic without exception text', async () => {
  const db = fakeDb({
    first: (sql) => sql.includes('FROM channel_admins') ? { uid: 'user-1', role: 'owner', bootstrap_used: 0 } : null,
    runError: new Error('synthetic-database-detail'),
  });
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  let response;
  try {
    response = await handleChannelAdminRequest(request('/api/channel/admin/password', 'POST', { password: 'long-test-password', confirmation: 'long-test-password' }), { ...baseEnv, CHANNEL_DB: db }, verify);
  } finally {
    console.error = originalError;
  }
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: { code: 'password_storage_failed' } });
  assert.deepEqual(logs[0][1], { stage: 'password_update', errorName: 'Error' });
  assert.equal(JSON.stringify(logs).includes('synthetic-database-detail'), false);
});

test('a passwordless Firebase user cannot publish even if the UID has an admin record', async () => {
  const db = fakeDb({ first: (sql) => sql.includes('FROM channel_admins') ? { uid: 'user-1', role: 'owner', bootstrap_used: 1, locked_until: 0 } : null });
  const response = await handleChannelRequest(request('/api/channel/posts', 'POST', { body: 'محاولة نشر' }), { ...baseEnv, CHANNEL_DB: db }, verify);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: { code: 'admin_session_required' } });
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
