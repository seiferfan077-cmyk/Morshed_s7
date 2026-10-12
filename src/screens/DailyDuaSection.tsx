import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { SurfaceCard } from '../components/SurfaceCard';
import { radii, spacing, ThemeColors, typography } from '../theme';
import {
  DEFAULT_DAILY_DUA_SETTINGS,
  DailyDuaSettings,
  formatDailyDuaTime,
} from '../services/notifications/dailyDuaPolicy';
import { getDailyDuaSettings, saveDailyDuaSettings } from '../services/notifications/dailyDuaNotification';

type DailyDua = { title: string; reference: string; text: string };

const DAILY_DUAS: DailyDua[] = [
  {
    title: 'دعاء الخير في الدنيا والآخرة',
    reference: 'البقرة · ٢٠١',
    text: 'رَبَّنَآ ءَاتِنَا فِى ٱلدُّنْيَا حَسَنَةً وَفِى ٱلْـَٔاخِرَةِ حَسَنَةً وَقِنَا عَذَابَ ٱلنَّارِ',
  },
  {
    title: 'دعاء الثبات والرحمة',
    reference: 'آل عمران · ٨',
    text: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً ۚ إِنَّكَ أَنتَ ٱلْوَهَّابُ',
  },
  {
    title: 'دعاء موسى عليه السلام',
    reference: 'طه · ٢٥–٢٨',
    text: 'رَبِّ ٱشْرَحْ لِى صَدْرِى ۝ وَيَسِّرْ لِىٓ أَمْرِى ۝ وَٱحْلُلْ عُقْدَةً مِّن لِّسَانِى ۝ يَفْقَهُوا۟ قَوْلِى',
  },
  {
    title: 'دعاء ذي النون',
    reference: 'الأنبياء · ٨٧',
    text: 'لَّآ إِلَٰهَ إِلَّآ أَنتَ سُبْحَـٰنَكَ إِنِّى كُنتُ مِنَ ٱلظَّـٰلِمِينَ',
  },
  {
    title: 'دعاء صلاح الأهل والذرية',
    reference: 'الفرقان · ٧٤',
    text: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَٰجِنَا وَذُرِّيَّـٰتِنَا قُرَّةَ أَعْيُنٍ وَٱجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا',
  },
  {
    title: 'تسبيح يومي',
    reference: 'ذكر مختار · ١٠٠ مرة',
    text: 'سُبْحَانَ اللهِ وَبِحَمْدِهِ، سُبْحَانَ اللهِ العَظِيمِ',
  },
  {
    title: 'استغفار وتوبة',
    reference: 'ذكر مختار · ٣ مرات',
    text: 'رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ، إِنَّكَ أَنْتَ التَّوَّابُ الرَّحِيمُ',
  },
  {
    title: 'ذكر التوحيد',
    reference: 'ذكر مختار · ١٠ مرات',
    text: 'لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
  },
];

