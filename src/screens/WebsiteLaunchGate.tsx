import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../components/ActionButton';
import { RuqaaText as Text } from '../components/RuqaaText';
import { SupportWebsiteModal, MURSHID_FEATURES_URL } from './SupportWebsiteModal';
import { useAppTheme } from '../theme/ThemeProvider';
import { radii, spacing, typography } from '../theme';

const WEBSITE_OPENED_KEY = '@murshid/required-website-opened';

export async function hasOpenedRequiredWebsite() {
  try {
    return (await AsyncStorage.getItem(WEBSITE_OPENED_KEY)) === 'true';
  } catch {
    return false;
  }
}

export function WebsiteLaunchGate({ onComplete }: { onComplete: () => void }) {
  const { colors } = useAppTheme();
  const [websiteVisible, setWebsiteVisible] = useState(false);
  const completionStarted = useRef(false);

  const complete = useCallback(async () => {
    if (completionStarted.current) return;
    completionStarted.current = true;
    await AsyncStorage.setItem(WEBSITE_OPENED_KEY, 'true').catch(() => undefined);
    setWebsiteVisible(false);
    onComplete();
  }, [onComplete]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.brandIcon, { backgroundColor: colors.tealSoft }]}>
          <Ionicons name="globe-outline" size={29} color={colors.tealDark} />
        </View>
        <Text style={[styles.eyebrow, { color: colors.tealDark }]}>خطوة أولى لمرة واحدة</Text>
        <Text style={[styles.title, { color: colors.ink }]}>افتح الموقع الإلكتروني الآن</Text>
        <Text style={[styles.body, { color: colors.inkMuted }]}>قبل استخدام مُرشد لأول مرة، افتح موقع مُرشد للتعرّف على المميزات والتحديثات. هتلاقي الموقع بيفتح جوّه التطبيق، وبعد ما ترجع هتقدر تستخدم باقي الأقسام.</Text>
        <View style={styles.buttonWrap}>
          <ActionButton onPress={() => setWebsiteVisible(true)}>افتح الموقع الإلكتروني الآن</ActionButton>
        </View>
        <View style={[styles.note, { backgroundColor: colors.paper, borderColor: colors.line }]}>
          <Ionicons name="phone-portrait-outline" size={18} color={colors.tealDark} />
          <Text style={[styles.noteText, { color: colors.inkMuted }]}>مش هتحتاج تخرج لمتصفح خارجي. الموقع هيتفتح داخل مُرشد.</Text>
        </View>
      </ScrollView>
      <SupportWebsiteModal
        visible={websiteVisible}
        onClose={() => void complete()}
        url={MURSHID_FEATURES_URL}
        title="موقع مُرشد الإلكتروني"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, paddingBottom: spacing.xxl },
  brandIcon: { width: 76, height: 76, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  eyebrow: { ...typography.label, letterSpacing: 0.4, textAlign: 'center' },
  title: { ...typography.display, textAlign: 'center', marginTop: spacing.sm },
  body: { ...typography.body, lineHeight: 25, textAlign: 'center', marginTop: spacing.md, maxWidth: 420 },
  buttonWrap: { width: '100%', maxWidth: 420, marginTop: spacing.xl },
  note: { width: '100%', maxWidth: 420, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radii.md, marginTop: spacing.lg },
  noteText: { ...typography.body, flex: 1, fontSize: 12, textAlign: 'right' },
});
