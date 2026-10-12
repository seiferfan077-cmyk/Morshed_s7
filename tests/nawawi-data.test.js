const assert = require('node:assert/strict');
const data = require('../src/data/nawawi-forty.json');

assert.equal(data.hadiths.length, 42);
assert.equal(new Set(data.hadiths.map((item) => item.index)).size, 42);
for (const item of data.hadiths) {
  assert.ok(item.title);
  assert.ok(item.hadith);
  assert.ok(item.explanation);
}
console.log('Nawawi data integrity test passed (42 hadiths with text and explanation)');
