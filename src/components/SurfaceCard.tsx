import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii, shadows, spacing } from '../theme';

export function SurfaceCard({ children, accent }: PropsWithChildren<{ accent?: string }>) {
  return <View style={[styles.card, accent ? { borderTopColor: accent, borderTopWidth: 3 } : null]}>{children}</View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: spacing.md, ...shadows.card } });
