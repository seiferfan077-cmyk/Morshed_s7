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
