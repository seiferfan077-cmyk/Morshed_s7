const assert = require('node:assert/strict');
const { UserKeyOpenAICompatibleProvider, UserKeyGeminiProvider, providerErrorMessage } = require('../.tmp-byok-test/services/ai/byokAIService.js');
const originalFetch = global.fetch;

(async () => {
  const config = { providerId: 'custom', providerName: 'Custom', kind: 'openai-compatible', apiKey: 'secret-test-key', baseUrl: 'https://api.example.test/v1', model: 'test-model', apiUrl: '' };
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
  assert.match(request.url, /:generateContent$/);
  assert.equal(request.url.includes('secret-test-key'), false);
  assert.equal(request.options.headers['x-goog-api-key'], 'secret-test-key');
  assert.equal(request.body.contents[0].role, 'user');
  assert.equal('metadata' in request.body, false);

  global.fetch = async () => ({ ok: false, status: 401 });
  await assert.rejects(new UserKeyOpenAICompatibleProvider(config).sendMessage([{ role: 'user', content: 'test' }]), (error) => {
    assert.equal(providerErrorMessage(error), 'المزوّد رفض مفتاح API أو لا يملك صلاحية استخدام النموذج. تحقق من المفتاح والصلاحيات.');
    assert.equal(error.message.includes('secret-test-key'), false);
    return true;
  });
  global.fetch = async () => ({ ok: false, status: 429 });
  await assert.rejects(new UserKeyOpenAICompatibleProvider(config).sendMessage([{ role: 'user', content: 'test' }]), /Provider rate limit reached/);
  assert.match(providerErrorMessage(new Error('Provider rate limit reached')), /الرصيد/);
  global.fetch = originalFetch;
  console.log('BYOK provider tests passed');
})().catch((error) => { global.fetch = originalFetch; throw error; });
