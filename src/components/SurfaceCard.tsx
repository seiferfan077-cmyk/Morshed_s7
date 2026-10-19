import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { radii, shadows, spacing, ThemeColors } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

type SurfaceCardProps = PropsWithChildren<{
  accent?: string;
  themeColors?: ThemeColors;
}>;

export function SurfaceCard({ children, accent, themeColors }: SurfaceCardProps) {
  const { colors: appColors } = useAppTheme();
  const styles = createStyles(themeColors ?? appColors);
  return <View style={[styles.card, accent ? { borderTopColor: accent, borderTopWidth: 3 } : null]}>{children}</View>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: spacing.md, ...shadows.card },
  });
}
