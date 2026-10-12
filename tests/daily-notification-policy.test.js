const assert = require('node:assert/strict');
const {
  DAILY_NOTIFICATION_INTERVAL_MS,
  isDailyNotificationDue,
} = require('../.tmp-notification-test/dailyNotificationPolicy');

const now = 2_000_000_000_000;
assert.equal(isDailyNotificationDue(null, now), true, 'first eligible open should send');
assert.equal(isDailyNotificationDue(Number.NaN, now), true, 'invalid stored timestamp should recover');
assert.equal(
  isDailyNotificationDue(now - DAILY_NOTIFICATION_INTERVAL_MS + 1, now),
  false,
  'must not send before the full 24-hour interval',
);
assert.equal(
  isDailyNotificationDue(now - DAILY_NOTIFICATION_INTERVAL_MS, now),
  true,
  'should send on the first open exactly 24 hours later',
);
assert.equal(
  isDailyNotificationDue(now + 60_000, now),
  false,
  'a future timestamp caused by clock adjustment should not cause duplicate notices',
);

console.log('Daily notification policy tests passed');
