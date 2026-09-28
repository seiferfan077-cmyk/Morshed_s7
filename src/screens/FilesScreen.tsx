import { StyleSheet, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../theme';
export function FilesScreen() { return <View style={styles.screen}><ScreenHeader eyebrow="Files" title="الملفات" detail="مركز واحد للملفات المحلية والتنزيلات." /><EmptyState icon="□" title="لا توجد ملفات" body="سيتم ربط FileSystem وعمليات البحث والحذف والمشاركة بعد تثبيت طبقة التخزين الأصلية." /></View>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg } });
