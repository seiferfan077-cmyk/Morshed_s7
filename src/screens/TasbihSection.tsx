import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { RuqaaText as Text } from '../components/RuqaaText';
import { SurfaceCard } from '../components/SurfaceCard';
import { radii, spacing, ThemeColors, typography } from '../theme';
import {
  decrementTasbihCount,
  getTasbihProgressPercent,
  incrementTasbihCount,
  normalizeActiveTasbihId,
  normalizeTasbihCounts,
  TASBIH_TARGET,
} from '../services/tasbih/tasbihPolicy';

type DhikrPreset = { id: string; name: string; text: string };

const STORAGE_KEY = '@murshid/tasbih-progress:v1';
const DHIKR_PRESETS: DhikrPreset[] = [
  { id: 'subhanAllah', name: 'التسبيح', text: 'سُبْحَانَ اللهِ' },
  { id: 'alhamdulillah', name: 'التحميد', text: 'الْحَمْدُ لِلَّهِ' },
  { id: 'allahuAkbar', name: 'التكبير', text: 'اللَّهُ أَكْبَرُ' },
  { id: 'istighfar', name: 'الاستغفار', text: 'أَسْتَغْفِرُ اللهَ' },
  { id: 'tawheed', name: 'التوحيد', text: 'لَا إِلَهَ إِلَّا اللهُ' },
];
const DHIKR_IDS = DHIKR_PRESETS.map((item) => item.id);

function formatArabicCount(value: number) {
  return value.toLocaleString('en-US')
    .replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
    .replace(/,/g, '٬');
}

