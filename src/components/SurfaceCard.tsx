import { useAppTheme } from '../theme/ThemeProvider';
import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { radii, shadows, spacing, ThemeColors } from '../theme';

export function SurfaceCard({ children, accent }: PropsWithChildren<{ accent?: string }>) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return <View style={[styles.card, accent ? { borderTopColor: accent, borderTopWidth: 3 } : null]}>{children}</View>;
}
function createStyles(colors: ThemeColors) { return StyleSheet.create({ card: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: spacing.md, ...shadows.card } }); }
