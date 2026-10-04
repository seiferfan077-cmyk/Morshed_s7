const assert = require('node:assert/strict');
const { UserKeyOpenAICompatibleProvider, UserKeyGeminiProvider } = require('../.tmp-byok-test/services/ai/byokAIService.js');

(async () => {
  const config = { providerId: 'custom', providerName: 'Custom', kind: 'openai-compatible', apiKey: 'secret-test-key', baseUrl: 'https://api.example.test/v1', model: 'test-model', apiUrl: '' };
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => { request = { url, options, body: JSON.parse(options.body) }; return { ok: true, async json() { return { choices: [{ message: { content: 'ok' } }] }; } }; };
  const reply = await new UserKeyOpenAICompatibleProvider(config).sendMessage([{ role: 'user', content: 'مرحبا' }], undefined, { memory: [{ id: 'm1', type: 'preference', content: 'المذاكرة صباحًا', importance: 'medium', tags: [] }] });
  assert.equal(reply.content, 'ok');
  assert.equal(request.url, 'https://api.example.test/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer secret-test-key');
  assert.equal('apiKey' in request.body, false);
  assert.equal(request.body.messages[0].role, 'system');
  assert.match(request.body.messages[0].content, /المذاكرة صباحًا/);

  const geminiConfig = { ...config, providerId: 'gemini', providerName: 'Google Gemini', kind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-test' };
  global.fetch = async (url, options) => { request = { url, options, body: JSON.parse(options.body) }; return { ok: true, async json() { return { candidates: [{ content: { parts: [{ text: 'gemini ok' }] } }] }; } }; };
  const geminiReply = await new UserKeyGeminiProvider(geminiConfig).sendMessage([{ role: 'user', content: 'مرحبا' }]);
  assert.equal(geminiReply.content, 'gemini ok');
  assert.match(request.url, /:generateContent\?key=secret-test-key$/);
  assert.equal(request.body.contents[0].role, 'user');
  global.fetch = originalFetch;
  console.log('BYOK provider tests passed');
})().catch((error) => { global.fetch = originalFetch; throw error; });
