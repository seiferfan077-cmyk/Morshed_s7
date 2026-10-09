import { useAppTheme } from '../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { useState } from 'react';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { SurfaceCard } from '../components/SurfaceCard';
import { SupportWebsiteModal } from './SupportWebsiteModal';
import { spacing, typography, ThemeColors } from '../theme';

export function SettingsScreen() {
  const { colors, mode, setMode } = useAppTheme();
  const styles = createStyles(colors);
  const [supportVisible, setSupportVisible] = useState(false);
  const openCallSetup = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('إعداد المكالمات', 'تهيئة واجهة المكالمات الواردة متاحة على Android.');
      return;
    }
    try {
      await IntentLauncher.startActivityAsync('com.murshid.s7.OPEN_DIALER');
    } catch {
      Alert.alert('تعذر فتح الإعداد', 'افتح تطبيق مُرشد على Android ثم أعد المحاولة.');
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader eyebrow="Settings" title="الإعدادات" detail="تحكم في السلوك والاتصالات ومظهر التطبيق." />
      <View style={styles.themeSection}>
        <View style={styles.themeCopy}>
          <Text style={styles.title}>مظهر التطبيق</Text>
          <Text style={styles.detail}>يُحفظ اختيارك ويُطبّق على الشاشات فورًا.</Text>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel="مظهر التطبيق" style={styles.themeChoices}>
          <Pressable accessibilityRole="radio" accessibilityState={{ selected: mode === 'light' }} onPress={() => setMode('light')} style={[styles.themeChoice, mode === 'light' && styles.themeChoiceSelected]}>
            <Ionicons name="sunny-outline" size={18} color={mode === 'light' ? colors.paper : colors.inkMuted} />
            <Text style={[styles.themeChoiceText, mode === 'light' && styles.themeChoiceTextSelected]}>نهاري</Text>
          </Pressable>
          <Pressable accessibilityRole="radio" accessibilityState={{ selected: mode === 'dark' }} onPress={() => setMode('dark')} style={[styles.themeChoice, mode === 'dark' && styles.themeChoiceSelected]}>
            <Ionicons name="moon-outline" size={18} color={mode === 'dark' ? colors.paper : colors.inkMuted} />
            <Text style={[styles.themeChoiceText, mode === 'dark' && styles.themeChoiceTextSelected]}>ليلي</Text>
          </Pressable>
        </View>
      </View>
      <SurfaceCard>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="فتح الدعم عبر الموقع الإلكتروني داخل تطبيق مُرشد"
          onPress={() => setSupportVisible(true)}
          style={({ pressed }) => [styles.row, styles.supportRow, pressed && styles.pressed]}
        >
          <Ionicons name="chatbubbles-outline" size={21} color={colors.tealDark} />
          <View style={styles.copy}>
            <Text style={styles.title}>الدعم عبر الموقع الإلكتروني</Text>
            <Text style={styles.detail}>تواصل مع فريق الدعم مباشرة من داخل مُرشد</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.inkFaint} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="تهيئة استقبال المكالمات وإذن شاشة الاتصال كاملة الشاشة"
          onPress={openCallSetup}
          style={({ pressed }) => [styles.row, styles.supportRow, pressed && styles.pressed]}
        >
          <Ionicons name="call-outline" size={21} color={colors.tealDark} />
          <View style={styles.copy}>
            <Text style={styles.title}>تهيئة استقبال المكالمات</Text>
          <Text style={styles.detail}>عيّن مُرشد كتطبيق الهاتف؛ تظهر شاشة الاتصال بملء الشاشة، ويمكن منح إذن الظهور فوق التطبيقات لتغطية التطبيق المفتوح أثناء الرنين</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.inkFaint} />
        </Pressable>
        <Setting icon="globe-outline" title="المتصفح" detail="صفحة البداية، محرك البحث، وقيود Kiosk" />
        <Setting icon="images-outline" title="الوسائط" detail="سلوك الحفظ والتكرار والمعرض" />
        <Setting icon="shield-checkmark-outline" title="الأمان" detail="المصادقة ومزود Backend" />
        <Setting icon="information-circle-outline" title="حول مُرشد" detail="نسخة الأساس 0.1.0 · Expo" />
      </SurfaceCard>
      <SupportWebsiteModal visible={supportVisible} onClose={() => setSupportVisible(false)} />
    </View>
  );
}

function Setting({ icon, title, detail }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.tealDark} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
    </View>
  );
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg },
  themeSection: { backgroundColor: colors.paper, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: spacing.md, marginBottom: spacing.md },
  themeCopy: { marginBottom: spacing.sm },
  themeChoices: { flexDirection: 'row', gap: spacing.sm },
  themeChoice: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.surface },
  themeChoiceSelected: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
  themeChoiceText: { ...typography.label, color: colors.inkMuted },
  themeChoiceTextSelected: { color: colors.paper },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  supportRow: { paddingTop: spacing.xs, paddingBottom: spacing.md },
  copy: { flex: 1, marginLeft: spacing.md },
  title: { ...typography.label, color: colors.ink },
  detail: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 3 },
  pressed: { opacity: 0.68 },
}); }
