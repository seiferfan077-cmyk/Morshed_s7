const assert = require('node:assert/strict');
const { BackendAIProvider, selectAIProvider } = require('../.tmp-byok-test/services/ai/aiService.js');
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
  global.fetch = async (url, options) => { request = { url, options, body: JSON.parse(options.body) }; return { ok: true, async json() { return { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'gemini ok' }] }] }; } }; };
  const geminiReply = await new UserKeyGeminiProvider(geminiConfig).sendMessage(
    [{ role: 'assistant', content: 'أهلًا' }, { role: 'user', content: 'مرحبا' }],
    undefined,
    { memory: [{ id: 'm1', type: 'preference', content: 'أفضل الإجابات المختصرة', importance: 'medium', tags: [] }], activeGoals: ['إنهاء المشروع'] },
  );
  assert.equal(geminiReply.content, 'gemini ok');
  assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(request.url.includes('secret-test-key'), false);
  assert.equal(request.options.headers['x-goog-api-key'], 'secret-test-key');
  assert.equal(request.body.input.length, 1);
  assert.equal(request.body.input[0].type, 'user_input');
  assert.equal(request.body.input[0].content[0].text, 'مرحبا');
  assert.match(request.body.system_instruction, /أفضل الإجابات المختصرة/);
  assert.match(request.body.system_instruction, /إنهاء المشروع/);
  assert.equal(request.body.store, false);
  assert.equal('apiKey' in request.body, false);

  global.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return { ok: true, async json() { return { role: 'assistant', content: 'backend ok' }; } };
  };
  const backendReply = await new BackendAIProvider('https://murshid.example/', async () => 'firebase-id-token').sendMessage([{ role: 'user', content: 'مرحبا' }]);
  assert.equal(backendReply.content, 'backend ok');
  assert.equal(request.url, 'https://murshid.example/api/ai/chat');
  assert.equal(request.options.headers.Authorization, 'Bearer firebase-id-token');
  assert.equal(request.body.messages[0].content, 'مرحبا');

  const personalProvider = new UserKeyOpenAICompatibleProvider(config);
  const preferredProvider = selectAIProvider('https://murshid.example', async () => 'firebase-id-token', personalProvider);
  assert.ok(preferredProvider instanceof BackendAIProvider, 'configured backend must be the default even when a personal key exists');
  assert.equal(selectAIProvider(undefined, undefined, personalProvider), personalProvider, 'personal provider is only a fallback when backend is not configured');

  global.fetch = async () => ({ ok: false, status: 401 });
  await assert.rejects(new UserKeyOpenAICompatibleProvider(config).sendMessage([{ role: 'user', content: 'test' }]), (error) => {
    assert.equal(providerErrorMessage(error), 'المزوّد رفض مفتاح API أو لا يملك صلاحية استخدام النموذج. تحقق من المفتاح والصلاحيات.');
    assert.equal(error.message.includes('secret-test-key'), false);
    return true;
  });
  global.fetch = async () => ({ ok: false, status: 429 });
  await assert.rejects(new UserKeyOpenAICompatibleProvider(config).sendMessage([{ role: 'user', content: 'test' }]), /Provider rate limit reached/);
  assert.match(providerErrorMessage(new Error('Provider rate limit reached')), /الرصيد/);
  assert.match(providerErrorMessage(new Error('Murshid backend request failed (401): unauthorized')), /جلسة المستخدم/);
  global.fetch = originalFetch;
  console.log('BYOK provider tests passed');
})().catch((error) => { global.fetch = originalFetch; throw error; });
