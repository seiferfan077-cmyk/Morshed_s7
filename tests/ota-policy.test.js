const assert = require('node:assert/strict');
const { classifyUpdate, canPublish } = require('../.tmp-ota-test/releases/updatePolicy');
const { evaluateReleaseHealth, shouldStopRollout } = require('../.tmp-ota-test/monitoring/updateMonitor');

const event = (status, runtimeVersion = '0.1.1') => ({
  releaseId: 'release-1',
  status,
  runtimeVersion,
  createdAt: new Date().toISOString(),
});

const ota = classifyUpdate({ changesNative: false, changesJavaScript: true, changesRemoteContent: false, channel: 'production' });
assert.deepEqual(ota, {
  updateClass: 'ota',
  channel: 'production',
  requiresNativeBuild: false,
  reason: 'تغيير JavaScript/TypeScript متوافق مع runtimeVersion؛ يحتاج EAS Update بعد الاختبار.',
});

const native = classifyUpdate({ changesNative: true, changesJavaScript: true, changesRemoteContent: false, channel: 'preview' });
assert.equal(native.updateClass, 'native');
assert.equal(native.requiresNativeBuild, true);
assert.equal(native.channel, null);
assert.equal(canPublish('approved', native).allowed, false);
assert.equal(canPublish('review', ota).allowed, false);
assert.equal(canPublish('approved', ota).allowed, true);

const healthy = evaluateReleaseHealth([event('applied'), event('applied'), event('failed')], '0.1.1');
assert.equal(healthy.applied, 2);
assert.equal(healthy.failed, 1);
assert.equal(healthy.failureRate, 1 / 3);
assert.equal(healthy.recommendation, 'rollback');
assert.equal(shouldStopRollout(healthy), true);

const paused = evaluateReleaseHealth([event('applied'), event('failed')], '0.1.1');
assert.equal(paused.failureRate, 0.5);
assert.equal(paused.status, 'rolled_back');

const compatible = evaluateReleaseHealth([event('downloaded'), event('applied')], '0.1.1');
assert.equal(compatible.compatible, true);
assert.equal(compatible.recommendation, 'continue');
assert.equal(shouldStopRollout(compatible), false);

const incompatible = evaluateReleaseHealth([event('applied', '0.1.0')], '0.1.1');
assert.equal(incompatible.compatible, false);
assert.equal(incompatible.recommendation, 'rollback');

console.log('OTA policy and rollout health tests passed');
