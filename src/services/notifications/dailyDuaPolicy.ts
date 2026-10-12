export type DailyDuaSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
};

export const DEFAULT_DAILY_DUA_SETTINGS: DailyDuaSettings = {
  enabled: false,
  hour: 8,
  minute: 0,
};

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function normalizeDailyDuaSettings(value: unknown): DailyDuaSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ...DEFAULT_DAILY_DUA_SETTINGS };
  }

  const candidate = value as Partial<DailyDuaSettings>;
  return {
    enabled: candidate.enabled === true,
    hour: isIntegerInRange(candidate.hour, 0, 23) ? candidate.hour : DEFAULT_DAILY_DUA_SETTINGS.hour,
    minute: isIntegerInRange(candidate.minute, 0, 59) ? candidate.minute : DEFAULT_DAILY_DUA_SETTINGS.minute,
  };
}

export function formatDailyDuaTime(hour: number, minute: number): string {
  const safeTime = normalizeDailyDuaSettings({ enabled: false, hour, minute });
  return `${String(safeTime.hour).padStart(2, '0')}:${String(safeTime.minute).padStart(2, '0')}`;
}
