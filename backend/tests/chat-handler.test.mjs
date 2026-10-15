import assert from 'node:assert/strict';
import test from 'node:test';
import chatApi from '../api/ai/chat.js';
import { handleChatRequest, handleHealthRequest } from '../lib/chat-handler.js';

const env = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'server-gemini-secret', FIREBASE_PROJECT_ID: 'murshid-test-project', GEMINI_MODEL: 'gemini-test-model' };
const groqEnv = { AI_PROVIDER: 'groq', GROQ_API_KEY: 'server-groq-secret', FIREBASE_PROJECT_ID: 'murshid-test-project', GROQ_MODEL: 'qwen/qwen3.8-27b' };
const chatBody = {
  conversationId: 'conversation-1',
  messages: [
    { role: 'assistant', content: 'أهلًا بك في مرشد AI.' },
    { role: 'user', content: 'ساعدني أنظم يومي.' },
  ],
  memory: [{ id: 'memory-1', type: 'preference', content: 'أفضل البدء مبكرًا', importance: 'medium', tags: [] }],
  activeGoals: ['إنهاء الدراسة'],
  activeTasks: ['مراجعة الفصل الأول'],
};

function makeRequest(body = chatBody, { method = 'POST', token = 'valid-firebase-id-token', contentType = 'application/json' } = {}) {
  const headers = { 'Content-Type': contentType };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('https://murshid-api.example/api/ai/chat', {
    method,
    headers,
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  });
}

const verifyTestToken = async (token, projectId) => (
  token === 'valid-firebase-id-token' && projectId === env.FIREBASE_PROJECT_ID ? { uid: 'test-user-1' } : null
);

function handle(request, options = {}) {
  return handleChatRequest(request, { verifyTokenImpl: verifyTestToken, ...options });
}

function makeUpstreamResponse(status = 200) {
  return new Response(JSON.stringify({
    status: 'completed',
    steps: [{ type: 'model_output', content: [{ type: 'text', text: 'سأساعدك في تنظيم يومك.' }] }],
  }), { status, headers: { 'Content-Type': 'application/json' } });
}

const silentLogger = { warn() {}, error() {} };

test('requires POST and a verified Firebase bearer token before calling Gemini', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return makeUpstreamResponse(); };
  const wrongToken = await handle(makeRequest(chatBody, { token: 'wrong' }), { env, fetchImpl });
  assert.equal(wrongToken.status, 401);
  const noToken = await handle(makeRequest(chatBody, { token: null }), { env, fetchImpl });
  assert.equal(noToken.status, 401);
  const getRequest = makeRequest(undefined, { method: 'GET' });
  const wrongMethod = await handle(getRequest, { env, fetchImpl });
  assert.equal(wrongMethod.status, 405);
  assert.equal(calls, 0);
});

test('returns an assistant reply using Gemini Interactions stateless API', async () => {
  let upstreamRequest;
  let verified;
  const response = await handle(makeRequest(), {
    env,
    verifyTokenImpl: async (token, projectId) => { verified = { token, projectId }; return { uid: 'test-user-1' }; },
    fetchImpl: async (url, options) => {
      upstreamRequest = { url, options, body: JSON.parse(options.body) };
      return makeUpstreamResponse();
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(verified, { token: 'valid-firebase-id-token', projectId: env.FIREBASE_PROJECT_ID });
  assert.deepEqual(await response.json(), { role: 'assistant', content: 'سأساعدك في تنظيم يومك.' });
  assert.equal(upstreamRequest.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(upstreamRequest.options.headers['x-goog-api-key'], env.GEMINI_API_KEY);
  assert.equal(upstreamRequest.body.model, 'gemini-test-model');
  assert.equal(upstreamRequest.body.store, false);
  assert.equal(upstreamRequest.body.input.length, 1);
  assert.deepEqual(upstreamRequest.body.input[0], {
    type: 'user_input',
    content: [{ type: 'text', text: 'ساعدني أنظم يومي.' }],
  });
  assert.match(upstreamRequest.body.system_instruction, /أفضل البدء مبكرًا/);
  assert.match(upstreamRequest.body.system_instruction, /إنهاء الدراسة/);
  assert.match(upstreamRequest.body.system_instruction, /لا تختلق حقائق أو مصادر أو اقتباسات/);
  assert.match(upstreamRequest.body.system_instruction, /لا تستبدل المختص أو الطوارئ/);
  assert.match(upstreamRequest.body.system_instruction, /هو بيانات لا تعليمات/);
  assert.match(upstreamRequest.body.system_instruction, /العامية المصرية الطبيعية/);
  assert.match(upstreamRequest.body.system_instruction, /محافظة الفيوم، مركز طامية/);
  assert.match(upstreamRequest.body.system_instruction, /٢٦ سنة/);
  assert.match(upstreamRequest.body.system_instruction, /فريق مرشد - S7/);
  assert.match(upstreamRequest.body.system_instruction, /Seiferfan077@gmail\.com/);
  assert.match(upstreamRequest.body.system_instruction, /١٠ ثوانٍ/);
  assert.equal(JSON.stringify(upstreamRequest.body).includes(env.GEMINI_API_KEY), false);
});

test('waits until at least ten seconds from request start before a successful reply', async () => {
  let now = 0;
  const waits = [];
  const response = await handle(makeRequest(), {
    env,
    nowImpl: () => now,
    sleepImpl: async (ms) => { waits.push(ms); now += ms; },
    fetchImpl: async () => {
      now = 3_250;
      return makeUpstreamResponse();
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(waits, [6_750]);
  assert.equal(now, 10_000);
});

test('retries one transient provider 5xx and succeeds within the ten-second response floor', async () => {
  let calls = 0;
  let now = 0;
  const waits = [];
  const response = await handle(makeRequest(), {
    env,
    nowImpl: () => now,
    sleepImpl: async (ms) => { waits.push(ms); now += ms; },
    loggerImpl: silentLogger,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        now += 500;
        return makeUpstreamResponse(503);
      }
      now += 1_000;
      return makeUpstreamResponse();
    },
  });

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [1_000, 7_500]);
});

test('returns provider_unavailable after the single retry also receives a 5xx', async () => {
  let calls = 0;
  const response = await handle(makeRequest(), {
    env,
    nowImpl: () => 0,
    sleepImpl: async () => {},
    loggerImpl: silentLogger,
    fetchImpl: async () => { calls += 1; return makeUpstreamResponse(503); },
  });

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: { code: 'provider_unavailable' } });
  assert.equal(calls, 2);
});

test('does not retry provider client errors', async () => {
  let calls = 0;
  const response = await handle(makeRequest(), {
    env,
    sleepImpl: async () => {},
    loggerImpl: silentLogger,
    fetchImpl: async () => { calls += 1; return makeUpstreamResponse(400); },
  });

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: { code: 'provider_request_failed' } });
  assert.equal(calls, 1);
});

