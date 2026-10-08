import { useAppTheme } from '../theme/ThemeProvider';
import { StyleSheet, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';
import { spacing, ThemeColors } from '../theme';
export function FilesScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors); return <View style={styles.screen}><ScreenHeader eyebrow="Files" title="الملفات" detail="مركز واحد للملفات المحلية والتنزيلات." /><EmptyState icon="□" title="لا توجد ملفات" body="سيتم ربط FileSystem وعمليات البحث والحذف والمشاركة بعد تثبيت طبقة التخزين الأصلية." /></View>; }
function createStyles(colors: ThemeColors) { return StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg } }); }
