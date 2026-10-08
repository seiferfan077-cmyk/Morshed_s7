import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text, RuqaaTextInput as TextInput } from '../components/RuqaaText';
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { MediaType } from '../types/domain';
import { colors, radii, spacing, typography } from '../theme';
import { StoredMediaItem, deleteStoredMedia, getPrivacyRecoveryQuestion, hasPrivacyPin, importToVault, listStoredMedia, savePrivacyCredentials, setStoredMediaHidden, updatePrivacyPin, verifyPrivacyPin, verifyPrivacyRecoveryAnswer } from '../services/storage/mediaVaultService';

type Filter = 'all' | MediaType | 'private';
type DeviceItem = { id: string; deviceAssetId: string; uri: string; filename: string; type: 'image' | 'video'; createdAt: string; hidden: boolean; source: 'device' };
type DisplayItem = StoredMediaItem | DeviceItem;
const VIEWER_WIDTH = Dimensions.get('window').width;

function VideoAsset({ uri, large = false }: { uri: string; large?: boolean }) {
  const player = useVideoPlayer(uri, (instance) => { instance.loop = false; });
  return <VideoView player={player} contentFit="contain" nativeControls style={large ? styles.viewerVideo : styles.videoPreview} />;
}

function typeFromAsset(name: string, mimeType?: string): MediaType {
  const value = `${mimeType ?? ''} ${name}`.toLowerCase();
  if (value.includes('video') || /\.(mp4|mov|m4v|webm|avi)$/i.test(name)) return 'video';
  if (value.includes('image') || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name)) return 'image';
  return 'file';
}

async function getAllDeviceAssets(mediaType: 'photo' | 'video') {
  const assets: MediaLibrary.Asset[] = [];
  let after: string | undefined;
  do {
    const page = await MediaLibrary.getAssetsAsync({ first: 100, after, mediaType, sortBy: [MediaLibrary.SortBy.creationTime] });
    assets.push(...page.assets);
    after = page.hasNextPage ? page.endCursor : undefined;
  } while (after);
  return assets;
}

