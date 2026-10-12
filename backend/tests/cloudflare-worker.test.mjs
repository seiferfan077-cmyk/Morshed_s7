import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker.js';

const configuredEnv = {
  AI_PROVIDER: 'gemini',
  GEMINI_API_KEY: 'test-only-secret',
  GEMINI_MODEL: 'gemini-test-model',
  FIREBASE_PROJECT_ID: 'murshid-test-project',
};

function request(path, method = 'GET', body) {
  return new Request(`https://murshid-api.example${path}`, {
    method,
    ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
}

test('Cloudflare health endpoint reports configuration presence only', async () => {
  const response = await worker.fetch(request('/api/health'), configuredEnv);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, configured: true });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('Cloudflare health endpoint reports missing settings without exposing values', async () => {
  const response = await worker.fetch(request('/api/health'), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, configured: false });
});

test('Cloudflare chat endpoint requires an authenticated Firebase user', async () => {
  const response = await worker.fetch(
    request('/api/ai/chat', 'POST', { messages: [{ role: 'user', content: 'hello' }] }),
    configuredEnv,
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: { code: 'unauthorized' } });
});

test('Cloudflare chat endpoint returns method errors and unknown routes safely', async () => {
  const wrongMethod = await worker.fetch(request('/api/ai/chat'), configuredEnv);
  assert.equal(wrongMethod.status, 405);
  const missing = await worker.fetch(request('/'), configuredEnv);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: { code: 'not_found' } });
});
