const assert = require('node:assert/strict');
const {
  TASBIH_TARGET,
  decrementTasbihCount,
  getTasbihProgressPercent,
  incrementTasbihCount,
  normalizeActiveTasbihId,
  normalizeTasbihCount,
  normalizeTasbihCounts,
} = require('../.tmp-tasbih-test/tasbihPolicy.js');

assert.equal(TASBIH_TARGET, 10_000);
assert.equal(normalizeTasbihCount(-5), 0);
assert.equal(normalizeTasbihCount(7.9), 7);
assert.equal(normalizeTasbihCount(Number.POSITIVE_INFINITY), 0);
assert.equal(normalizeTasbihCount(12_345), 10_000);
assert.equal(incrementTasbihCount(9_999), 10_000);
assert.equal(incrementTasbihCount(10_000), 10_000);
assert.equal(decrementTasbihCount(1), 0);
assert.equal(decrementTasbihCount(4), 3);
assert.deepEqual(
  normalizeTasbihCounts({ subhanAllah: 21.8, alhamdulillah: 10_500, unknown: 88 }, ['subhanAllah', 'alhamdulillah']),
  { subhanAllah: 21, alhamdulillah: 10_000 },
);
assert.equal(normalizeActiveTasbihId('unknown', ['subhanAllah', 'alhamdulillah']), 'subhanAllah');
assert.equal(normalizeActiveTasbihId('alhamdulillah', ['subhanAllah', 'alhamdulillah']), 'alhamdulillah');
assert.equal(getTasbihProgressPercent(2_500), 25);
assert.equal(getTasbihProgressPercent(10_000), 100);

console.log('Tasbih counter policy tests passed');
