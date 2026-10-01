import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
export function ScreenHeader({ eyebrow, title, detail, verified = false }: { eyebrow?: string; title: string; detail?: string; verified?: boolean }) {
  return <View style={styles.wrap}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<View style={styles.titleRow}><Text style={styles.title}>{title}</Text>{verified ? <View accessibilityLabel="حساب موثق" style={styles.verified}><Ionicons name="checkmark" size={12} color={colors.paper} /></View> : null}</View>{detail ? <Text style={styles.detail}>{detail}</Text> : null}</View>;
}
const styles = StyleSheet.create({ wrap: { marginBottom: spacing.lg }, eyebrow: { ...typography.label, color: colors.tealDark, textTransform: 'uppercase', marginBottom: spacing.xs }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, title: { ...typography.h1, color: colors.ink }, verified: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' }, detail: { ...typography.body, color: colors.inkMuted, marginTop: spacing.xs } });
