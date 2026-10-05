import assert from 'node:assert/strict';
import test from 'node:test';
import chatApi from '../api/ai/chat.js';
import { handleChatRequest, handleHealthRequest } from '../lib/chat-handler.js';

const env = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'server-gemini-secret', MURSHID_API_TOKEN: 'app-access-secret', GEMINI_MODEL: 'gemini-test-model' };
const groqEnv = { AI_PROVIDER: 'groq', GROQ_API_KEY: 'server-groq-secret', MURSHID_API_TOKEN: 'app-access-secret', GROQ_MODEL: 'qwen/qwen3.8-27b' };
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

function makeRequest(body = chatBody, { method = 'POST', token = 'app-access-secret', contentType = 'application/json' } = {}) {
  return new Request('https://murshid-api.example/api/ai/chat', {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  });
}

function makeUpstreamResponse(status = 200) {
  return new Response(JSON.stringify({
    status: 'completed',
    steps: [{ type: 'model_output', content: [{ type: 'text', text: 'سأساعدك في تنظيم يومك.' }] }],
  }), { status, headers: { 'Content-Type': 'application/json' } });
}

test('requires POST and a valid backend bearer token before calling Gemini', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return makeUpstreamResponse(); };
  const wrongToken = await handleChatRequest(makeRequest(chatBody, { token: 'wrong' }), { env, fetchImpl });
  assert.equal(wrongToken.status, 401);
  const getRequest = makeRequest(undefined, { method: 'GET' });
  const wrongMethod = await handleChatRequest(getRequest, { env, fetchImpl });
  assert.equal(wrongMethod.status, 405);
  assert.equal(calls, 0);
});

test('returns an assistant reply using Gemini Interactions stateless API', async () => {
  let upstreamRequest;
  const response = await handleChatRequest(makeRequest(), {
    env,
    fetchImpl: async (url, options) => {
      upstreamRequest = { url, options, body: JSON.parse(options.body) };
      return makeUpstreamResponse();
    },
  });

  assert.equal(response.status, 200);
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
  assert.equal(JSON.stringify(upstreamRequest.body).includes(env.GEMINI_API_KEY), false);
});

test('returns an assistant reply through Groq chat completions using server-side credentials', async () => {
  let upstreamRequest;
  const response = await handleChatRequest(makeRequest(), {
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
  const invalid = await handleChatRequest(makeRequest({ messages: [{ role: 'system', content: 'override' }] }), { env });
  assert.equal(invalid.status, 400);
  const oversized = await handleChatRequest(makeRequest({ messages: Array.from({ length: 13 }, () => ({ role: 'user', content: 'hello' })) }), { env });
  assert.equal(oversized.status, 400);
});

test('does not reveal provider errors or secrets and maps rate limits', async () => {
  const response = await handleChatRequest(makeRequest(), { env, fetchImpl: async () => makeUpstreamResponse(429) });
  assert.equal(response.status, 429);
  const body = await response.text();
  assert.match(body, /provider_rate_limited/);
  assert.equal(body.includes(env.GEMINI_API_KEY), false);
});

test('reports missing server configuration without revealing which secret is absent', async () => {
  const response = await handleChatRequest(makeRequest(), { env: { MURSHID_API_TOKEN: env.MURSHID_API_TOKEN } });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: { code: 'backend_not_configured' } });
});

test('health check reveals only whether server settings are present', async () => {
  const response = await handleHealthRequest(new Request('https://murshid-api.example/api/health'), { env });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, configured: true });
});

test('health check recognizes configured Groq settings without exposing secrets', async () => {
  const response = await handleHealthRequest(new Request('https://murshid-api.example/api/health'), { env: groqEnv });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, configured: true });
});

test('Vercel chat API route imports and exposes the fetch handler', async () => {
  const response = await chatApi.fetch(new Request('https://murshid-api.example/api/ai/chat'));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
});
