const assert = require('node:assert/strict');
const Module = require('node:module');

const store = new Map();
const asyncStorageMock = {
  async getItem(key) { return store.has(key) ? store.get(key) : null; },
  async setItem(key, value) { store.set(key, value); },
  async removeItem(key) { store.delete(key); },
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') return { default: asyncStorageMock, ...asyncStorageMock };
  return originalLoad.call(this, request, parent, isMain);
};

const { LocalMemoryProvider } = require('../.tmp-memory-test/services/memory/memoryService.js');
const { extractMemoryCandidates } = require('../.tmp-memory-test/services/memory/memoryExtractor.js');
const { assembleContext } = require('../.tmp-memory-test/services/memory/contextAssembly.js');
const { BackendAIProvider } = require('../.tmp-memory-test/services/ai/aiService.js');
const provider = new LocalMemoryProvider();

const message = (content) => [{ role: 'user', content }];

(async () => {
  await provider.clear();
  const settings = await provider.getSettings();

  // 1) Candidate appears, but nothing is persisted until approval.
  const preference = extractMemoryCandidates('أنا أفضل المذاكرة صباحًا')[0];
  await provider.saveCandidate(preference);
  assert.equal((await provider.list()).length, 0);
  assert.equal((await provider.listCandidates()).length, 1);

  // 2) Approval persists it and a related question retrieves it.
  const approved = await provider.approveCandidate(preference.id);
  assert.equal(approved.content, 'المذاكرة صباحًا');
  assert.equal((await provider.retrieve('كيف أنظم المذاكرة صباحًا؟')).at(0).id, approved.id);

  // 3) A conflicting preference proposes update and does not create a duplicate.
  const correction = extractMemoryCandidates('أنا أفضل المذاكرة مساءً')[0];
  await provider.saveCandidate(correction);
  const correctionCandidate = (await provider.listCandidates())[0];
  assert.equal(correctionCandidate.suggestedAction, 'update');
  assert.deepEqual(correctionCandidate.conflictIds, [approved.id]);
  const updated = await provider.approveCandidate(correction.id);
  assert.equal(updated.id, approved.id);
  assert.equal((await provider.list()).length, 1);
  assert.equal((await provider.list())[0].content, 'المذاكرة مساءً');

  // 4) Temporary context gets an expiration instead of becoming permanent.
  const temporary = extractMemoryCandidates('حاليًا عندي ضغط امتحانات')[0];
  assert.ok(temporary.suggestedExpiration);
  await provider.saveCandidate(temporary);
  const temporaryItem = await provider.approveCandidate(temporary.id);
  assert.ok(temporaryItem.expiration);

  // 5) Rejected candidate is neither stored nor retrievable.
  const rejected = extractMemoryCandidates('أحب مشاهدة الأفلام')[0];
  await provider.saveCandidate(rejected);
  await provider.rejectCandidate(rejected.id);
  assert.equal((await provider.listCandidates()).some((item) => item.id === rejected.id), false);
  assert.equal((await provider.retrieve('الأفلام التي أحبها')).some((item) => item.content.includes('الأفلام')), false);

  // 6) Disabled memory blocks both candidate storage and retrieval.
  await provider.saveSettings({ ...settings, enabled: false });
  const disabledCandidate = extractMemoryCandidates('أنا أفضل القهوة')[0];
  await provider.saveCandidate(disabledCandidate);
  assert.equal((await provider.listCandidates()).length, 0);
  assert.equal((await provider.retrieve('القهوة')).length, 0);
  await provider.saveSettings(settings);

  // 7) Deleted memory cannot enter a later Context Package.
  const itemsBeforeDelete = await provider.list();
  for (const item of itemsBeforeDelete) await provider.remove(item.id);
  const afterDelete = assembleContext('كيف أنظم المذاكرة مساءً؟', message('رسالة'), await provider.list());
  assert.equal(afterDelete.relevantMemories.length, 0);

  // 8) Context is bounded, relevant, and minimized.
  const contextMemory = { id: 'm-context', userId: 'local-user', type: 'preference', content: 'المذاكرة صباحًا', source: 'user', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), confidence: 1, importance: 'medium', sensitivity: 'normal', consent: 'accepted', tags: ['preference'] };
  await provider.save(contextMemory);
  const twelvePlusMessages = Array.from({ length: 20 }, (_, index) => ({ role: 'user', content: `رسالة ${index}` }));
  const context = assembleContext('المذاكرة صباحًا', twelvePlusMessages, await provider.list());
  assert.equal(context.conversation.length, 12);
  assert.equal(context.relevantMemories.length, 1);
  assert.equal('userId' in context.relevantMemories[0], false);
  assert.equal('sensitivity' in context.relevantMemories[0], false);
  assert.equal('source' in context.relevantMemories[0], false);

  const disabledMemoryContext = assembleContext('المذاكرة صباحًا', [], [contextMemory], [], [], { enabled: false, retrievalEnabled: true });
  const disabledRetrievalContext = assembleContext('المذاكرة صباحًا', [], [contextMemory], [], [], { enabled: true, retrievalEnabled: false });
  assert.equal(disabledMemoryContext.relevantMemories.length, 0);
  assert.equal(disabledRetrievalContext.relevantMemories.length, 0);

  // 9) Unrelated, sensitive, and low-confidence memories are excluded.
  const unrelated = { ...contextMemory, id: 'm-unrelated', content: 'تعلم الرسم', type: 'goal' };
  const sensitive = { ...contextMemory, id: 'm-sensitive', content: 'المذاكرة صباحًا', sensitivity: 'sensitive' };
  const lowConfidence = { ...contextMemory, id: 'm-low', content: 'المذاكرة صباحًا', confidence: 0.3 };
  const unrelatedContext = assembleContext('ما حالة الطقس اليوم؟', [], [unrelated, sensitive, lowConfidence]);
  assert.equal(unrelatedContext.relevantMemories.length, 0);

  // 10) Backend integration sends the bounded conversation and minimized memory shape only.
  const originalFetch = global.fetch;
  let capturedBody;
  global.fetch = async (_url, options) => { capturedBody = JSON.parse(options.body); return { ok: true, async json() { return { role: 'assistant', content: 'ok' }; } }; };
  await new BackendAIProvider('https://backend.invalid').sendMessage(context.conversation, undefined, { conversationId: 'conversation-1', memory: context.relevantMemories });
  assert.equal(capturedBody.conversationId, 'conversation-1');
  assert.equal(capturedBody.messages.length, 12);
  assert.equal('userId' in capturedBody.memory[0], false);
  assert.equal('sensitivity' in capturedBody.memory[0], false);
  assert.equal('source' in capturedBody.memory[0], false);
  global.fetch = originalFetch;

  console.log('real-world memory validation integration tests passed');
})().finally(() => { Module._load = originalLoad; });
