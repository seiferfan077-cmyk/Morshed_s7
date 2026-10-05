import test from 'node:test';
import assert from 'node:assert/strict';
import healthApi from '../api/health.js';

test('Vercel adapter exposes a Node handler and preserves the fetch handler', async () => {
  assert.equal(typeof healthApi, 'function');
  assert.equal(typeof healthApi.fetch, 'function');

  const body = [];
  const response = {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { body.push(value); },
  };

  await healthApi({ method: 'GET', url: '/api/health', headers: { host: 'localhost' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(JSON.parse(body.join('')), { ok: true, configured: false });
});
