import { StyleSheet, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../theme';
export function AIScreen() { return <View style={styles.screen}><ScreenHeader eyebrow="AI" title="المساعد" detail="تواصل آمن عبر Backend مستقل، بلا مفاتيح سرية داخل التطبيق." /><EmptyState icon="✦" title="المساعد غير موصل بعد" body="طبقة AIProvider جاهزة لتبديل المزود لاحقًا. لن يتم إرسال أي طلب قبل إعداد Backend ومفتاحه خارج التطبيق." /></View>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg } });
