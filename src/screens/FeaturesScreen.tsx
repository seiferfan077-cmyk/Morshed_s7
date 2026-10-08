import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SurfaceCard } from '../components/SurfaceCard';
import { colors, radii, spacing, typography } from '../theme';

export function FeaturesScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>MURSHID UPDATES</Text>
          <Text style={styles.title}>المميزات</Text>
          <Text style={styles.subtitle}>سوف تظهر مميزات التطبيق الجديدة تلقائيًا هنا.</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="sparkles-outline" size={25} color={colors.amber} />
        </View>
      </View>

      <SurfaceCard accent={colors.amber}>
        <View style={styles.cardRow}>
          <View style={styles.iconBox}>
            <Ionicons name="layers-outline" size={22} color={colors.amber} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.cardTitle}>قسم المميزات</Text>
            <Text style={styles.cardDetail}>تمت إضافة القسم إلى الشريط السفلي للوصول إليه بسهولة.</Text>
          </View>
        </View>
      </SurfaceCard>

      <Text style={styles.sectionTitle}>الاتصال الهاتفي</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="فتح لوحة اتصال مُرشد" onPress={() => { void Linking.sendIntent('com.murshid.s7.OPEN_DIALER').catch(() => Linking.openURL('murshid://dialer')); }} style={({ pressed }) => [styles.callCard, pressed && styles.pressed]}>
        <View style={styles.callIcon}><Ionicons name="call-outline" size={28} color={colors.paper} /></View>
        <View style={styles.callCopy}>
          <Text style={styles.callTitle}>اتصال مُرشد</Text>
          <Text style={styles.callDetail}>لوحة أرقام مُرشد وجهات اتصال الجهاز واختيار الشريحة والاتصال من داخل التطبيق.</Text>
          <Text style={styles.callHint}>اضغط لفتح لوحة الاتصال</Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={22} color={colors.tealDark} />
      </Pressable>

      <Text style={styles.sectionTitle}>موجز التحديثات</Text>
      <SurfaceCard>
        <View style={styles.cardRow}>
          <View style={styles.updateIcon}>
            <Ionicons name="flash-outline" size={21} color={colors.tealDark} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.cardTitle}>المميزات الجديدة</Text>
            <Text style={styles.cardDetail}>سوف تظهر جميع المميزات الجديدة تلقائيًا في هذا القسم.</Text>
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard accent={colors.teal}>
        <Text style={styles.cardTitle}>التحديثات الهوائية</Text>
        <Text style={styles.cardDetail}>لن تحتاج إلى تحميل نسخة جديدة للتحديثات المتوافقة مع OTA. وإذا احتاجت ميزة إلى تحميل نسخة جديدة، سوف يتم إخطارك في التطبيق.</Text>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.cardTitle}>ما الذي سيظهر هنا؟</Text>
        <Text style={styles.cardDetail}>سوف يتم نشر موجز أو تحديث للتطبيق هنا عند توفر مميزات أو تحسينات جديدة.</Text>
      </SurfaceCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  headerCopy: { flex: 1 },
  eyebrow: { ...typography.label, color: colors.tealDark, letterSpacing: 1.1 },
  title: { ...typography.display, color: colors.ink, marginTop: 3 },
  subtitle: { ...typography.body, color: colors.inkMuted, marginTop: spacing.sm },
  headerIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.amberSoft, alignItems: 'center', justifyContent: 'center' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.amberSoft, alignItems: 'center', justifyContent: 'center' },
  updateIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginLeft: spacing.sm },
  callCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ink, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.ink },
  callIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center' },
  callCopy: { flex: 1, marginHorizontal: spacing.sm },
  callTitle: { ...typography.h2, color: colors.paper, fontSize: 18 },
  callDetail: { ...typography.body, color: '#c8e3de', fontSize: 12, marginTop: 3 },
  callHint: { ...typography.label, color: '#7ee1d1', fontSize: 11, marginTop: 8 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  cardTitle: { ...typography.label, color: colors.ink },
  cardDetail: { ...typography.body, color: colors.inkMuted, marginTop: 5 },
  sectionTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.sm },
});
