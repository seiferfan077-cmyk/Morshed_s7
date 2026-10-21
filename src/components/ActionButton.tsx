import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { radii, spacing, typography, type ThemeColors } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { RuqaaText as Text } from './RuqaaText';

type ActionButtonProps = PropsWithChildren<{
  onPress?: () => void;
  tone?: 'primary' | 'quiet';
  themeColors?: ThemeColors;
  buttonStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}>;

export function ActionButton({ children, onPress, tone = 'primary', themeColors, buttonStyle, labelStyle }: ActionButtonProps) {
  const { colors: appColors } = useAppTheme();
  const styles = createStyles(themeColors ?? appColors);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.base, tone === 'quiet' ? styles.quiet : styles.primary, buttonStyle, pressed && styles.pressed]}
    >
      <Text style={[tone === 'quiet' ? styles.quietText : styles.primaryText, labelStyle]}>{children}</Text>
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
