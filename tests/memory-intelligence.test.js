const assert = require('node:assert/strict');
const { extractMemoryCandidates } = require('../.tmp-memory-test/services/memory/memoryExtractor.js');
const { retrieveRelevantMemories } = require('../.tmp-memory-test/services/memory/memoryRetrieval.js');

const candidates = extractMemoryCandidates('أنا أفضل المذاكرة صباحًا');
assert.equal(candidates.length, 1);
assert.equal(candidates[0].type, 'preference');
assert.equal(candidates[0].status, 'pending');

const now = new Date().toISOString();
const memories = [
  { id: '1', userId: 'local-user', type: 'preference', content: 'المذاكرة صباحًا', source: 'user', createdAt: now, updatedAt: now, confidence: 1, importance: 'medium', sensitivity: 'normal', consent: 'accepted', tags: ['preference'] },
  { id: '2', userId: 'local-user', type: 'goal', content: 'تعلم الرسم', source: 'user', createdAt: now, updatedAt: now, confidence: 1, importance: 'low', sensitivity: 'normal', consent: 'accepted', tags: ['goal'] },
];
assert.equal(retrieveRelevantMemories('كيف أنظم المذاكرة صباحًا؟', memories, 3).at(0).id, '1');
assert.equal(retrieveRelevantMemories('موضوع بلا صلة', memories, 3).length, 0);
console.log('memory intelligence smoke tests passed');