export function MediaScreen() {
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [deviceItems, setDeviceItems] = useState<DeviceItem[]>([]);
  const [deviceCount, setDeviceCount] = useState(0);
  const [copying, setCopying] = useState(false);
  const [storedItems, setStoredItems] = useState<StoredMediaItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [actionItem, setActionItem] = useState<DisplayItem | null>(null);
  const [privateUnlocked, setPrivateUnlocked] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinMode, setPinMode] = useState<'create' | 'unlock' | 'recover' | 'reset'>('unlock');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pendingHide, setPendingHide] = useState<DisplayItem | null>(null);
  const [secretTaps, setSecretTaps] = useState(0);
  const viewerRef = useRef<FlatList<DisplayItem>>(null);

  const load = useCallback(async (refresh = false) => {
    if (!permission?.granted) return;
    setError(null);
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [photos, videos, stored] = await Promise.all([
        getAllDeviceAssets('photo'),
        getAllDeviceAssets('video'),
        listStoredMedia(),
      ]);
      const assets = [...photos, ...videos].sort((a, b) => (b.creationTime ?? 0) - (a.creationTime ?? 0));
      const mapped: DeviceItem[] = assets.map((asset) => ({ id: `device-${asset.id}`, deviceAssetId: asset.id, uri: asset.uri, filename: asset.filename, type: asset.mediaType === 'video' ? 'video' : 'image', createdAt: new Date((asset.creationTime || Date.now())).toISOString(), hidden: false, source: 'device' }));
      setDeviceItems(mapped);
      setDeviceCount(mapped.length);
      setStoredItems(stored);
    } catch { setError('تعذر قراءة وسائط الجهاز حاليًا. حاول مرة أخرى.'); } finally { setLoading(false); setRefreshing(false); }
  }, [permission?.granted]);

  useEffect(() => { load(); if (!permission?.granted) return; const subscription = MediaLibrary.addListener(() => { load(true); }); return () => subscription.remove(); }, [load, permission?.granted]);

  const allItems = useMemo(() => storedItems, [storedItems]);
  const visibleItems = useMemo(() => allItems.filter((item) => {
    if (filter === 'private') return privateUnlocked && item.hidden;
    if (item.hidden) return false;
    return filter === 'all' || item.type === filter;
  }), [allItems, filter]);

  const importAssets = async (acceptedTypes: string | string[]) => {
    const result = await DocumentPicker.getDocumentAsync({ type: acceptedTypes, multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    setLoading(true);
    try {
      for (const asset of result.assets) await importToVault(asset.uri, asset.name, typeFromAsset(asset.name, asset.mimeType), asset.mimeType, asset.size);
      await load(true);
    } catch { setError('تعذر نسخ بعض العناصر إلى مساحة مُرشد.'); } finally { setLoading(false); }
  };

  const openViewer = (item: DisplayItem) => { const index = visibleItems.findIndex((entry) => entry.id === item.id); setViewerStart(Math.max(0, index)); setViewerOpen(true); };

  const removeItem = async (item: DisplayItem) => {
    setActionItem(null);
    await deleteStoredMedia(item.id);
    await load(true);
  };

  const hideItem = async (item: DisplayItem) => {
    setActionItem(null);
    if (!(await hasPrivacyPin())) { setPendingHide(item); setPinMode('create'); setPin(''); setPinConfirm(''); setPinOpen(true); return; }
    await setStoredMediaHidden(item.id, true);
    await load(true);
  };

  const startRecovery = async () => {
    setRecoveryQuestion((await getPrivacyRecoveryQuestion()) ?? '');
    setRecoveryAnswer('');
    setPin('');
    setPinConfirm('');
    setPinError(null);
    setPinMode('recover');
  };

  const validPin = pin.trim().length >= 4 && pin.trim().length <= 32;
  const submitPin = async () => {
    if (pinMode === 'recover') {
      if (await verifyPrivacyRecoveryAnswer(recoveryAnswer)) { setPinMode('reset'); setPin(''); setPinConfirm(''); setPinError(null); }
      else setPinError('إجابة الاسترجاع غير صحيحة.');
      return;
    }
    if (pinMode === 'unlock') {
      if (await verifyPrivacyPin(pin)) { setPrivateUnlocked(true); setFilter('private'); setPinOpen(false); setPinError(null); }
      else setPinError('رمز غير صحيح. يمكنك استخدام سؤال الاسترجاع.');
      setPin('');
      return;
    }
    if (!validPin) { setPinError('استخدم رمزًا من 4 إلى 32 حرفًا أو رقمًا، بالعربية أو الإنجليزية.'); return; }
    if (pin !== pinConfirm) { setPinError('الرمزان غير متطابقين.'); return; }
    if (pinMode === 'create') {
      if (recoveryQuestion.trim().length < 4 || recoveryAnswer.trim().length < 2) { setPinError('اكتب سؤال استرجاع وإجابته حتى لا تفقد الوصول للصور.'); return; }
      await savePrivacyCredentials(pin, recoveryQuestion, recoveryAnswer);
      Alert.alert('تم حفظ رمز الخصوصية', `تم حفظ الرمز بأمان. تذكير محدود: آخر حرف منه هو «${pin.slice(-1)}» فقط.`);
      if (pendingHide) { await setStoredMediaHidden(pendingHide.id, true); setPendingHide(null); await load(true); }
    } else {
      await updatePrivacyPin(pin);
      Alert.alert('تم تغيير رمز الخصوصية', `تم تغيير الرمز. آخر حرف منه هو «${pin.slice(-1)}» فقط.`);
    }
    setPrivateUnlocked(true); setFilter('private'); setPinOpen(false); setPin(''); setPinConfirm(''); setPinError(null);
  };

  const copyAllDeviceMedia = () => Alert.alert('نسخ مكتبة الجهاز إلى مُرشد؟', `سيتم نسخ ${deviceItems.length} صورة وفيديو إلى مساحة الجهاز التي يستخدمها التطبيق. قد يستهلك ذلك عدة جيجابايت، ولا تُحذف النسخ عند حذف الأصل من معرض الجهاز.`, [{ text: 'إلغاء', style: 'cancel' }, { text: 'نسخ الآن', onPress: async () => { setCopying(true); try { for (const item of deviceItems) await importToVault(item.uri, item.filename, item.type, undefined, undefined, item.deviceAssetId); await load(true); } catch { setError('تعذر نسخ كامل المكتبة. تحقق من مساحة الجهاز.'); } finally { setCopying(false); } } }]);

  const openPrivate = async () => { setPinMode((await hasPrivacyPin()) ? 'unlock' : 'create'); setPin(''); setPinConfirm(''); setRecoveryQuestion(''); setRecoveryAnswer(''); setPinError(null); setPinOpen(true); };
  const secretTap = () => { const next = secretTaps + 1; setSecretTaps(next); if (next === 3) { setSecretTaps(0); openPrivate(); } setTimeout(() => setSecretTaps(0), 900); };

  if (!permission) return <View style={styles.center}><ActivityIndicator color={colors.tealDark} /></View>;
  if (!permission.granted) return <View style={styles.screen}><ScreenHeader eyebrow="DEVICE GALLERY" title="المعرض" detail="يطلب مُرشد إذنًا واضحًا لعرض صور وفيديوهات جهازك." /><View style={styles.permissionCard}><View style={styles.permissionIcon}><Ionicons name="images-outline" size={28} color={colors.tealDark} /></View><Text style={styles.permissionTitle}>اسمح بالوصول إلى الصور والفيديوهات</Text><Text style={styles.permissionBody}>لن يقرأ مُرشد أي وسائط قبل موافقتك. الاستيراد إلى مساحة مُرشد ينشئ نسخة مستقلة، ولا يحذف الأصل من معرض الجهاز.</Text><Pressable onPress={requestPermission} style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}><Text style={styles.permissionButtonText}>السماح بالوصول</Text></Pressable></View></View>;

  return <View style={styles.screen}><ScreenHeader eyebrow="LIVING GALLERY" title="المعرض" detail={`مساحة مُرشد مستقلة · ${storedItems.length} محفوظة · ${deviceCount} على الجهاز`} /><View style={styles.notice}><Ionicons name="information-circle-outline" size={18} color={colors.tealDark} /><Text style={styles.noticeText}>المعروض هنا نسخ محفوظة داخل مساحة مُرشد فقط. حذف الأصل من صور الجهاز لا يحذف النسخة المحفوظة. النسخ تستهلك مساحة الجهاز، ولا تُرفع إلى السحابة.</Text></View><View style={styles.actions}><Pressable onPress={copyAllDeviceMedia} disabled={copying} style={styles.actionButton}><Ionicons name="cloud-upload-outline" size={18} color={colors.paper} /><Text style={styles.actionText}>نسخ صور الجهاز</Text></Pressable><Pressable onPress={() => importAssets('*/*')} style={[styles.actionButton, styles.fileButton]}><Ionicons name="folder-open-outline" size={18} color={colors.ink} /><Text style={[styles.actionText, styles.fileText]}>استيراد ملفات</Text></Pressable></View><Pressable onPress={() => importAssets(['image/*', 'video/*'])} style={styles.importLink}><Ionicons name="add-circle-outline" size={16} color={colors.tealDark} /><Text style={styles.importLinkText}>اختيار صور أو فيديوهات محددة</Text></Pressable><View style={styles.filterRow}>{(['all', 'image', 'video', 'file', ...(privateUnlocked ? ['private'] : [])] as Filter[]).map((value) => <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filterChip, filter === value && styles.filterActive]}><Ionicons name={value === 'all' ? 'apps-outline' : value === 'image' ? 'image-outline' : value === 'video' ? 'videocam-outline' : value === 'file' ? 'document-outline' : 'lock-closed-outline'} size={15} color={filter === value ? colors.paper : colors.inkMuted} /><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value === 'all' ? 'الكل' : value === 'image' ? 'الصور' : value === 'video' ? 'الفيديو' : value === 'file' ? 'الملفات' : 'الخصوصية'}</Text></Pressable>)}</View>{error ? <View style={styles.errorNotice}><Ionicons name="alert-circle-outline" size={18} color={colors.coral} /><Text style={styles.noticeText}>{error}</Text></View> : null}{loading && !allItems.length ? <View style={styles.center}><ActivityIndicator color={colors.tealDark} /></View> : <FlatList data={visibleItems} numColumns={3} keyExtractor={(item) => item.id} contentContainerStyle={styles.grid} columnWrapperStyle={styles.row} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.tealDark} />} renderItem={({ item }) => <Pressable onPress={() => openViewer(item)} onLongPress={() => setActionItem(item)} delayLongPress={450} style={styles.tile}>{item.type === 'image' ? <Image source={{ uri: item.uri }} style={styles.image} /> : <View style={styles.typeTile}><Ionicons name={item.type === 'video' ? 'play-circle-outline' : 'document-text-outline'} size={34} color={colors.tealDark} /><Text numberOfLines={2} style={styles.fileName}>{item.filename}</Text></View>}</Pressable>} ListEmptyComponent={<View style={styles.empty}><Ionicons name="images-outline" size={34} color={colors.inkFaint} /><Text style={styles.emptyTitle}>{filter === 'private' ? 'قسم الصور الخصوصية مغلق' : 'لا توجد وسائط هنا'}</Text><Text style={styles.emptyBody}>{filter === 'private' ? 'اضغط الصورة السوداء أسفل المعرض ثلاث مرات لإدخال الرمز.' : 'استورد صورًا أو فيديوهات أو ملفات من جهازك.'}</Text></View>} ListFooterComponent={<Pressable onPress={secretTap} style={styles.secretTile}><View style={styles.secretBlack}><Ionicons name="lock-closed-outline" size={26} color={colors.paper} /></View><Text style={styles.secretText}>قسم الصور الخصوصية</Text></Pressable>} />}<Modal visible={Boolean(actionItem)} transparent animationType="fade" onRequestClose={() => setActionItem(null)}><View style={styles.modalBackdrop}><View style={styles.actionCard}><Text style={styles.actionTitle}>إدارة العنصر</Text><Text style={styles.actionBody}>الحذف يزيل نسخة مُرشد فقط، والإخفاء ينقل العنصر إلى الصور الخصوصية.</Text><Pressable onPress={() => actionItem && hideItem(actionItem)} style={styles.modalAction}><Ionicons name="eye-off-outline" size={19} color={colors.tealDark} /><Text style={styles.modalActionText}>إخفاء في الصور الخصوصية</Text></Pressable><Pressable onPress={() => actionItem && removeItem(actionItem)} style={[styles.modalAction, styles.deleteAction]}><Ionicons name="trash-outline" size={19} color={colors.danger} /><Text style={[styles.modalActionText, styles.deleteText]}>حذف من مُرشد فقط</Text></Pressable><Pressable onPress={() => setActionItem(null)} style={styles.cancelAction}><Text style={styles.cancelText}>إلغاء</Text></Pressable></View></View></Modal><Modal visible={pinOpen} transparent animationType="fade" onRequestClose={() => setPinOpen(false)}><View style={styles.modalBackdrop}><View style={styles.actionCard}><Text style={styles.actionTitle}>{pinMode === 'create' ? 'أنشئ رمز الصور الخصوصية' : pinMode === 'recover' ? 'استرجاع رمز الصور الخصوصية' : pinMode === 'reset' ? 'أنشئ رمزًا جديدًا' : 'أدخل رمز الصور الخصوصية'}</Text><Text style={styles.actionBody}>{pinMode === 'create' ? 'لا تنسَ الرمز أبدًا. سيُحفظ محليًا ولن يُرسل إلى أي خادم.' : pinMode === 'recover' ? 'أجب عن سؤال الاسترجاع الذي حددته سابقًا.' : pinMode === 'reset' ? 'تم التحقق من سؤال الاسترجاع. اكتب رمزًا جديدًا.' : 'الرمز لا يُرسل إلى أي خادم.'}</Text>{pinMode !== 'recover' ? <TextInput value={pin} onChangeText={setPin} maxLength={32} secureTextEntry placeholder="رمز من 4 إلى 32 حرفًا/رقمًا" placeholderTextColor={colors.inkFaint} style={styles.pinInput} /> : <><Text style={styles.recoveryQuestion}>{recoveryQuestion || 'لا يوجد سؤال استرجاع محفوظ.'}</Text><TextInput value={recoveryAnswer} onChangeText={setRecoveryAnswer} placeholder="إجابة سؤال الاسترجاع" placeholderTextColor={colors.inkFaint} style={styles.pinInput} /></>}{(pinMode === 'create' || pinMode === 'reset') ? <TextInput value={pinConfirm} onChangeText={setPinConfirm} maxLength={32} secureTextEntry placeholder="تأكيد الرمز" placeholderTextColor={colors.inkFaint} style={styles.pinInput} /> : null}{pinMode === 'create' ? <><TextInput value={recoveryQuestion} onChangeText={setRecoveryQuestion} placeholder="سؤال الاسترجاع: من هو معلمك المفضل؟" placeholderTextColor={colors.inkFaint} style={styles.pinInput} /><TextInput value={recoveryAnswer} onChangeText={setRecoveryAnswer} placeholder="إجابة سؤال الاسترجاع" placeholderTextColor={colors.inkFaint} style={styles.pinInput} /></> : null}{pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}{pinMode === 'unlock' ? <Pressable onPress={startRecovery} style={styles.forgotButton}><Text style={styles.forgotText}>نسيت الرمز؟ استخدم سؤال الاسترجاع</Text></Pressable> : null}<Pressable onPress={submitPin} style={styles.savePin}><Text style={styles.savePinText}>{pinMode === 'create' ? 'حفظ الرمز وسؤال الاسترجاع' : pinMode === 'recover' ? 'تحقق من الإجابة' : pinMode === 'reset' ? 'حفظ الرمز الجديد' : 'فتح القسم'}</Text></Pressable><Pressable onPress={() => setPinOpen(false)} style={styles.cancelAction}><Text style={styles.cancelText}>إلغاء</Text></Pressable></View></View></Modal>{viewerOpen ? <Viewer items={visibleItems} startIndex={viewerStart} onClose={() => setViewerOpen(false)} /> : null}</View>;
}

