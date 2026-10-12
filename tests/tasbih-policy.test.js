const assert = require('node:assert/strict');
const {
  TASBIH_TARGET,
  decrementTasbihCount,
  calculateRepeatIncrement,
  getNextFocusIndex,
  getRepeatStep,
  getTasbihProgressPercent,
  incrementTasbihCount,
  normalizeActiveTasbihId,
  normalizeTasbihCount,
  normalizeTasbihCounts,
  normalizeRepeatSettings,
  normalizeRepeatStep,
  normalizeFocusTarget,
  TASBIH_MAX_REPEAT_STEP,
  TASBIH_MAX_FOCUS_TARGET,
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

assert.equal(normalizeRepeatStep(0), 1);
assert.equal(normalizeRepeatStep(2.9), 2);
assert.equal(normalizeRepeatStep(TASBIH_MAX_REPEAT_STEP + 1), TASBIH_MAX_REPEAT_STEP);
assert.equal(normalizeFocusTarget(-1), 1);
assert.equal(normalizeFocusTarget(TASBIH_MAX_FOCUS_TARGET + 1), TASBIH_MAX_FOCUS_TARGET);
const repeatSettings = normalizeRepeatSettings({ scope: 'per-dhikr', sharedStep: 4, perDhikrSteps: { subhanAllah: 2, unknown: 9 }, focusTarget: 5 }, ['subhanAllah', 'alhamdulillah']);
assert.deepEqual(repeatSettings, { scope: 'per-dhikr', sharedStep: 4, perDhikrSteps: { subhanAllah: 2 }, focusTarget: 5 });
assert.equal(getRepeatStep(repeatSettings, 'subhanAllah'), 2);
assert.equal(getRepeatStep(repeatSettings, 'alhamdulillah'), 1);
assert.equal(calculateRepeatIncrement(3, 10, 2), 2);
assert.equal(calculateRepeatIncrement(9, 10, 5), 1);
assert.equal(calculateRepeatIncrement(0, 100, 5, 2), 2);
assert.equal(calculateRepeatIncrement(0, 100, 5, 0), 0);
assert.equal(getNextFocusIndex(0, 5), 1);
assert.equal(getNextFocusIndex(4, 5), null);

console.log('Tasbih counter policy tests passed');
