// A personal progress goal requested for the counter; it is not a prescribed religious count.
export const TASBIH_TARGET = 10_000;

export function normalizeTasbihCount(value: unknown, target = TASBIH_TARGET): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const safeTarget = Number.isFinite(target) ? Math.max(0, Math.trunc(target)) : TASBIH_TARGET;
  return Math.min(safeTarget, Math.max(0, Math.trunc(value)));
}

export function incrementTasbihCount(value: unknown, target = TASBIH_TARGET): number {
  const safeTarget = Number.isFinite(target) ? Math.max(0, Math.trunc(target)) : TASBIH_TARGET;
  return Math.min(safeTarget, normalizeTasbihCount(value, safeTarget) + 1);
}

export function decrementTasbihCount(value: unknown, target = TASBIH_TARGET): number {
  return Math.max(0, normalizeTasbihCount(value, target) - 1);
}

export function normalizeTasbihCounts(value: unknown, validIds: readonly string[], target = TASBIH_TARGET): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(validIds.map((id) => [id, 0]));
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return counts;

  const storedCounts = value as Record<string, unknown>;
  for (const id of validIds) counts[id] = normalizeTasbihCount(storedCounts[id], target);
  return counts;
}

export function normalizeActiveTasbihId(value: unknown, validIds: readonly string[]): string {
  return typeof value === 'string' && validIds.includes(value) ? value : (validIds[0] ?? '');
}

export function getTasbihProgressPercent(count: unknown, target = TASBIH_TARGET): number {
  const safeTarget = Number.isFinite(target) ? Math.max(1, Math.trunc(target)) : TASBIH_TARGET;
  return Math.round((normalizeTasbihCount(count, safeTarget) / safeTarget) * 100);
}

export const TASBIH_MAX_REPEAT_STEP = 1_000;
export const TASBIH_DEFAULT_FOCUS_TARGET = 5;
export const TASBIH_MAX_FOCUS_TARGET = 100;

export type TasbihRepeatScope = 'all' | 'per-dhikr';
export type TasbihRepeatSettings = {
  scope: TasbihRepeatScope;
  sharedStep: number;
  perDhikrSteps: Record<string, number>;
  focusTarget: number;
};

export function normalizeRepeatStep(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.min(TASBIH_MAX_REPEAT_STEP, Math.max(1, Math.trunc(value)));
}

export function normalizeFocusTarget(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return TASBIH_DEFAULT_FOCUS_TARGET;
  return Math.min(TASBIH_MAX_FOCUS_TARGET, Math.max(1, Math.trunc(value)));
}

export function normalizeRepeatSettings(value: unknown, validIds: readonly string[]): TasbihRepeatSettings {
  const raw = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawSteps = raw.perDhikrSteps !== null && typeof raw.perDhikrSteps === 'object' && !Array.isArray(raw.perDhikrSteps)
    ? raw.perDhikrSteps as Record<string, unknown>
    : {};
  const perDhikrSteps: Record<string, number> = {};
  for (const id of validIds) {
    if (Object.prototype.hasOwnProperty.call(rawSteps, id)) perDhikrSteps[id] = normalizeRepeatStep(rawSteps[id]);
  }
  return {
    scope: raw.scope === 'per-dhikr' ? 'per-dhikr' : 'all',
    sharedStep: normalizeRepeatStep(raw.sharedStep),
    perDhikrSteps,
    focusTarget: normalizeFocusTarget(raw.focusTarget),
  };
}

export function getRepeatStep(settings: TasbihRepeatSettings, dhikrId: string): number {
  return settings.scope === 'all'
    ? settings.sharedStep
    : normalizeRepeatStep(settings.perDhikrSteps[dhikrId] ?? 1);
}

export function calculateRepeatIncrement(count: unknown, target: number, step: unknown, sessionRemaining?: number): number {
  const safeTarget = Number.isFinite(target) ? Math.max(0, Math.trunc(target)) : TASBIH_TARGET;
  const remaining = Math.max(0, safeTarget - normalizeTasbihCount(count, safeTarget));
  const safeStep = Math.min(normalizeRepeatStep(step), remaining);
  if (sessionRemaining === undefined) return safeStep;
  const safeSessionRemaining = Number.isFinite(sessionRemaining) ? Math.max(0, Math.trunc(sessionRemaining)) : 0;
  return Math.min(safeStep, safeSessionRemaining);
}

export function getNextFocusIndex(currentIndex: number, queueLength: number): number | null {
  const safeLength = Number.isFinite(queueLength) ? Math.max(0, Math.trunc(queueLength)) : 0;
  const safeIndex = Number.isFinite(currentIndex) ? Math.trunc(currentIndex) : -1;
  return safeIndex >= 0 && safeIndex + 1 < safeLength ? safeIndex + 1 : null;
}
