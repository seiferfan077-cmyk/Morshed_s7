import { StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../theme';
export function BrowserScreen() { return <View style={styles.screen}><ScreenHeader eyebrow="Browser / Kiosk" title="المتصفح" detail="واجهة المتصفح مهيأة؛ سيتم ربط WebView والتنزيلات في المرحلة التالية." /><EmptyState icon="◎" title="المتصفح قيد البناء" body="العقد المعمارية جاهزة لدعم العنوان والبحث وسجل التصفح وقيود Kiosk دون ادعاء تنفيذها الآن." /></View>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg } });
