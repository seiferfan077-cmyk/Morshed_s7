const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/tasbihTexts.json'), 'utf8'));
const ids = data.items.map((item) => item.id);
const postPrayer = data.items.filter((item) => item.category === 'أذكار بعد الصلاة المفروضة');
const categories = new Map(data.categories.map((category) => [category.id, category]));

assert.deepEqual(data.sourceCounts.map((source) => source.count), [121, 60, 85, 86]);
assert.equal(data.items.length, 353, '352 supplied entries plus one legacy tawheed preset');
assert.equal(new Set(ids).size, ids.length, 'every item id must be unique');
assert.equal(new Set(data.categories.map((category) => category.id)).size, data.categories.length);
assert.ok(data.items.every((item) => item.text.trim().length > 0));
assert.ok(data.items.every((item) => categories.has(item.categoryId)));
assert.ok(['subhanAllah', 'alhamdulillah', 'allahuAkbar', 'istighfar', 'tawheed'].every((id) => ids.includes(id)), 'legacy counter IDs remain available for migration');
assert.equal(postPrayer.length, 17, 'all post-prayer entries must be retained');
assert.equal(postPrayer.slice(0, 3).filter((item) => item.text.replace(/[.،\s]/g, '') === 'أستغفرالله').length, 3, 'the three istighfar repetitions stay visible');
assert.ok(categories.get(postPrayer[0].categoryId).note.includes('لا يفرض التطبيق عددًا شرعيًا'));
assert.ok(data.categories.some((category) => category.label === 'من دعاء آدم عليه السلام'));
console.log(`Tasbih data verified: ${data.items.length} entries across ${data.categories.length} categories.`);