export function DailyDuaSection({ colors }: { colors: ThemeColors }) {
  const styles = createStyles(colors);
  const [settings, setSettings] = useState<DailyDuaSettings>({ ...DEFAULT_DAILY_DUA_SETTINGS });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [duaIndex, setDuaIndex] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [draftHour, setDraftHour] = useState(DEFAULT_DAILY_DUA_SETTINGS.hour);
  const [draftMinute, setDraftMinute] = useState(DEFAULT_DAILY_DUA_SETTINGS.minute);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [requiresSettings, setRequiresSettings] = useState(false);

  useEffect(() => {
    let active = true;
    void getDailyDuaSettings().then((saved) => {
      if (active) {
        setSettings(saved);
        setDraftHour(saved.hour);
        setDraftMinute(saved.minute);
        setSettingsLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const currentDua = DAILY_DUAS[duaIndex];

  async function persistSettings(next: DailyDuaSettings, successMessage: string): Promise<boolean> {
    setSaving(true);
    setStatusMessage(null);
    setRequiresSettings(false);
    try {
      const result = await saveDailyDuaSettings(next);
      if (!result.saved) {
        setStatusMessage(result.reason ?? 'تعذر حفظ التذكير. حاول مرة أخرى.');
        setStatusIsError(true);
        setRequiresSettings(result.requiresSettings === true);
        return false;
      }
      setSettings(next);
      setStatusMessage(result.warning ?? successMessage);
      setStatusIsError(Boolean(result.warning));
      return true;
    } catch {
      setStatusMessage('تعذر حفظ التذكير. حاول مرة أخرى.');
      setStatusIsError(true);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openTimePicker() {
    setDraftHour(settings.hour);
    setDraftMinute(settings.minute);
    setPickerVisible(true);
  }

  function renderTimeAdjuster(label: string, value: number, onChange: (next: number) => void, step: number, range: number) {
    return (
      <View style={styles.timeAdjuster}>
        <Text style={styles.timeLabel}>{label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`زيادة ${label}`} onPress={() => onChange((value + step) % range)} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-up-outline" size={21} color={colors.tealDark} />
        </Pressable>
        <Text style={styles.timeValue}>{String(value).padStart(2, '0')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`تقليل ${label}`} onPress={() => onChange((value - step + range) % range)} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-down-outline" size={21} color={colors.tealDark} />
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Text style={styles.sectionTitle}>أدعية وأذكار يومية</Text>
      <SurfaceCard accent={colors.tealDark}>
        <View style={styles.cardHeading}>
          <View style={styles.iconBox}><Ionicons name="book-outline" size={19} color={colors.tealDark} /></View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>{currentDua.title}</Text>
            <Text style={styles.cardDetail}>{currentDua.reference.startsWith('ذكر') ? currentDua.reference : `دعاء من القرآن الكريم · ${currentDua.reference}`}</Text>
          </View>
        </View>
        <Text selectable style={styles.duaText}>{currentDua.text}</Text>
        <View style={styles.duaFooter}>
          <Text style={styles.sourceText}>مختارات يومية داخل التطبيق</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="عرض ذكر أو دعاء آخر" onPress={() => setDuaIndex((index) => (index + 1) % DAILY_DUAS.length)} style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}>
            <Text style={styles.nextButtonText}>دعاء آخر</Text>
            <Ionicons name="refresh-outline" size={16} color={colors.tealDark} />
          </Pressable>
        </View>
      </SurfaceCard>

      <SurfaceCard accent={colors.amber}>
        <View style={styles.cardHeading}>
          <View style={styles.reminderIcon}><Ionicons name="notifications-outline" size={19} color={colors.amber} /></View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>تذكير يومي مخصص</Text>
            <Text style={styles.cardDetail}>اختر الوقت، ويمكنك إيقاف التذكير في أي وقت.</Text>
          </View>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>تذكير كل يوم</Text>
            <Text style={styles.settingDetail}>{settings.enabled ? `مفعّل · ${formatDailyDuaTime(settings.hour, settings.minute)}` : 'متوقف'}</Text>
          </View>
          {settingsLoading ? <ActivityIndicator size="small" color={colors.tealDark} /> : (
            <Switch
              accessibilityRole="switch"
              accessibilityLabel="تفعيل التذكير اليومي بالأدعية والأذكار"
              value={settings.enabled}
              disabled={saving || Platform.OS === 'web'}
              onValueChange={(enabled) => { void persistSettings({ ...settings, enabled }, enabled ? 'تم تفعيل التذكير اليومي.' : 'تم إيقاف التذكير اليومي.'); }}
              trackColor={{ false: colors.line, true: colors.tealSoft }}
              thumbColor={settings.enabled ? colors.tealDark : colors.paper}
            />
          )}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={`تغيير وقت التذكير الحالي ${formatDailyDuaTime(settings.hour, settings.minute)}`} disabled={saving || settingsLoading || Platform.OS === 'web'} onPress={openTimePicker} style={({ pressed }) => [styles.timeButton, pressed && styles.pressed, (saving || Platform.OS === 'web') && styles.disabled]}>
          <View style={styles.timeButtonCopy}>
            <Text style={styles.timeButtonTitle}>وقت الإشعار</Text>
            <Text style={styles.timeButtonDetail}>{settings.enabled ? 'سيصلك تذكير يومي في هذا الموعد' : 'احفظ موعدًا، ثم فعّل التذكير عند رغبتك'}</Text>
          </View>
          <View style={styles.timeBadge}>
            <Ionicons name="time-outline" size={17} color={colors.tealDark} />
            <Text style={styles.timeBadgeText}>{formatDailyDuaTime(settings.hour, settings.minute)}</Text>
          </View>
        </Pressable>

        <Text style={styles.sourceText}>إشعار محلي على هذا الجهاز، ويعتمد موعده على التوقيت المحلي. لا يحتاج إلى إنترنت.</Text>
        {Platform.OS === 'web' ? <Text style={styles.sourceText}>تفعيل التنبيه يحتاج إلى نسخة Android أو iOS من التطبيق.</Text> : null}
        {saving ? <ActivityIndicator style={styles.statusSpinner} size="small" color={colors.tealDark} /> : null}
        {statusMessage ? <Text accessibilityLiveRegion="polite" style={[styles.statusText, statusIsError && styles.errorText]}>{statusMessage}</Text> : null}
        {requiresSettings && Platform.OS !== 'web' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="فتح إعدادات إشعارات مُرشد" onPress={() => { void Linking.openSettings().catch(() => undefined); }} style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
            <Text style={styles.settingsButtonText}>فتح إعدادات الإشعارات</Text>
            <Ionicons name="settings-outline" size={16} color={colors.tealDark} />
          </Pressable>
        ) : null}
      </SurfaceCard>

      <Modal transparent visible={pickerVisible} animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>وقت التذكير اليومي</Text>
            <Text style={styles.modalDetail}>اختر الساعة والدقيقة حسب توقيت جهازك.</Text>
            <View style={styles.timePickerRow}>
              {renderTimeAdjuster('الساعة', draftHour, setDraftHour, 1, 24)}
              <Text style={styles.timeSeparator}>:</Text>
              {renderTimeAdjuster('الدقيقة', draftMinute, setDraftMinute, 1, 60)}
            </View>
            <Text style={styles.pickerPreview}>{formatDailyDuaTime(draftHour, draftMinute)}</Text>
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" onPress={() => setPickerVisible(false)} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                <Text style={styles.cancelButtonText}>إلغاء</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={saving} onPress={async () => {
                const saved = await persistSettings({ ...settings, hour: draftHour, minute: draftMinute }, 'تم حفظ وقت التذكير.');
                if (saved) setPickerVisible(false);
              }} style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed, saving && styles.disabled]}>
                <Text style={styles.confirmButtonText}>{saving ? 'جارٍ الحفظ…' : 'حفظ الوقت'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  sectionTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.sm },
  cardHeading: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  reminderIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.amberSoft, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, marginLeft: spacing.sm },
  cardTitle: { ...typography.label, color: colors.ink },
  cardDetail: { ...typography.body, color: colors.inkMuted, marginTop: 4 },
  duaText: { ...typography.h2, color: colors.ink, textAlign: 'right', lineHeight: 36, marginTop: spacing.md },
  duaFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, marginTop: spacing.sm },
  sourceText: { ...typography.body, color: colors.inkFaint, fontSize: 10, marginTop: spacing.sm, flex: 1 },
  nextButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  nextButtonText: { ...typography.label, color: colors.tealDark, fontSize: 11 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingVertical: spacing.xs },
  settingCopy: { flex: 1, marginRight: spacing.sm },
  settingTitle: { ...typography.label, color: colors.ink },
  settingDetail: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 3 },
  timeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.sm, marginTop: spacing.sm },
  timeButtonCopy: { flex: 1, marginRight: spacing.sm },
  timeButtonTitle: { ...typography.label, color: colors.ink },
  timeButtonDetail: { ...typography.body, color: colors.inkMuted, fontSize: 11, marginTop: 3 },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.tealSoft, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  timeBadgeText: { ...typography.label, color: colors.tealDark, fontSize: 13 },
  statusSpinner: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  statusText: { ...typography.body, color: colors.tealDark, marginTop: spacing.sm },
  errorText: { color: colors.danger },
  settingsButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs, marginTop: spacing.sm, paddingVertical: spacing.xs },
  settingsButtonText: { ...typography.label, color: colors.tealDark },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(7, 22, 28, 0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: radii.lg, backgroundColor: colors.paper, padding: spacing.lg, alignItems: 'center' },
  modalTitle: { ...typography.h2, color: colors.ink, textAlign: 'center' },
  modalDetail: { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.xs },
  timePickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  timeAdjuster: { alignItems: 'center', minWidth: 82 },
  timeLabel: { ...typography.label, color: colors.inkMuted, marginBottom: spacing.xs },
  stepButton: { width: 44, height: 34, borderRadius: radii.sm, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  timeValue: { ...typography.display, color: colors.tealDark, fontSize: 28, marginVertical: 2 },
  timeSeparator: { ...typography.display, color: colors.ink, fontSize: 26, marginHorizontal: spacing.sm, marginTop: spacing.lg },
  pickerPreview: { ...typography.label, color: colors.inkMuted, marginTop: spacing.xs },
  modalActions: { flexDirection: 'row', width: '100%', gap: spacing.sm, marginTop: spacing.lg },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingVertical: spacing.sm },
  cancelButtonText: { ...typography.label, color: colors.inkMuted },
  confirmButton: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealDark, borderRadius: radii.md, paddingVertical: spacing.sm },
  confirmButtonText: { ...typography.label, color: colors.paper },
}); }
