import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { radii, spacing, ThemeColors, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { RuqaaText as Text } from './RuqaaText';

type ActionButtonProps = PropsWithChildren<{
  onPress?: () => void;
  tone?: 'primary' | 'quiet';
  themeColors?: ThemeColors;
}>;

export function ActionButton({ children, onPress, tone = 'primary', themeColors }: ActionButtonProps) {
  const { colors: appColors } = useAppTheme();
  const styles = createStyles(themeColors ?? appColors);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.base, tone === 'quiet' ? styles.quiet : styles.primary, pressed && styles.pressed]}
    >
      <Text style={tone === 'quiet' ? styles.quietText : styles.primaryText}>{children}</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    base: { minHeight: 48, borderRadius: radii.md, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
    primary: { backgroundColor: colors.ink },
    quiet: { backgroundColor: colors.tealSoft },
    primaryText: { ...typography.label, color: colors.paper },
    quietText: { ...typography.label, color: colors.tealDark },
    pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  });
}
