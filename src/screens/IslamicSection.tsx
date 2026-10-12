import * as Location from 'expo-location';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { SurfaceCard } from '../components/SurfaceCard';
import { radii, spacing, typography, ThemeColors } from '../theme';

type PrayerTimes = {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
};

type LocationState = {
  latitude: number;
  longitude: number;
  qiblaBearing: number;
  city?: string;
};

const ADHKAR = [
  { text: 'سُبْحَانَ اللهِ وَبِحَمْدِهِ، سُبْحَانَ اللهِ العَظِيمِ', count: '100 مرة' },
  { text: 'رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ، إِنَّكَ أَنْتَ التَّوَّابُ الرَّحِيمُ', count: '3 مرات' },
  { text: 'لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', count: '10 مرات' },
];

const PRAYER_LABELS: [keyof PrayerTimes, string][] = [
  ['Fajr', 'الفجر'],
  ['Sunrise', 'الشروق'],
  ['Dhuhr', 'الظهر'],
  ['Asr', 'العصر'],
  ['Maghrib', 'المغرب'],
  ['Isha', 'العشاء'],
];

const KAABA = { latitude: 21.422487, longitude: 39.826206 };

function toRadians(value: number) { return (value * Math.PI) / 180; }
function toDegrees(value: number) { return (value * 180) / Math.PI; }

function getQiblaBearing(latitude: number, longitude: number) {
  const latitudeRad = toRadians(latitude);
  const kaabaLatitudeRad = toRadians(KAABA.latitude);
  const deltaLongitude = toRadians(KAABA.longitude - longitude);
  const bearing = toDegrees(Math.atan2(
    Math.sin(deltaLongitude),
    Math.cos(latitudeRad) * Math.tan(kaabaLatitudeRad) - Math.sin(latitudeRad) * Math.cos(deltaLongitude),
  ));
  return Math.round((bearing + 360) % 360);
}

function getDirectionLabel(bearing: number) {
  const directions = ['شمال', 'شمال شرقي', 'شرق', 'جنوب شرقي', 'جنوب', 'جنوب غربي', 'غرب', 'شمال غربي'];
  return directions[Math.round(bearing / 45) % directions.length];
}

function formatDate(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}

function cleanTime(value: unknown) {
  const match = String(value ?? '').match(/\d{1,2}:\d{2}/);
  return match?.[0] ?? '—';
}

