import { PropsWithChildren } from 'react';
import { RuqaaText as Text } from './RuqaaText';
import { Pressable, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

export function ActionButton({ children, onPress, tone = 'primary' }: PropsWithChildren<{ onPress?: () => void; tone?: 'primary' | 'quiet' }>) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.base, tone === 'quiet' ? styles.quiet : styles.primary, pressed && styles.pressed]}><Text style={tone === 'quiet' ? styles.quietText : styles.primaryText}>{children}</Text></Pressable>;
}
const styles = StyleSheet.create({ base: { minHeight: 48, borderRadius: radii.md, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' }, primary: { backgroundColor: colors.ink }, quiet: { backgroundColor: colors.tealSoft }, primaryText: { ...typography.label, color: colors.paper }, quietText: { ...typography.label, color: colors.tealDark }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] } });
