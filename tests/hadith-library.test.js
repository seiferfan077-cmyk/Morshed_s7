const assert = require('node:assert/strict');
const library = require('../src/data/hadith-library.json');
const nawawi = require('../src/data/nawawi-forty.json');

assert.equal(library.collections.length, 12);
assert.ok(library.collections.some((item) => item.id === 'bukhari'));
assert.ok(library.collections.some((item) => item.id === 'muslim'));
assert.ok(library.collections.some((item) => item.id === 'nawawi' && item.availability === 'متاح محليًا'));
for (const collection of library.collections) {
  assert.ok(collection.title && collection.url && collection.note);
}
assert.equal(nawawi.hadiths.length, 42);
assert.ok(nawawi.hadiths.every((item) => item.title && item.hadith && item.explanation));
console.log('Hadith library integrity test passed (12 catalogued collections, 42 local hadiths)');