export function TasbihSection({ colors }: { colors: ThemeColors }) {
  const styles = createStyles(colors);
  const [activeId, setActiveId] = useState(DHIKR_IDS[0]);
  const [counts, setCounts] = useState<Record<string, number>>(() => normalizeTasbihCounts({}, DHIKR_IDS));
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const activeDhikr = DHIKR_PRESETS.find((item) => item.id === activeId) ?? DHIKR_PRESETS[0];
  const count = counts[activeDhikr.id] ?? 0;
  const progress = getTasbihProgressPercent(count);
  const targetReached = count >= TASBIH_TARGET;

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        const saved = JSON.parse(raw) as { activeId?: unknown; counts?: unknown };
        setCounts(normalizeTasbihCounts(saved?.counts, DHIKR_IDS));
        setActiveId(normalizeActiveTasbihId(saved?.activeId, DHIKR_IDS));
      })
      .catch(() => { if (mounted) setStorageError(true); })
      .finally(() => { if (mounted) setHydrated(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    let mounted = true;
    const timeout = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ activeId, counts }))
        .then(() => { if (mounted) setStorageError(false); })
        .catch(() => { if (mounted) setStorageError(true); });
    }, 250);
    return () => { mounted = false; clearTimeout(timeout); };
  }, [activeId, counts, hydrated]);

  const addOne = () => {
    if (!hydrated || targetReached) return;
    setConfirmReset(false);
    setCounts((current) => ({ ...current, [activeDhikr.id]: incrementTasbihCount(current[activeDhikr.id]) }));
  };

  const removeOne = () => {
    setConfirmReset(false);
    setCounts((current) => ({ ...current, [activeDhikr.id]: decrementTasbihCount(current[activeDhikr.id]) }));
  };

  const resetActiveDhikr = () => {
    setCounts((current) => ({ ...current, [activeDhikr.id]: 0 }));
    setConfirmReset(false);
  };

  return (
    <SurfaceCard accent={colors.amber}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="sparkles-outline" size={21} color={colors.tealDark} /></View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>السبحة الإلكترونية</Text>
          <Text style={styles.detail}>اختر ذكرًا؛ لكل ذكر عدّاد مستقل محفوظ على هذا الجهاز.</Text>
        </View>
      </View>

      <View style={styles.presetList}>
        {DHIKR_PRESETS.map((item) => {
          const selected = item.id === activeDhikr.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`اختيار ${item.name}`}
              onPress={() => { setActiveId(item.id); setConfirmReset(false); }}
              style={({ pressed }) => [styles.preset, selected && styles.presetSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.presetText, selected && styles.presetTextSelected]}>{item.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.dhikrText}>{activeDhikr.text}</Text>
      <Text style={styles.goalText}>الهدف: {formatArabicCount(TASBIH_TARGET)} تسبيحة لهذا الذكر</Text>

      <View style={styles.counterArea}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`إضافة تسبيحة إلى ${activeDhikr.name}. العدد الحالي ${formatArabicCount(count)} من ${formatArabicCount(TASBIH_TARGET)}`}
          accessibilityHint="اضغط مرة واحدة لإضافة تسبيحة واحدة."
          disabled={!hydrated || targetReached}
          onPress={addOne}
          style={({ pressed }) => [styles.counterButton, (!hydrated || targetReached) && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.counterValue}>{formatArabicCount(count)}</Text>
          <Text style={styles.counterCaption}>{!hydrated ? 'جارٍ استعادة العداد' : targetReached ? 'اكتمل الهدف' : 'اضغط للتسبيح'}</Text>
        </Pressable>
      </View>

      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>التقدم</Text>
        <Text style={styles.progressValue}>{formatArabicCount(count)} / {formatArabicCount(TASBIH_TARGET)} · {formatArabicCount(progress)}٪</Text>
      </View>
      <View accessibilityLabel={`التقدم ${formatArabicCount(progress)} بالمئة`} style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="تصحيح العداد بإنقاص تسبيحة واحدة"
          disabled={!hydrated || count === 0}
          onPress={removeOne}
          style={({ pressed }) => [styles.actionButton, (!hydrated || count === 0) && styles.disabled, pressed && styles.pressed]}
        >
          <Ionicons name="remove-outline" size={18} color={colors.tealDark} />
          <Text style={styles.actionText}>تصحيح −١</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`إعادة عدّاد ${activeDhikr.name}`}
          disabled={!hydrated || count === 0}
          onPress={() => setConfirmReset(true)}
          style={({ pressed }) => [styles.actionButton, (!hydrated || count === 0) && styles.disabled, pressed && styles.pressed]}
        >
          <Ionicons name="refresh-outline" size={17} color={colors.tealDark} />
          <Text style={styles.actionText}>إعادة هذا الذكر</Text>
        </Pressable>
      </View>

      {confirmReset ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>إعادة عدّاد {activeDhikr.name} إلى الصفر؟</Text>
          <Pressable accessibilityRole="button" onPress={resetActiveDhikr} style={styles.confirmButton}><Text style={styles.confirmButtonText}>تأكيد</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setConfirmReset(false)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>إلغاء</Text></Pressable>
        </View>
      ) : null}

      {storageError ? <Text style={styles.errorText}>تعذر حفظ التقدم على هذا الجهاز.</Text> : null}
      {!hydrated ? <ActivityIndicator style={styles.spinner} size="small" color={colors.tealDark} /> : null}
    </SurfaceCard>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
    headerCopy: { flex: 1 },
    title: { ...typography.label, color: colors.ink },
    detail: { ...typography.body, color: colors.inkMuted, marginTop: 4 },
    presetList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
    preset: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingVertical: 7, paddingHorizontal: spacing.sm },
    presetSelected: { backgroundColor: colors.tealSoft, borderColor: colors.tealDark },
    presetText: { ...typography.label, color: colors.inkMuted, fontSize: 11 },
    presetTextSelected: { color: colors.tealDark },
    dhikrText: { ...typography.h2, color: colors.ink, textAlign: 'center', lineHeight: 34, marginTop: spacing.lg },
    goalText: { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.xs },
    counterArea: { alignItems: 'center', marginTop: spacing.md },
    counterButton: { width: 170, height: 150, borderRadius: 52, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center', padding: spacing.md, ...{ elevation: 3 } },
    counterValue: { ...typography.display, color: colors.paper, fontSize: 43, lineHeight: 55 },
    counterCaption: { ...typography.label, color: colors.paper, fontSize: 13, marginTop: 1 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm },
    progressLabel: { ...typography.label, color: colors.inkMuted },
    progressValue: { ...typography.label, color: colors.tealDark, fontSize: 11 },
    progressTrack: { height: 8, borderRadius: radii.pill, backgroundColor: colors.tealSoft, overflow: 'hidden', marginTop: spacing.xs },
    progressFill: { height: '100%', backgroundColor: colors.tealDark, borderRadius: radii.pill },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    actionButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing.xs },
    actionText: { ...typography.label, color: colors.tealDark, fontSize: 11 },
    confirmRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
    confirmText: { ...typography.body, color: colors.ink, flexGrow: 1, flexBasis: '100%' },
    confirmButton: { borderRadius: radii.md, backgroundColor: colors.tealDark, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
    confirmButtonText: { ...typography.label, color: colors.paper },
    cancelButton: { borderRadius: radii.md, backgroundColor: colors.surface, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
    cancelButtonText: { ...typography.label, color: colors.inkMuted },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
    errorText: { ...typography.body, color: colors.danger, marginTop: spacing.sm },
    spinner: { marginTop: spacing.sm },
  });
}
