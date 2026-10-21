import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { RuqaaText as Text } from '../components/RuqaaText';
import { SurfaceCard } from '../components/SurfaceCard';
import { radii, spacing, typography, ThemeColors } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { QuranReader } from './QuranReader';
import { IslamicSection } from './IslamicSection';

export function FeaturesScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [showIslamicSection, setShowIslamicSection] = useState(false);
  const [showQuranReader, setShowQuranReader] = useState(false);

  if (showQuranReader) return <QuranReader onClose={() => setShowQuranReader(false)} />;
  if (showIslamicSection) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="العودة إلى شاشة المميزات" onPress={() => setShowIslamicSection(false)} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons name="arrow-forward-outline" size={18} color={colors.tealDark} />
          <Text style={styles.backText}>العودة إلى المميزات</Text>
        </Pressable>
        <IslamicSection colors={colors} onOpenQuran={() => setShowQuranReader(true)} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>MURSHID FEATURES</Text>
          <Text style={styles.title}>المميزات</Text>
          <Text style={styles.subtitle}>اختر القسم الذي تريد استخدامه من مميزات مُرشد.</Text>
        </View>
        <View style={styles.headerIcon}><Ionicons name="star-outline" size={25} color={colors.amber} /></View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="فتح القسم الإسلامي" onPress={() => setShowIslamicSection(true)} style={({ pressed }) => [styles.islamicCard, pressed && styles.pressed]}>
        <View style={styles.mosqueIcon}><Ionicons name="business-outline" size={31} color={colors.paper} /></View>
        <View style={styles.cardCopy}>
          <Text style={styles.islamicTitle}>القسم الإسلامي</Text>
          <Text style={styles.islamicDetail}>القرآن، التسبيح، الأذكار، الأدعية، مواقيت الصلاة، القبلة والأحاديث.</Text>
          <Text style={styles.cardHint}>اضغط لاستعراض جميع المميزات الإسلامية</Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={22} color={colors.tealDark} />
      </Pressable>

      <Pressable accessibilityRole="button" accessibilityLabel="فتح لوحة اتصال مُرشد" onPress={() => { void Linking.sendIntent('com.murshid.s7.OPEN_DIALER').catch(() => Linking.openURL('murshid://dialer')); }} style={({ pressed }) => [styles.callCard, pressed && styles.pressed]}>
        <View style={styles.callIcon}><Ionicons name="call-outline" size={27} color={colors.paper} /></View>
        <View style={styles.cardCopy}>
          <Text style={styles.callTitle}>الاتصال بمُرشد</Text>
          <Text style={styles.callDetail}>افتح لوحة الاتصال وجهات الاتصال واختر الشريحة للاتصال من داخل التطبيق.</Text>
          <Text style={styles.callHint}>اضغط لفتح لوحة الاتصال</Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={22} color="#7ee1d1" />
      </Pressable>

      <SurfaceCard>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}><Ionicons name="sparkles-outline" size={20} color={colors.tealDark} /></View>
          <View style={styles.cardCopy}>
            <Text style={styles.infoTitle}>كل شيء في مكان واضح</Text>
            <Text style={styles.infoDetail}>افتح القسم الإسلامي للوصول إلى أدوات العبادة، أو اختر الاتصال بمُرشد للوصول إلى وظائف المكالمات.</Text>
          </View>
        </View>
      </SurfaceCard>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  headerCopy: { flex: 1 },
  eyebrow: { ...typography.label, color: colors.tealDark, letterSpacing: 1.1 },
  title: { ...typography.display, color: colors.ink, marginTop: 3 },
  subtitle: { ...typography.body, color: colors.inkMuted, marginTop: spacing.sm },
  headerIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.amberSoft, alignItems: 'center', justifyContent: 'center' },
  islamicCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.tealDark, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.tealDark, marginBottom: spacing.md },
  mosqueIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: 'rgba(7, 17, 15, 0.28)', alignItems: 'center', justifyContent: 'center' },
  islamicTitle: { ...typography.h2, color: colors.paper, fontSize: 20 },
  islamicDetail: { ...typography.body, color: '#D5F5EF', fontSize: 12, lineHeight: 20, marginTop: 4 },
  cardHint: { ...typography.label, color: '#9EF0E2', fontSize: 11, marginTop: 8 },
  callCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ink, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.ink, marginBottom: spacing.xl },
  callIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center' },
  callTitle: { ...typography.h2, color: colors.paper, fontSize: 19 },
  callDetail: { ...typography.body, color: '#C8E3DE', fontSize: 12, lineHeight: 20, marginTop: 4 },
  callHint: { ...typography.label, color: '#7EE1D1', fontSize: 11, marginTop: 8 },
  cardCopy: { flex: 1, marginHorizontal: spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { ...typography.label, color: colors.ink },
  infoDetail: { ...typography.body, color: colors.inkMuted, marginTop: 5 },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs, paddingVertical: spacing.xs, marginBottom: spacing.sm },
  backText: { ...typography.label, color: colors.tealDark },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
}); }
