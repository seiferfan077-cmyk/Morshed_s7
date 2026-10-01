import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radii, spacing, typography } from '../theme';

type DeviceAsset = MediaLibrary.Asset;

export function MediaScreen() {
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [assets, setAssets] = useState<DeviceAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(async (refresh = false) => {
    if (!permission?.granted) return;
    setError(null);
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        first: 120,
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
      setAssets(result.assets);
    } catch {
      setError('تعذر قراءة معرض الجهاز حاليًا. حاول مرة أخرى.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [permission?.granted]);

  useEffect(() => {
    loadAssets();
    if (!permission?.granted) return;
    const subscription = MediaLibrary.addListener(() => { loadAssets(true); });
    return () => subscription.remove();
  }, [loadAssets, permission?.granted]);

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={colors.tealDark} /></View>;
  }

  if (!permission.granted) {
    return <View style={styles.screen}><ScreenHeader eyebrow="DEVICE GALLERY" title="المعرض" detail="صور جهازك تظهر هنا مباشرة، من دون نسخ أو رفع احتياطي." /><View style={styles.permissionCard}><View style={styles.permissionIcon}><Ionicons name="images-outline" size={28} color={colors.tealDark} /></View><Text style={styles.permissionTitle}>اسمح بالوصول إلى صور الجهاز</Text><Text style={styles.permissionBody}>يستخدم مُرشد الصور الموجودة على جهازك للعرض فقط. لا يتم نسخها إلى مساحة التطبيق ولا رفعها تلقائيًا.</Text><Pressable onPress={requestPermission} style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}><Text style={styles.permissionButtonText}>السماح بالوصول</Text></Pressable></View></View>;
  }

  return <View style={styles.screen}><ScreenHeader eyebrow="DEVICE GALLERY" title="المعرض" detail={`${assets.length} صورة من جهازك · عرض مباشر بلا نسخ احتياطي`} />{error ? <View style={styles.notice}><Ionicons name="alert-circle-outline" size={18} color={colors.coral} /><Text style={styles.noticeText}>{error}</Text></View> : null}{loading && assets.length === 0 ? <View style={styles.center}><ActivityIndicator color={colors.tealDark} /></View> : <FlatList data={assets} numColumns={3} keyExtractor={(item) => item.id} contentContainerStyle={styles.grid} columnWrapperStyle={styles.row} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAssets(true)} tintColor={colors.tealDark} />} renderItem={({ item }) => <View style={styles.tile}><Image source={{ uri: item.uri }} style={styles.image} /></View>} ListEmptyComponent={<View style={styles.empty}><Ionicons name="images-outline" size={34} color={colors.inkFaint} /><Text style={styles.emptyTitle}>لا توجد صور</Text><Text style={styles.emptyBody}>أضف صورًا إلى جهازك وستظهر هنا تلقائيًا.</Text></View>} />}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  permissionCard: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.paper, alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  permissionIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  permissionTitle: { ...typography.h2, color: colors.ink, textAlign: 'center' },
  permissionBody: { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  permissionButton: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.ink },
  permissionButtonText: { ...typography.label, color: colors.paper },
  grid: { paddingTop: spacing.md, paddingBottom: spacing.xxl },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  tile: { flex: 1, aspectRatio: 1, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.line, position: 'relative' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: spacing.sm, marginTop: spacing.sm, borderRadius: radii.md, backgroundColor: colors.coralSoft },
  noticeText: { ...typography.body, flex: 1, color: colors.ink, fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.sm },
  emptyBody: { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.xs },
  pressed: { opacity: 0.7 },
});
