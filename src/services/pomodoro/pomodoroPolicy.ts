export type PomodoroStatus = 'running' | 'paused' | 'completed' | 'cancelled';

export interface PomodoroTimer {
  durationMs: number;
  endsAt: number | null;
  remainingMs: number;
  status: PomodoroStatus;
}

export type PomodoroCommand =
  | { kind: 'start'; durationMs: number }
  | { kind: 'invalid-duration' };

export const DEFAULT_POMODORO_MINUTES = 25;
export const MIN_POMODORO_MINUTES = 1;
export const MAX_POMODORO_MINUTES = 180;

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/خمسة\s+وعشرين/gi, '25')
    .replace(/خمسه\s+وعشرين/gi, '25')
    .replace(/نصف\s+ساعة|نص\s+ساعة|نص\s+ساعه/gi, '30 دقيقة')
    .replace(/ربع\s+ساعة|ربع\s+ساعه/gi, '15 دقيقة');
}

function hasStartIntent(text: string) {
  return /(?:^|\s)(?:ابدأ|ابدا|ابدء|شغل|شغّل|اعمل|اعملي|جهز|جهّز|start|begin|run)(?:\s|$)/i.test(text)
    || /(?:عايزك|عاوزك|عايز|عاوز|ممكن)\s+(?:تعمل|تشغل|تبدأ|تبدء|ابدأ|ابدا|تجهز)/i.test(text)
    || /خلينا\s+(?:نعمل|نبدأ|نبدء|نشغل)/i.test(text);
}

function hasPomodoroIntent(text: string) {
  return /pomodoro|بومودورو|مؤق(?:ت|ّ?ت)(?:\s+تركيز)?|جلسة\s+تركيز/i.test(text);
}

function parseRequestedMinutes(text: string) {
  const normalized = normalizeDigits(text.toLowerCase());
  const hourMatches = [...normalized.matchAll(/(\d+)\s*(?:ساعة|ساعات|ساعه|hour|hours|hrs?|h)(?![a-z])/gi)];
  const minuteMatches = [...normalized.matchAll(/(\d+)\s*(?:دقيقة|دقائق|دقيقه|دقايق|minute|minutes|mins?|m)(?![a-z])/gi)];
  let hours = hourMatches.reduce((sum, match) => sum + Number(match[1]) * 60, 0);
  const minutePart = minuteMatches.reduce((sum, match) => sum + Number(match[1]), 0);
  if (hours === 0 && hourMatches.length === 0 && /(?:ساعة|ساعه|hour)/i.test(normalized)) hours = 60;
  let minutes = hours + minutePart;
  if (!hourMatches.length && !minuteMatches.length && hours === 0) return DEFAULT_POMODORO_MINUTES;
  if (minutes === 60 && /(?:ونصف|ونص)/i.test(normalized)) minutes += 30;
  if (minutes === 60 && /(?:وربع)/i.test(normalized)) minutes += 15;
  return minutes;
}

/** Returns null for ordinary mentions; only explicit start requests create a timer. */
export function parsePomodoroCommand(input: string): PomodoroCommand | null {
  const text = normalizeDigits(input.trim());
  if (!hasPomodoroIntent(text) || !hasStartIntent(text)) return null;
  const minutes = parseRequestedMinutes(text);
  if (!Number.isFinite(minutes) || minutes < MIN_POMODORO_MINUTES || minutes > MAX_POMODORO_MINUTES) {
    return { kind: 'invalid-duration' };
  }
  return { kind: 'start', durationMs: minutes * 60_000 };
}

export function createPomodoroTimer(durationMs: number, now = Date.now()): PomodoroTimer {
  return { durationMs, endsAt: now + durationMs, remainingMs: durationMs, status: 'running' };
}

export function getPomodoroRemainingMs(timer: PomodoroTimer, now = Date.now()) {
  if (timer.status === 'running' && timer.endsAt !== null) return Math.max(0, timer.endsAt - now);
  return Math.max(0, timer.remainingMs);
}

export function pausePomodoroTimer(timer: PomodoroTimer, now = Date.now()): PomodoroTimer {
  if (timer.status !== 'running') return timer;
  const remainingMs = getPomodoroRemainingMs(timer, now);
  return { ...timer, endsAt: null, remainingMs, status: remainingMs > 0 ? 'paused' : 'completed' };
}

export function resumePomodoroTimer(timer: PomodoroTimer, now = Date.now()): PomodoroTimer {
  if (timer.status !== 'paused' || timer.remainingMs <= 0) return timer;
  return { ...timer, endsAt: now + timer.remainingMs, status: 'running' };
}

export function finishPomodoroTimer(timer: PomodoroTimer): PomodoroTimer {
  if (timer.status === 'completed' || timer.status === 'cancelled') return timer;
  return { ...timer, endsAt: null, remainingMs: 0, status: 'completed' };
}

export function cancelPomodoroTimer(timer: PomodoroTimer): PomodoroTimer {
  if (timer.status === 'completed' || timer.status === 'cancelled') return timer;
  return { ...timer, endsAt: null, remainingMs: 0, status: 'cancelled' };
}

export function formatPomodoroTime(milliseconds: number) {
  const totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