function Viewer({ items, startIndex, onClose }: { items: DisplayItem[]; startIndex: number; onClose: () => void }) {
  const ref = useRef<FlatList<DisplayItem>>(null);
  useEffect(() => { setTimeout(() => ref.current?.scrollToIndex({ index: startIndex, animated: false }), 50); }, [startIndex]);
  return <Modal visible animationType="fade" onRequestClose={onClose}><View style={styles.viewer}><Pressable onPress={onClose} style={styles.viewerClose}><Ionicons name="close" size={24} color={colors.paper} /></Pressable><FlatList ref={ref} data={items} horizontal pagingEnabled keyExtractor={(item) => item.id} getItemLayout={(_, index) => ({ length: VIEWER_WIDTH, offset: VIEWER_WIDTH * index, index })} renderItem={({ item }) => <View style={styles.viewerPage}>{item.type === 'image' ? <Image source={{ uri: item.uri }} style={styles.viewerImage} resizeMode="contain" /> : item.type === 'video' ? <VideoAsset uri={item.uri} large /> : <View style={styles.fileViewer}><Ionicons name="document-text-outline" size={72} color={colors.tealSoft} /><Text style={styles.viewerFileName}>{item.filename}</Text><Text style={styles.viewerHint}>هذا الملف محفوظ داخل مساحة مُرشد.</Text></View>}</View>} /></View></Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(5,7,8,0.56)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }, actionCard: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg }, actionTitle: { ...typography.h2, color: colors.ink }, actionBody: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: spacing.xs, lineHeight: 18 }, modalAction: { minHeight: 48, borderRadius: radii.md, backgroundColor: colors.tealSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.md }, modalActionText: { ...typography.label, color: colors.tealDark }, deleteAction: { backgroundColor: colors.coralSoft }, deleteText: { color: colors.danger }, cancelAction: { alignItems: 'center', padding: spacing.md, marginTop: spacing.xs }, cancelText: { ...typography.label, color: colors.inkMuted }, pinInput: { minHeight: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, color: colors.ink, paddingHorizontal: spacing.md, marginTop: spacing.sm, ...typography.body }, savePin: { minHeight: 48, borderRadius: radii.md, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md }, savePinText: { ...typography.label, color: colors.paper }, pinError: { ...typography.body, color: colors.danger, fontSize: 12, marginTop: spacing.sm, lineHeight: 18 }, forgotButton: { alignItems: 'center', paddingVertical: spacing.sm }, forgotText: { ...typography.label, color: colors.tealDark, fontSize: 11 }, recoveryQuestion: { ...typography.body, color: colors.ink, backgroundColor: colors.tealSoft, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.sm, lineHeight: 20 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, permissionCard: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.paper, alignItems: 'center', borderWidth: 1, borderColor: colors.line }, permissionIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }, permissionTitle: { ...typography.h2, color: colors.ink, textAlign: 'center' }, permissionBody: { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 }, permissionButton: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.ink }, permissionButtonText: { ...typography.label, color: colors.paper }, notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: spacing.sm, marginTop: spacing.sm, borderRadius: radii.md, backgroundColor: colors.tealSoft }, errorNotice: { backgroundColor: colors.coralSoft, marginTop: spacing.sm }, noticeText: { ...typography.body, flex: 1, color: colors.ink, fontSize: 11, lineHeight: 17 }, actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }, importLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: spacing.sm }, importLinkText: { ...typography.label, color: colors.tealDark, fontSize: 11 }, actionButton: { flex: 1, minHeight: 44, borderRadius: radii.md, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, fileButton: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, actionText: { ...typography.label, color: colors.paper, fontSize: 11 }, fileText: { color: colors.ink }, filterRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md }, filterChip: { flex: 1, minHeight: 36, borderRadius: radii.pill, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: colors.line }, filterActive: { backgroundColor: colors.tealDark, borderColor: colors.tealDark }, filterText: { ...typography.label, color: colors.inkMuted, fontSize: 10 }, filterTextActive: { color: colors.paper }, grid: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm }, row: { gap: spacing.sm, marginBottom: spacing.sm }, tile: { flex: 1, aspectRatio: 1, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.line, position: 'relative' }, image: { width: '100%', height: '100%', resizeMode: 'cover' }, typeTile: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 6, backgroundColor: colors.paper }, fileName: { ...typography.body, color: colors.inkMuted, fontSize: 10, textAlign: 'center', marginTop: 5 }, deviceBadge: { position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(16,33,43,0.65)', alignItems: 'center', justifyContent: 'center' }, empty: { alignItems: 'center', paddingTop: spacing.xxl }, emptyTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.sm }, emptyBody: { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.xs }, secretTile: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.lg }, secretBlack: { width: 72, height: 72, borderRadius: radii.md, backgroundColor: '#050708', alignItems: 'center', justifyContent: 'center' }, secretText: { ...typography.label, color: colors.inkMuted, fontSize: 11, marginTop: 5 }, pressed: { opacity: 0.7 }, viewer: { flex: 1, backgroundColor: '#050708' }, viewerClose: { position: 'absolute', zIndex: 2, top: 54, right: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }, viewerPage: { width: VIEWER_WIDTH, flex: 1, alignItems: 'center', justifyContent: 'center' }, viewerImage: { width: '100%', height: '80%' }, viewerVideo: { width: '100%', height: '80%' }, videoPreview: { width: '100%', height: '100%' }, fileViewer: { alignItems: 'center', padding: spacing.lg }, viewerFileName: { ...typography.h2, color: colors.paper, textAlign: 'center', marginTop: spacing.md }, viewerHint: { ...typography.body, color: colors.inkFaint, marginTop: spacing.sm },
});
