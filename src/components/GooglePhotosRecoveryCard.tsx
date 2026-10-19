import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { RuqaaText as Text } from './RuqaaText';
import { useAppTheme } from '../theme/ThemeProvider';
import { radii, spacing, typography, ThemeColors } from '../theme';
import { GooglePhotosProgress, importSelectedGooglePhotos } from '../services/googlePhotos/googlePhotosService';

export function GooglePhotosRecoveryCard({ onComplete }: { onComplete: () => Promise<void> | void }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [progress, setProgress] = useState<GooglePhotosProgress | null>(null);
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const start = async () => {
    if (running) return;
    controller.current = new AbortController();
    setRunning(true);
    try {
      const result = await importSelectedGooglePhotos(setProgress, controller.current.signal);
      setProgress(result);
      await onComplete();
      Alert.alert('اكتمل الاسترداد', `تم حفظ ${result.completed} ملف داخل مساحة مُرشد.${result.failed ? ` تعذر تنزيل ${result.failed} ملفات.` : ''}`);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code !== 'google_photos_import_paused') Alert.alert('تعذر استرداد صور Google', code === 'google_photos_client_id_missing' ? 'لم يتم إعداد OAuth في Google Cloud بعد.' : 'تحقق من الاتصال والصلاحيات ومساحة التخزين ثم حاول مرة أخرى.');
    } finally { setRunning(false); controller.current = null; }
  };
  const pause = () => controller.current?.abort();
  const total = progress?.selected ?? 0;
  const done = progress?.completed ?? 0;
  return <View style={styles.card}>
    <View style={styles.heading}><View style={styles.icon}><Ionicons name="logo-google" size={22} color={colors.tealDark} /></View><View style={styles.headingText}><Text style={styles.title}>استرداد صور Google</Text><Text style={styles.subtitle}>اختيار رسمي وتنزيل نسخة محلية داخل مُرشد</Text></View></View>
    <Text style={styles.body}>سيفتح مُرشد Google Photos لتختار الصور والفيديوهات بنفسك. سيتم تنزيل نسخ حقيقية إلى مساحة التطبيق، ولن تُحذف النسخ الأصلية أو تُرفع إلى خادم خارجي.</Text>
    {progress && total > 0 ? <View style={styles.progressBox}><View style={styles.progressLabel}><Text style={styles.progressText}>{done} من {total} ملف</Text><Text style={styles.progressText}>{progress.failed} فشل</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, (done / total) * 100)}%` }]} /></View><Text style={styles.bytes}>{progress.downloadedBytes ? `${Math.round(progress.downloadedBytes / 1024 / 1024)} MB تم تنزيلها` : 'جارٍ تجهيز العناصر المحددة'}</Text></View> : null}
    {running ? <Pressable onPress={pause} style={[styles.button, styles.pause]}><ActivityIndicator color={colors.ink} /><Text style={styles.pauseText}>إيقاف مؤقت</Text></Pressable> : <Pressable onPress={() => void start()} style={styles.button}><Ionicons name="download-outline" size={19} color={colors.paper} /><Text style={styles.buttonText}>استرداد صور Google</Text></Pressable>}
    <Text style={styles.note}>يتطلب تسجيل دخول Google رسميًا. لا يتيح Google Photos API تنزيل المكتبة كاملة من داخل التطبيق؛ للاستيراد الكامل استخدم Google Takeout ثم زر «استيراد ملفات».</Text>
  </View>;
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({ card: { marginTop: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' }, headingText: { flex: 1 }, title: { ...typography.h2, color: colors.ink, fontSize: 17 }, subtitle: { ...typography.body, color: colors.inkMuted, fontSize: 11, marginTop: 2 }, body: { ...typography.body, color: colors.inkMuted, lineHeight: 20, fontSize: 12, marginTop: spacing.sm }, button: { minHeight: 46, marginTop: spacing.md, borderRadius: radii.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm }, buttonText: { ...typography.label, color: colors.paper }, pause: { backgroundColor: colors.tealSoft }, pauseText: { ...typography.label, color: colors.ink }, progressBox: { marginTop: spacing.md, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.tealSoft }, progressLabel: { flexDirection: 'row', justifyContent: 'space-between' }, progressText: { ...typography.label, color: colors.ink, fontSize: 11 }, track: { height: 8, borderRadius: 4, backgroundColor: colors.paper, overflow: 'hidden', marginTop: spacing.sm }, fill: { height: '100%', backgroundColor: colors.tealDark }, bytes: { ...typography.body, color: colors.inkMuted, fontSize: 10, marginTop: 5 }, note: { ...typography.body, color: colors.inkFaint, fontSize: 10, lineHeight: 16, marginTop: spacing.sm } }); }
