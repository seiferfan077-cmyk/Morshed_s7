import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { SurfaceCard } from '../components/SurfaceCard';
import { SupportWebsiteModal } from './SupportWebsiteModal';
import { colors, spacing, typography } from '../theme';

export function SettingsScreen() {
  const [supportVisible, setSupportVisible] = useState(false);

  return (
    <View style={styles.screen}>
      <ScreenHeader eyebrow="Settings" title="الإعدادات" detail="تحكم في السلوك والاتصالات ومظهر التطبيق." />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg },
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
});
