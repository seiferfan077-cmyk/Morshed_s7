import { StyleSheet, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../theme';
export function MediaScreen() { return <View style={styles.screen}><ScreenHeader eyebrow="Media" title="المعرض" detail="صور وفيديو محفوظة داخل مساحة التطبيق." /><EmptyState icon="▧" title="لا توجد وسائط محفوظة" body="سيظهر المحتوى هنا فور اكتمال مسار التنزيل والتحقق وحفظ الـ metadata." /></View>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg } });
