import { useAppTheme } from '../theme/ThemeProvider';
import { StyleSheet, View } from 'react-native';
import { RuqaaText as Text } from './RuqaaText';
import { spacing, typography, ThemeColors } from '../theme';
export function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return <View style={styles.wrap}><View style={styles.icon}><Text style={styles.iconText}>{icon}</Text></View><Text style={styles.title}>{title}</Text><Text style={styles.body}>{body}</Text></View>;
}
function createStyles(colors: ThemeColors) { return StyleSheet.create({ wrap: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg }, icon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }, iconText: { fontSize: 26, color: colors.tealDark }, title: { ...typography.h2, color: colors.ink, marginBottom: spacing.xs }, body: { ...typography.body, color: colors.inkMuted, textAlign: 'center' } }); }
