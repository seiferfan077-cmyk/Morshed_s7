export const DAILY_NOTIFICATION_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function isDailyNotificationDue(lastSentAt: number | null, now: number): boolean {
  if (lastSentAt === null || !Number.isFinite(lastSentAt)) return true;
  return now - lastSentAt >= DAILY_NOTIFICATION_INTERVAL_MS;
}