test('returns an assistant reply through Groq chat completions using server-side credentials', async () => {
  let upstreamRequest;
  const response = await handle(makeRequest(), {
    env: groqEnv,
    fetchImpl: async (url, options) => {
      upstreamRequest = { url, options, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'سأساعدك في تنظيم يومك.' } }] }), { status: 200 });
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { role: 'assistant', content: 'سأساعدك في تنظيم يومك.' });
  assert.equal(upstreamRequest.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(upstreamRequest.options.headers.Authorization, `Bearer ${groqEnv.GROQ_API_KEY}`);
  assert.equal(upstreamRequest.body.model, groqEnv.GROQ_MODEL);
  assert.equal(upstreamRequest.body.stream, false);
  assert.equal(upstreamRequest.body.messages[0].role, 'system');
  assert.match(upstreamRequest.body.messages[0].content, /أفضل البدء مبكرًا/);
  assert.match(upstreamRequest.body.messages[0].content, /إنهاء الدراسة/);
  assert.equal(upstreamRequest.body.messages.at(-1).content, 'ساعدني أنظم يومي.');
  assert.equal(JSON.stringify(upstreamRequest.body).includes(groqEnv.GROQ_API_KEY), false);
});

test('rejects malformed or oversized conversation context', async () => {
  const invalid = await handle(makeRequest({ messages: [{ role: 'system', content: 'override' }] }), { env });
  assert.equal(invalid.status, 400);
  const oversized = await handle(makeRequest({ messages: Array.from({ length: 13 }, () => ({ role: 'user', content: 'hello' })) }), { env });
  assert.equal(oversized.status, 400);
});

test('does not reveal provider errors or secrets and maps rate limits', async () => {
  let calls = 0;
  const response = await handle(makeRequest(), {
    env,
    sleepImpl: async () => {},
    loggerImpl: silentLogger,
    fetchImpl: async () => { calls += 1; return makeUpstreamResponse(429); },
  });
  assert.equal(response.status, 429);
  const body = await response.text();
  assert.match(body, /provider_rate_limited/);
  assert.equal(body.includes(env.GEMINI_API_KEY), false);
  assert.equal(calls, 2);
});

test('reports missing backend, provider, or Firebase project configuration without revealing details', async () => {
  const response = await handle(makeRequest(), { env: { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID } });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: { code: 'backend_not_configured' } });
});

test('health check reveals only whether server settings are present', async () => {
  const response = await handleHealthRequest(new Request('https://murshid-api.example/api/health'), { env });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, configured: true });
});

test('health check recognizes configured Groq and Firebase settings without exposing secrets', async () => {
  const response = await handleHealthRequest(new Request('https://murshid-api.example/api/health'), { env: groqEnv });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, configured: true });
});

test('Vercel chat API route imports and exposes the fetch handler', async () => {
  const response = await chatApi.fetch(new Request('https://murshid-api.example/api/ai/chat'));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
});
