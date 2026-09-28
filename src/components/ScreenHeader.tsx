import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
export function ScreenHeader({ eyebrow, title, detail }: { eyebrow?: string; title: string; detail?: string }) {
  return <View style={styles.wrap}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.title}>{title}</Text>{detail ? <Text style={styles.detail}>{detail}</Text> : null}</View>;
}
const styles = StyleSheet.create({ wrap: { marginBottom: spacing.lg }, eyebrow: { ...typography.label, color: colors.tealDark, textTransform: 'uppercase', marginBottom: spacing.xs }, title: { ...typography.h1, color: colors.ink }, detail: { ...typography.body, color: colors.inkMuted, marginTop: spacing.xs } });
