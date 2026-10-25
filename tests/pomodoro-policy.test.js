const assert = require('node:assert/strict');
const test = require('node:test');
const { cancelPomodoroTimer, createPomodoroTimer, formatPomodoroTime, getPomodoroRemainingMs, parsePomodoroCommand, pausePomodoroTimer, resumePomodoroTimer } = require('../.tmp-pomodoro-test/pomodoro/pomodoroPolicy.js');

test('recognizes an explicit Arabic Pomodoro request and Arabic-Indic duration', () => {
  assert.deepEqual(parsePomodoroCommand('ابدأ جلسة Pomodoro لمدة ٢٥ دقيقة'), { kind: 'start', durationMs: 25 * 60_000 });
});

test('uses the 25-minute default only for a clear start request', () => {
  assert.deepEqual(parsePomodoroCommand('أنا عايزك تعمل جلسة بومودورو'), { kind: 'start', durationMs: 25 * 60_000 });
  assert.equal(parsePomodoroCommand('ما هي تقنية Pomodoro؟'), null);
  assert.equal(parsePomodoroCommand('قرأت عن مؤقت التركيز'), null);
});

test('accepts hours plus minutes and common half-hour wording', () => {
  assert.deepEqual(parsePomodoroCommand('شغّل مؤقت تركيز لمدة ساعة و٢٥ دقيقة'), { kind: 'start', durationMs: 85 * 60_000 });
  assert.deepEqual(parsePomodoroCommand('ابدأ بومودورو لمدة ساعة ونصف'), { kind: 'start', durationMs: 90 * 60_000 });
  assert.deepEqual(parsePomodoroCommand('ابدأ Pomodoro لمدة نصف ساعة'), { kind: 'start', durationMs: 30 * 60_000 });
});

test('rejects durations outside the supported 1-to-180 minute range', () => {
  assert.deepEqual(parsePomodoroCommand('ابدأ Pomodoro لمدة ٠ دقيقة'), { kind: 'invalid-duration' });
  assert.deepEqual(parsePomodoroCommand('ابدأ Pomodoro لمدة ٤ ساعات'), { kind: 'invalid-duration' });
});

test('counts down against absolute time and supports pause and resume', () => {
  const started = createPomodoroTimer(60_000, 1_000);
  assert.equal(getPomodoroRemainingMs(started, 11_000), 50_000);
  const paused = pausePomodoroTimer(started, 11_000);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.remainingMs, 50_000);
  const resumed = resumePomodoroTimer(paused, 20_000);
  assert.equal(resumed.endsAt, 70_000);
  assert.equal(getPomodoroRemainingMs(resumed, 25_000), 45_000);
  assert.equal(cancelPomodoroTimer(resumed).status, 'cancelled');
});

test('formats zero and minute/second values for the timer card', () => {
  assert.equal(formatPomodoroTime(1_501), '00:02');
  assert.equal(formatPomodoroTime(60_000), '01:00');
  assert.equal(formatPomodoroTime(0), '00:00');
});
