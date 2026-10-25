import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { RuqaaText as Text } from './RuqaaText';
import { cancelPomodoroTimer, finishPomodoroTimer, formatPomodoroTime, getPomodoroRemainingMs, pausePomodoroTimer, resumePomodoroTimer, type PomodoroTimer } from '../services/pomodoro/pomodoroPolicy';
import { useAppTheme } from '../theme/ThemeProvider';
import { spacing, typography } from '../theme';

type Props = { timer: PomodoroTimer; onChange: (timer: PomodoroTimer) => void };

export function PomodoroTimerCard({ timer, onChange }: Props) {
  const { colors: themeColors } = useAppTheme();
  const [now, setNow] = useState(timer.endsAt === null ? 0 : timer.endsAt - timer.durationMs);
  const completionHandled = useRef(false);
  const remainingMs = getPomodoroRemainingMs(timer, now);
  const progress = timer.status === 'cancelled' ? 0 : timer.durationMs > 0 ? Math.max(0, Math.min(1, 1 - remainingMs / timer.durationMs)) : 0;
  const completed = timer.status === 'completed' || (timer.status === 'running' && remainingMs <= 0);
  const styles = createStyles();

  useEffect(() => {
    if (timer.status !== 'running') {
      completionHandled.current = false;
      return undefined;
    }
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (timer.endsAt !== null && current >= timer.endsAt && !completionHandled.current) {
        completionHandled.current = true;
        onChange(finishPomodoroTimer(timer));
      }
    };
    tick();
    const interval = setInterval(tick, 1_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [timer, onChange]);

  const durationMinutes = Math.round(timer.durationMs / 60_000);
  const statusText = timer.status === 'cancelled' ? 'أُوقفت الجلسة' : completed ? 'أحسنت، انتهت جلسة التركيز' : timer.status === 'paused' ? 'المؤقت متوقف مؤقتًا' : 'خذ نفسًا وركّز على خطوة واحدة';

  return <View style={styles.card} accessibilityLabel={`مؤقت بومودورو، ${formatPomodoroTime(remainingMs)}`}>
    <View style={styles.header}>
      <View style={styles.icon}><Ionicons name="timer-outline" size={21} color={themeColors.tealDark} /></View>
      <View style={styles.copy}><Text style={styles.eyebrow}>جلسة تركيز</Text><Text style={styles.subtitle}>{statusText}</Text></View>
      <View style={styles.duration}><Text style={styles.durationText}>{durationMinutes} د</Text></View>
    </View>
    <Text style={styles.clock}>{timer.status === 'cancelled' ? '— — : — —' : formatPomodoroTime(remainingMs)}</Text>
    <View style={styles.progressTrack}><View style={[styles.progress, { width: `${progress * 100}%`, backgroundColor: completed ? themeColors.tealDark : '#59D9C9' }]} /></View>
    <View style={styles.controls}>
      {timer.status === 'running' ? <Pressable onPress={() => onChange(pausePomodoroTimer(timer))} accessibilityRole="button" accessibilityLabel="إيقاف المؤقت مؤقتًا" style={({ pressed }) => [styles.control, pressed && styles.pressed]}><Ionicons name="pause" size={17} color={themeColors.ink} /><Text style={styles.controlText}>إيقاف مؤقت</Text></Pressable> : timer.status === 'paused' ? <Pressable onPress={() => onChange(resumePomodoroTimer(timer))} accessibilityRole="button" accessibilityLabel="استئناف المؤقت" style={({ pressed }) => [styles.control, styles.resume, pressed && styles.pressed]}><Ionicons name="play" size={17} color="#08110F" /><Text style={[styles.controlText, styles.resumeText]}>استئناف</Text></Pressable> : null}
      {timer.status === 'running' || timer.status === 'paused' ? <Pressable onPress={() => onChange(cancelPomodoroTimer(timer))} accessibilityRole="button" accessibilityLabel="إيقاف جلسة التركيز" style={({ pressed }) => [styles.stop, pressed && styles.pressed]}><Text style={styles.stopText}>إيقاف الجلسة</Text></Pressable> : null}
    </View>
  </View>;
}

function createStyles() {
  return StyleSheet.create({
    card: { alignSelf: 'stretch', padding: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: '#24544E', backgroundColor: '#101B1C', marginTop: spacing.xs, marginBottom: spacing.xs },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#173632' },
    copy: { flex: 1 },
    eyebrow: { ...typography.label, fontSize: 14, color: '#EAF7F4', textAlign: 'right' },
    subtitle: { ...typography.body, fontSize: 11, color: '#92AAA7', textAlign: 'right', marginTop: 2 },
    duration: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#193532' },
    durationText: { ...typography.label, fontSize: 11, color: '#78DCCF' },
    clock: { ...typography.h1, fontSize: 38, lineHeight: 48, color: '#F1FAF8', textAlign: 'center', writingDirection: 'ltr', marginTop: spacing.xs },
    progressTrack: { height: 7, borderRadius: 8, overflow: 'hidden', backgroundColor: '#263735', marginTop: spacing.xs },
    progress: { height: '100%', borderRadius: 8 },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
    control: { minHeight: 38, paddingHorizontal: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1D2A2A', borderWidth: 1, borderColor: '#334442' },
    controlText: { ...typography.label, color: '#D7E6E3', fontSize: 12 },
    resume: { backgroundColor: '#59D9C9', borderColor: '#59D9C9' },
    resumeText: { color: '#08110F' },
    stop: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12 },
    stopText: { ...typography.label, color: '#9EAFAD', fontSize: 11 },
    pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  });
}