export function IslamicSection({ colors, onOpenQuran }: { colors: ThemeColors; onOpenQuran: () => void }) {
  const styles = createStyles(colors);
  const [dhikrIndex, setDhikrIndex] = useState(0);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dhikr = ADHKAR[dhikrIndex];
  const qiblaDirection = useMemo(() => location ? getDirectionLabel(location.qiblaBearing) : null, [location]);

  const loadIslamicTimes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        throw new Error('للحصول على مواقيت مدينتك واتجاه القبلة، اسمح للتطبيق باستخدام موقعك أثناء الاستخدام.');
      }

      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 300000, requiredAccuracy: 5000 });
      const position = lastKnown ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      const nextLocation = { latitude, longitude, qiblaBearing: getQiblaBearing(latitude, longitude) };

      const response = await fetch(`https://api.aladhan.com/v1/timings/${formatDate(new Date())}?latitude=${latitude}&longitude=${longitude}&method=3`);
      if (!response.ok) throw new Error('تعذر الوصول إلى خدمة مواقيت الصلاة الآن. حاول مرة أخرى.');
      const payload = await response.json() as { data?: { timings?: Record<string, unknown>; meta?: { timezone?: string } } };
      if (!payload.data?.timings) throw new Error('لم تصل مواقيت الصلاة من الخدمة.');

      setLocation({ ...nextLocation, city: payload.data.meta?.timezone });
      setPrayerTimes({
        Fajr: cleanTime(payload.data.timings.Fajr),
        Sunrise: cleanTime(payload.data.timings.Sunrise),
        Dhuhr: cleanTime(payload.data.timings.Dhuhr),
        Asr: cleanTime(payload.data.timings.Asr),
        Maghrib: cleanTime(payload.data.timings.Maghrib),
        Isha: cleanTime(payload.data.timings.Isha),
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'تعذر تحديد المواقيت من موقعك.');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <>
      <Text style={styles.sectionTitle}>القسم الإسلامي</Text>
      <SurfaceCard accent={colors.tealDark}>
        <View style={styles.islamicHeader}>
          <View style={styles.islamicIcon}><Ionicons name="moon-outline" size={24} color={colors.tealDark} /></View>
          <View style={styles.islamicCopy}>
            <Text style={styles.cardTitle}>مميزات الإسلام</Text>
            <Text style={styles.cardDetail}>القرآن، الأذكار، مواقيت الصلاة واتجاه القبلة في مكان واحد.</Text>
          </View>
        </View>
      </SurfaceCard>

      <Pressable accessibilityRole="button" accessibilityLabel="فتح قارئ القرآن الكريم" onPress={onOpenQuran} style={({ pressed }) => [styles.quranCard, pressed && styles.pressed]}>
        <View style={styles.quranIcon}><Ionicons name="book-outline" size={25} color={colors.tealDark} /></View>
        <View style={styles.quranCopy}>
          <Text style={styles.quranTitle}>القرآن الكريم</Text>
          <Text style={styles.cardDetail}>تصفّح السور واقرأ النص العثماني كاملًا دون اتصال بالإنترنت.</Text>
          <Text style={styles.quranHint}>فتح القارئ والبحث في السور</Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={20} color={colors.tealDark} />
      </Pressable>

      <SurfaceCard>
        <View style={styles.cardHeading}>
          <Ionicons name="sparkles-outline" size={20} color={colors.amber} />
          <Text style={styles.cardTitle}>أذكار مختارة</Text>
        </View>
        <Text style={styles.dhikrText}>{dhikr.text}</Text>
        <Text style={styles.dhikrCount}>{dhikr.count}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="عرض الذكر التالي" onPress={() => setDhikrIndex((index) => (index + 1) % ADHKAR.length)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryButtonText}>ذكر آخر</Text>
          <Ionicons name="refresh-outline" size={17} color={colors.tealDark} />
        </Pressable>
      </SurfaceCard>

      <SurfaceCard accent={colors.teal}>
        <View style={styles.cardHeading}>
          <Ionicons name="time-outline" size={20} color={colors.tealDark} />
          <Text style={styles.cardTitle}>مواقيت الصلاة حسب موقعك</Text>
        </View>
        <Text style={styles.cardDetail}>نستخدم موقعك الحالي مرة واحدة لجلب مواقيت اليوم من خدمة AlAdhan، ولا نطلب تتبعًا في الخلفية.</Text>
        {prayerTimes ? <View style={styles.prayerGrid}>{PRAYER_LABELS.map(([key, label]) => <View key={key} style={styles.prayerItem}><Text style={styles.prayerLabel}>{label}</Text><Text style={styles.prayerTime}>{prayerTimes[key]}</Text></View>)}</View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="تحديد مواقيت الصلاة حسب موقعي" onPress={() => { void loadIslamicTimes(); }} disabled={loading} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, loading && styles.disabled]}>
          {loading ? <ActivityIndicator color={colors.paper} size="small" /> : <Ionicons name="locate-outline" size={18} color={colors.paper} />}
          <Text style={styles.primaryButtonText}>{prayerTimes ? 'تحديث من موقعي' : 'تحديد موقعي والمواقيت'}</Text>
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Text style={styles.sourceText}>طريقة الحساب: رابطة العالم الإسلامي · المصدر: AlAdhan</Text>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardHeading}>
          <Ionicons name="compass-outline" size={20} color={colors.tealDark} />
          <Text style={styles.cardTitle}>اتجاه القبلة</Text>
        </View>
        {location ? <View style={styles.qiblaRow}><View style={[styles.qiblaArrow, { transform: [{ rotate: `${location.qiblaBearing}deg` }] }]}><Ionicons name="arrow-up-outline" size={48} color={colors.tealDark} /></View><View style={styles.qiblaCopy}><Text style={styles.qiblaDegree}>{location.qiblaBearing}°</Text><Text style={styles.cardDetail}>باتجاه {qiblaDirection} من الشمال الحقيقي</Text></View></View> : <Text style={styles.cardDetail}>حدّد موقعك أولًا لإظهار زاوية القبلة من مكانك الحالي.</Text>}
        <Text style={styles.sourceText}>يُحسب الاتجاه جغرافيًا من إحداثياتك إلى الكعبة المشرفة. السهم يعبّر عن الشمال الحقيقي، وليس اتجاه الهاتف اللحظي.</Text>
      </SurfaceCard>
    </>
  );
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  sectionTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.sm },
  islamicHeader: { flexDirection: 'row', alignItems: 'center' },
  islamicIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  islamicCopy: { flex: 1, marginLeft: spacing.sm },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...typography.label, color: colors.ink },
  cardDetail: { ...typography.body, color: colors.inkMuted, marginTop: 5 },
  dhikrText: { ...typography.h2, color: colors.ink, textAlign: 'right', lineHeight: 32, marginTop: spacing.md },
  dhikrCount: { ...typography.label, color: colors.tealDark, marginTop: spacing.sm },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingVertical: spacing.sm, marginTop: spacing.md },
  secondaryButtonText: { ...typography.label, color: colors.tealDark },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.tealDark, borderRadius: radii.md, paddingVertical: spacing.sm, marginTop: spacing.md },
  primaryButtonText: { ...typography.label, color: colors.paper },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  prayerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  prayerItem: { width: '31%', backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.sm, alignItems: 'center' },
  prayerLabel: { ...typography.label, color: colors.inkMuted, fontSize: 11 },
  prayerTime: { ...typography.h2, color: colors.tealDark, fontSize: 19, marginTop: 2 },
  qiblaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  qiblaArrow: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  qiblaCopy: { flex: 1, marginLeft: spacing.md },
  qiblaDegree: { ...typography.display, color: colors.tealDark, fontSize: 28 },
  errorText: { ...typography.body, color: colors.danger, marginTop: spacing.sm },
  sourceText: { ...typography.body, color: colors.inkFaint, fontSize: 10, marginTop: spacing.sm },
  quranCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.paper, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.line, marginTop: spacing.sm },
  quranIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  quranCopy: { flex: 1, marginHorizontal: spacing.sm },
  quranTitle: { ...typography.h2, color: colors.ink, fontSize: 18 },
  quranHint: { ...typography.label, color: colors.tealDark, fontSize: 11, marginTop: 7 },
}); }
