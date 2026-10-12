const assert = require('node:assert/strict');
const {
  DEFAULT_DAILY_DUA_SETTINGS,
  normalizeDailyDuaSettings,
  formatDailyDuaTime,
} = require('../.tmp-dua-test/dailyDuaPolicy');

assert.deepEqual(normalizeDailyDuaSettings(null), DEFAULT_DAILY_DUA_SETTINGS);
assert.deepEqual(normalizeDailyDuaSettings('{invalid json'), DEFAULT_DAILY_DUA_SETTINGS);
assert.deepEqual(
  normalizeDailyDuaSettings({ enabled: true, hour: 0, minute: 59 }),
  { enabled: true, hour: 0, minute: 59 },
  'valid boundary values should be retained',
);
assert.deepEqual(
  normalizeDailyDuaSettings({ enabled: 1, hour: 24, minute: -1 }),
  { enabled: false, hour: 8, minute: 0 },
  'invalid persisted values should fall back safely',
);
assert.deepEqual(
  normalizeDailyDuaSettings({ enabled: true, hour: 8.5, minute: '15' }),
  { enabled: true, hour: 8, minute: 0 },
  'fractional and string time values should not be accepted',
);
assert.equal(formatDailyDuaTime(8, 5), '08:05');
assert.equal(formatDailyDuaTime(0, 0), '00:00');
assert.equal(formatDailyDuaTime(25, 61), '08:00', 'invalid time input should recover to the default');

console.log('Daily dua notification policy tests passed');
