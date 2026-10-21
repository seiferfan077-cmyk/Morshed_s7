import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, NativeModules, Platform, Pressable, RefreshControl, StyleSheet, View, type ViewToken } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Image as ExpoImage } from 'expo-image';
import { VideoThumbnail as VideoThumbnailRef, VideoView, useVideoPlayer } from 'expo-video';
import { ScreenHeader } from '../components/ScreenHeader';
import { showAppError } from '../components/AppDialogProvider';
import { RuqaaText as Text, RuqaaTextInput as TextInput } from '../components/RuqaaText';
import { useAppTheme } from '../theme/ThemeProvider';
import { radii, spacing, typography, ThemeColors } from '../theme';
import { MediaType } from '../types/domain';
import {
  addMediaToAlbum, createAlbum, createFolder, deleteAlbum, deleteFolder, deleteStoredMedia,
  getMediaStats, getPrivacyRecoveryQuestion, hasPrivacyPin,
  listAlbums, listFolders, listStoredMediaPage, MediaAlbum, MediaFolder, MediaImportJob,
  MediaPageOptions, MediaStats, removeMediaFromAlbum, renameAlbum, renameFolder,
  renameStoredMedia, savePrivacyCredentials, setAlbumCover, setAlbumFolder,
  setStoredMediaHidden, updateImportJob, updatePrivacyPin, verifyPrivacyPin,
  verifyPrivacyRecoveryAnswer, StoredMediaItem,
} from '../services/storage/mediaVaultService';
import {
  cancelNativeImport, createPickerImportJob, listPendingJobs, pauseNativeImport,
  runForegroundFallback, scanDeviceLibrary, scanSafFolder, ScanProgress, startNativeImport,
} from '../services/storage/mediaImportService';

const PAGE_SIZE = 60;
const VIEWER_WIDTH = Dimensions.get('window').width;
type Filter = 'all' | MediaType | 'private';
type ScreenMode = 'library' | 'collections';
type SortMode = 'newest' | 'oldest' | 'name' | 'size';
type Editor = { kind: 'album' | 'folder' | 'media'; mode: 'create' | 'rename'; id?: string; value: string };

function formatBytes(bytes?: number) {
  if (!bytes || !Number.isFinite(bytes)) return '0 بايت';
  const units = ['بايت', 'ك.ب', 'م.ب', 'ج.ب', 'ت.ب'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function mediaTypeFromName(name: string, mime?: string): MediaType {
  const value = `${mime ?? ''} ${name}`.toLowerCase();
  if (value.includes('video') || /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(name)) return 'video';
  if (value.includes('image') || /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tif|tiff|dng|raw)$/i.test(name)) return 'image';
  return 'file';
}

function VideoAsset({ uri, large = false }: { uri: string; large?: boolean }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const player = useVideoPlayer(uri, (instance) => { instance.loop = false; instance.play(); });
  return <VideoView player={player} contentFit="contain" nativeControls style={large ? styles.viewerVideo : styles.videoPreview} />;
}

function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return '';
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

function VideoThumbnail({ uri, filename, duration }: { uri: string; filename: string; duration?: number }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const player = useVideoPlayer(uri, (instance) => { instance.loop = false; instance.muted = true; instance.pause(); });
  const [thumbnail, setThumbnail] = useState<VideoThumbnailRef | null>(null);

  useEffect(() => {
    let active = true;
    let requested = false;
    if (Platform.OS === 'web') return () => { active = false; };
    const generate = () => {
      if (!active || requested || player.status !== 'readyToPlay') return;
      requested = true;
      void player.generateThumbnailsAsync([0], { maxWidth: 320, maxHeight: 320 })
        .then(([frame]) => { if (active && frame) setThumbnail(frame); })
        .catch(() => undefined);
    };
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') generate();
    });
    generate();
    return () => { active = false; subscription.remove(); };
  }, [player]);

  const label = formatDuration(duration);
  return <View style={styles.videoThumbnail}>
    {thumbnail ? <ExpoImage source={thumbnail} style={styles.videoThumbnailImage} contentFit="cover" cachePolicy="memory-disk" /> : <View style={styles.videoFallback}>
      <Ionicons name="videocam-outline" size={25} color={colors.tealDark} />
      <Text numberOfLines={2} style={styles.fileName}>{filename}</Text>
    </View>}
    {label ? <View style={styles.videoDuration}><Text style={styles.videoDurationText}>{label}</Text></View> : null}
    <View pointerEvents="none" style={styles.videoPlayBadge}><Ionicons name="play" size={15} color={colors.paper} /></View>
  </View>;
}

export function MediaScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [permission, requestPermission] = MediaLibrary.usePermissions({ granularPermissions: ['photo', 'video'] });
  const [items, setItems] = useState<StoredMediaItem[]>([]);
  const [albums, setAlbums] = useState<MediaAlbum[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [stats, setStats] = useState<MediaStats>({ itemCount: 0, totalBytes: 0, imageCount: 0, videoCount: 0, fileCount: 0, imageBytes: 0, videoBytes: 0, fileBytes: 0 });
  const [deviceCount, setDeviceCount] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [mode, setMode] = useState<ScreenMode>('library');
  const [sort, setSort] = useState<SortMode>('newest');
  const [search, setSearch] = useState('');
  const [albumId, setAlbumId] = useState<string | undefined>();
  const [folderStack, setFolderStack] = useState<MediaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const setError = useCallback((message: string | null) => {
    if (message) showAppError('تعذر إتمام العملية', message);
  }, []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [actionItem, setActionItem] = useState<StoredMediaItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [privateUnlocked, setPrivateUnlocked] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinMode, setPinMode] = useState<'create' | 'unlock' | 'recover' | 'reset'>('unlock');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pendingHide, setPendingHide] = useState<StoredMediaItem | null>(null);
  const [secretTaps, setSecretTaps] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [albumPickerOpen, setAlbumPickerOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [selectedAlbumForActions, setSelectedAlbumForActions] = useState<MediaAlbum | null>(null);
  const [activeJob, setActiveJob] = useState<MediaImportJob | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [exporting, setExporting] = useState(false);
  const [fallbackRunning, setFallbackRunning] = useState(false);
  const scanCancelRef = useRef(false);
  const fallbackStopRef = useRef(false);
  const lastJobErrorRef = useRef<string | null>(null);

  useEffect(() => {
    const jobError = activeJob?.error ?? null;
    if (jobError && jobError !== lastJobErrorRef.current) {
      lastJobErrorRef.current = jobError;
      showAppError('تعذر استيراد الوسائط', jobError);
    } else if (!jobError) lastJobErrorRef.current = null;
  }, [activeJob?.error]);

  const currentFolder = folderStack[folderStack.length - 1];
  const currentFolderId = currentFolder?.id;
  const pageOptions = useMemo<MediaPageOptions>(() => ({
    limit: PAGE_SIZE,
    type: filter === 'all' || filter === 'private' ? undefined : filter,
    hidden: filter === 'private',
    albumId,
    search,
    sort,
  }), [filter, albumId, search, sort]);

  const refreshStats = useCallback(async () => {
    const [nextStats, count] = await Promise.all([
      getMediaStats(),
      permission?.granted ? Promise.all([
        MediaLibrary.getAssetsAsync({ first: 1, mediaType: 'photo' }).then((page) => page.totalCount).catch(() => 0),
        MediaLibrary.getAssetsAsync({ first: 1, mediaType: 'video' }).then((page) => page.totalCount).catch(() => 0),
      ]).then(([photos, videos]) => photos + videos) : Promise.resolve(0),
    ]);
    setStats(nextStats);
    setDeviceCount(count);
  }, [permission?.granted]);

  const loadFirstPage = useCallback(async (pull = false) => {
    setError(null);
    if (pull) setRefreshing(true); else setLoading(true);
    try {
      const [page] = await Promise.all([listStoredMediaPage({ ...pageOptions, offset: 0 }), refreshStats()]);
      setItems(page);
      setHasMore(page.length === PAGE_SIZE);
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل مكتبة مُرشد.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pageOptions, refreshStats, setError]);

  const loadCollections = useCallback(async () => {
    try {
      const [nextFolders, nextAlbums] = await Promise.all([listFolders(currentFolderId ?? null), listAlbums(currentFolderId ?? null)]);
      setFolders(nextFolders);
      setAlbums(nextAlbums);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل الألبومات والمجلدات.');
    }
  }, [currentFolderId, setError]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadFirstPage(); }, 0);
    return () => clearTimeout(timer);
  }, [loadFirstPage]);
  useEffect(() => {
    if (mode !== 'collections') return undefined;
    const timer = setTimeout(() => { void loadCollections(); }, 0);
    return () => clearTimeout(timer);
  }, [mode, loadCollections]);

  useEffect(() => {
    let mounted = true;
    void listPendingJobs().then(async (jobs) => {
      if (!mounted || !jobs.length) return;
      const job = jobs[0];
      if (job.state === 'scanning') {
        await updateImportJob(job.id, { state: 'paused', error: 'توقف فحص المصادر قبل اكتماله. أعد اختيار المصدر للمتابعة.' });
        job.state = 'paused';
      }
      if (mounted) setActiveJob(job);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const activeJobId = activeJob?.id;
  const activeJobState = activeJob?.state;

  useEffect(() => {
    if (!activeJobId || activeJobState !== 'running') return undefined;
    let mounted = true;
    const timer = setInterval(() => {
      void (async () => {
        const latest = await (await import('../services/storage/mediaVaultService')).getImportJob(activeJobId);
        if (mounted && latest) setActiveJob(latest);
      })().catch(() => undefined);
    }, 1200);
    return () => { mounted = false; clearInterval(timer); };
  }, [activeJobId, activeJobState]);

  useEffect(() => {
    if (activeJobState !== 'completed') return undefined;
    const timer = setTimeout(() => {
      void loadFirstPage(true);
      setScanProgress(null);
      setFallbackRunning(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeJobState, loadFirstPage]);

  const loadMore = async () => {
    if (loadingMore || loading || !hasMore || mode !== 'library') return;
    setLoadingMore(true);
    try {
      const page = await listStoredMediaPage({ ...pageOptions, offset: items.length });
      setItems((existing) => [...existing, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل بقية العناصر.');
    } finally { setLoadingMore(false); }
  };

  const openPrivate = async () => {
    setPinMode((await hasPrivacyPin()) ? 'unlock' : 'create');
    setPin(''); setPinConfirm(''); setRecoveryQuestion(''); setRecoveryAnswer(''); setPinError(null); setPinOpen(true);
  };

  const switchFilter = async (value: Filter) => {
    if (value === 'private' && !privateUnlocked) { await openPrivate(); return; }
    setFilter(value);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (!next.size) setSelectionMode(false);
      return next;
    });
  };

  const scanAllDeviceMedia = async (mediaTypes: readonly ('photo' | 'video')[] = ['photo', 'video']) => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result?.granted) { setError('للاستيراد من مكتبة الجهاز، امنح مُرشد إذن الوصول المحدود أو الكامل للصور والفيديو.'); return; }
    }
    if (activeJob && ['running', 'scanning'].includes(activeJob.state)) { setError('يوجد استيراد آخر قيد التنفيذ. أوقفه أو انتظر اكتماله أولًا.'); return; }
    scanCancelRef.current = false;
    setError(null);
    setScanProgress({ scannedFiles: 0, estimatedBytes: 0 });
    const jobId = await (await import('../services/storage/mediaVaultService')).createImportJob('device', albumId);
    setActiveJob(await (await import('../services/storage/mediaVaultService')).getImportJob(jobId));
    try {
      const progress = await scanDeviceLibrary(jobId, setScanProgress, () => scanCancelRef.current, mediaTypes);
      setScanProgress(progress);
      const job = await (await import('../services/storage/mediaVaultService')).getImportJob(jobId);
      if (!job || !job.totalFiles) {
        await (await import('../services/storage/mediaVaultService')).removeImportJob(jobId);
        setActiveJob(null);
        Alert.alert('لا توجد وسائط جديدة', 'لم يتم العثور على صور أو فيديوهات قابلة للاستيراد ضمن الصلاحيات الحالية.');
        return;
      }
      setActiveJob(job);
      confirmImport(job);
    } catch (cause) {
      await (await import('../services/storage/mediaVaultService')).removeImportJob(jobId).catch(() => undefined);
      setActiveJob(null);
      setScanProgress(null);
      if (!scanCancelRef.current) setError(cause instanceof Error ? cause.message : 'تعذر فحص مكتبة الجهاز.');
    }
  };

  const scanSelectedFolder = async () => {
    if (Platform.OS !== 'android') { setError('استيراد مجلد كامل متاح على Android باستخدام منتقي النظام.'); return; }
    if (activeJob && ['running', 'scanning'].includes(activeJob.state)) { setError('يوجد استيراد آخر قيد التنفيذ. أوقفه أو انتظر اكتماله أولًا.'); return; }
    try {
      const selection = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!selection.granted) return;
      scanCancelRef.current = false;
      setScanProgress({ scannedFiles: 0, estimatedBytes: 0 });
      const jobId = await (await import('../services/storage/mediaVaultService')).createImportJob('folder', albumId);
      setActiveJob(await (await import('../services/storage/mediaVaultService')).getImportJob(jobId));
      const progress = await scanSafFolder(jobId, selection.directoryUri, setScanProgress, () => scanCancelRef.current);
      setScanProgress(progress);
      const job = await (await import('../services/storage/mediaVaultService')).getImportJob(jobId);
      if (!job || !job.totalFiles) {
        await (await import('../services/storage/mediaVaultService')).removeImportJob(jobId);
        setActiveJob(null);
        Alert.alert('المجلد فارغ', 'لم نعثر على صور أو فيديوهات في المجلد المختار.');
        return;
      }
      setActiveJob(job);
      confirmImport(job);
    } catch (cause) {
      setActiveJob(null); setScanProgress(null);
      setError(cause instanceof Error ? cause.message : 'تعذر استعراض المجلد المختار.');
    }
  };

  const chooseFiles = async (type: string | string[]) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type, multiple: true, copyToCacheDirectory: false });
      if (result.canceled) return;
      const mediaOnly = result.assets.filter((asset) => mediaTypeFromName(asset.name, asset.mimeType) !== 'file' || type === '*/*');
      if (!mediaOnly.length) { setError('نوع غير مدعوم. اختر صورًا أو فيديوهات مدعومة.'); return; }
      const jobId = await createPickerImportJob(mediaOnly, albumId);
      const job = await (await import('../services/storage/mediaVaultService')).getImportJob(jobId);
      if (job) { setActiveJob(job); confirmImport(job); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر فتح منتقي الملفات.');
    }
  };

  const confirmImport = (job: MediaImportJob) => {
    const sizeWarning = stats.freeBytes !== undefined && job.totalBytes > stats.freeBytes
      ? `\n\nتنبيه: الحجم التقديري أكبر من المساحة الحرة (${formatBytes(stats.freeBytes)}). قد يتوقف النسخ عند امتلاء التخزين.` : '';
    Alert.alert('معاينة الاستيراد', `سيتم نسخ ${job.totalFiles.toLocaleString()} عنصرًا، بحجم تقديري ${formatBytes(job.totalBytes)} إلى مساحة مُرشد الخاصة. لن يُحذف أي ملف أصلي.${sizeWarning}`, [
      { text: 'إلغاء', style: 'cancel', onPress: () => { void (async () => { await (await import('../services/storage/mediaVaultService')).removeImportJob(job.id); setActiveJob(null); setScanProgress(null); })(); } },
      { text: 'بدء النسخ', onPress: () => { void beginImport(job); } },
    ]);
  };

  const beginImport = async (job: MediaImportJob) => {
    setError(null); setScanProgress(null); fallbackStopRef.current = false;
    try {
      if (NativeModules.MurshidGallery) {
        await startNativeImport(job.id);
        const latest = await (await import('../services/storage/mediaVaultService')).getImportJob(job.id);
        setActiveJob(latest ?? job);
      } else {
        setFallbackRunning(true);
        await runForegroundFallback(job.id, () => fallbackStopRef.current, (latest) => setActiveJob(latest));
        const latest = await (await import('../services/storage/mediaVaultService')).getImportJob(job.id);
        setActiveJob(latest ?? job);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر بدء عامل الاستيراد.');
      setActiveJob(await (await import('../services/storage/mediaVaultService')).getImportJob(job.id));
    }
  };

  const pauseImport = async () => {
    if (!activeJob) return;
    fallbackStopRef.current = true;
    if (NativeModules.MurshidGallery) await pauseNativeImport(activeJob.id);
    const latest = await (await import('../services/storage/mediaVaultService')).getImportJob(activeJob.id);
    if (latest) setActiveJob(latest);
    setFallbackRunning(false);
  };

  const cancelScan = async () => {
    scanCancelRef.current = true;
    if (activeJob) await updateImportJob(activeJob.id, { state: 'cancelled' });
  };

  const cancelImport = async () => {
    if (!activeJob) return;
    fallbackStopRef.current = true;
    if (NativeModules.MurshidGallery) await cancelNativeImport(activeJob.id);
    const latest = await (await import('../services/storage/mediaVaultService')).getImportJob(activeJob.id);
    if (latest) setActiveJob(latest);
    setFallbackRunning(false);
    await loadFirstPage(true);
  };

  const loadNextCollectionList = async () => {
    const [nextFolders, nextAlbums] = await Promise.all([listFolders(currentFolder?.id ?? null), listAlbums(currentFolder?.id ?? null)]);
    setFolders(nextFolders); setAlbums(nextAlbums);
  };

  const saveEditor = async () => {
    if (!editor || !editor.value.trim()) return;
    try {
      if (editor.kind === 'album') {
        if (editor.mode === 'create') {
          const newAlbumId = await createAlbum(editor.value, currentFolder?.id);
          if (selectedIds.size) await addMediaToAlbum(newAlbumId, [...selectedIds]);
        } else if (editor.id) await renameAlbum(editor.id, editor.value);
        await loadNextCollectionList();
      } else if (editor.kind === 'folder') {
        if (editor.mode === 'create') await createFolder(editor.value, currentFolder?.id);
        else if (editor.id) await renameFolder(editor.id, editor.value);
        await loadNextCollectionList();
      } else if (editor.id) {
        await renameStoredMedia(editor.id, editor.value);
        await loadFirstPage(true);
      }
      setEditor(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ التعديل.');
    }
  };

  const removeItem = async (item: StoredMediaItem) => {
    setActionItem(null);
    await deleteStoredMedia(item.id);
    await loadFirstPage(true);
  };

  const hideItem = async (item: StoredMediaItem) => {
    setActionItem(null);
    if (!(await hasPrivacyPin())) { setPendingHide(item); setPinMode('create'); setPin(''); setPinConfirm(''); setPinOpen(true); return; }
    await setStoredMediaHidden(item.id, true);
    await loadFirstPage(true);
  };

  const startRecovery = async () => {
    setRecoveryQuestion((await getPrivacyRecoveryQuestion()) ?? '');
    setRecoveryAnswer(''); setPin(''); setPinConfirm(''); setPinError(null); setPinMode('recover');
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
      Alert.alert('تم حفظ رمز الخصوصية', `حُفظ الرمز محليًا. تذكير محدود: آخر حرف منه «${pin.slice(-1)}» فقط.`);
      if (pendingHide) { await setStoredMediaHidden(pendingHide.id, true); setPendingHide(null); await loadFirstPage(true); }
    } else {
      await updatePrivacyPin(pin);
      Alert.alert('تم تغيير رمز الخصوصية', `تم تغيير الرمز. آخر حرف منه «${pin.slice(-1)}» فقط.`);
    }
    setPrivateUnlocked(true); setFilter('private'); setPinOpen(false); setPin(''); setPinConfirm(''); setPinError(null);
  };

  const openMedia = (item: StoredMediaItem) => {
    if (selectionMode) { toggleSelected(item.id); return; }
    const index = items.findIndex((entry) => entry.id === item.id);
    setViewerStart(Math.max(0, index)); setViewerOpen(true);
  };

  const openAlbum = (album: MediaAlbum) => {
    setAlbumId(album.id); setFilter('all'); setMode('library'); setSelectedIds(new Set()); setSelectionMode(false);
  };

  const openAlbumActions = (album: MediaAlbum) => {
    setSelectedAlbumForActions(album);
    Alert.alert(album.name, `${album.itemCount} عنصر`, [
      { text: 'فتح الألبوم', onPress: () => openAlbum(album) },
      { text: 'إعادة تسمية', onPress: () => setEditor({ kind: 'album', mode: 'rename', id: album.id, value: album.name }) },
      { text: 'نقل إلى المجلد الحالي', onPress: () => { void setAlbumFolder(album.id, currentFolder?.id).then(loadNextCollectionList); } },
      { text: 'تصدير إلى مجلد أو سحابة…', onPress: () => { void exportAlbumToFolder(album); } },
      { text: 'حفظ في صور الجهاز', onPress: () => { void exportAlbumToPhotos(album); } },
      { text: 'حذف الألبوم فقط', style: 'destructive', onPress: () => Alert.alert('حذف الألبوم؟', 'ستبقى الصور والفيديوهات المحفوظة في مكتبة مُرشد.', [
        { text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => { void deleteAlbum(album.id).then(loadNextCollectionList); } },
      ]) },
      { text: 'إغلاق', style: 'cancel' },
    ]);
  };

  const openFolderActions = (folder: MediaFolder) => Alert.alert(folder.name, `${folder.itemCount} ألبوم`, [
    { text: 'فتح المجلد', onPress: () => setFolderStack((stack) => [...stack, folder]) },
    { text: 'إعادة تسمية', onPress: () => setEditor({ kind: 'folder', mode: 'rename', id: folder.id, value: folder.name }) },
    { text: 'حذف المجلد', style: 'destructive', onPress: () => Alert.alert('حذف المجلد؟', 'ستنتقل الألبومات الموجودة فيه إلى المستوى الأعلى؛ لن تُحذف الوسائط.', [
      { text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => { void deleteFolder(folder.id).then(() => { setFolderStack((stack) => stack.filter((item) => item.id !== folder.id)); return loadNextCollectionList(); }); } },
    ]) },
    { text: 'إغلاق', style: 'cancel' },
  ]);

  const assignSelection = async (targetAlbumId: string) => {
    await addMediaToAlbum(targetAlbumId, [...selectedIds]);
    setAlbumPickerOpen(false); setSelectedIds(new Set()); setSelectionMode(false); await loadNextCollectionList();
    Alert.alert('تمت الإضافة', 'أُضيفت العناصر المحددة إلى الألبوم.');
  };

  const removeSelectionFromAlbum = async () => {
    if (!albumId) return;
    await removeMediaFromAlbum(albumId, [...selectedIds]);
    setSelectedIds(new Set()); setSelectionMode(false); await loadFirstPage(true); await loadNextCollectionList();
  };

  const setCoverFromSelection = async () => {
    if (!albumId || selectedIds.size !== 1) return;
    await setAlbumCover(albumId, [...selectedIds][0]);
    setSelectedIds(new Set()); setSelectionMode(false); await loadNextCollectionList();
    Alert.alert('تم تحديث الغلاف', 'تم تعيين العنصر المحدد غلافًا للألبوم.');
  };

  const deleteSelection = () => Alert.alert('حذف النسخ المحددة؟', `سيتم حذف ${selectedIds.size} نسخة من مساحة مُرشد فقط. لن تُحذف الملفات الأصلية من الجهاز.`, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف النسخ', style: 'destructive', onPress: () => { void (async () => {
      for (const id of selectedIds) await deleteStoredMedia(id);
      setSelectedIds(new Set()); setSelectionMode(false); await loadFirstPage(true); await loadNextCollectionList();
    })(); } },
  ]);

  const exportAlbumToFolder = async (album: MediaAlbum) => {
    if (Platform.OS !== 'android') { setError('تصدير مجلد كامل متاح على Android فقط.'); return; }
    try {
      const selection = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!selection.granted) return;
      setExporting(true);
      let offset = 0; let exported = 0; let failures = 0;
      while (true) {
        const page = await listStoredMediaPage({ albumId: album.id, hidden: false, limit: 30, offset });
        if (!page.length) break;
        for (const item of page) {
          try {
            const mime = item.mimeType ?? (item.type === 'video' ? 'video/mp4' : 'image/jpeg');
            const dot = item.filename.lastIndexOf('.');
            const stem = dot > 0 ? item.filename.slice(0, dot) : item.filename;
            const extension = dot > 0 ? item.filename.slice(dot) : '';
            const target = await FileSystem.StorageAccessFramework.createFileAsync(selection.directoryUri, `${stem}_${exported + 1}${extension}`, mime);
            await FileSystem.StorageAccessFramework.copyAsync({ from: item.uri, to: target });
            exported += 1;
          } catch { failures += 1; }
        }
        offset += page.length;
      }
      if (failures) showAppError('اكتمل التصدير جزئيًا', `تم تصدير ${exported} ملف، وتعذر تصدير ${failures}.`);
      else Alert.alert('اكتمل التصدير', `تم تصدير ${exported} ملف.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر التصدير إلى المجلد المختار.'); }
    finally { setExporting(false); }
  };

  const exportAlbumToPhotos = async (album: MediaAlbum) => {
    try {
      const permissionResult = await MediaLibrary.requestPermissionsAsync(true, ['photo', 'video']);
      if (!permissionResult.granted) { setError('اسمح بحفظ الوسائط إلى مكتبة الصور ثم حاول مرة تانية.'); return; }
      setExporting(true);
      let offset = 0; let exported = 0; let failures = 0;
      while (true) {
        const page = await listStoredMediaPage({ albumId: album.id, hidden: false, limit: 20, offset });
        if (!page.length) break;
        for (const item of page) {
          try { await MediaLibrary.saveToLibraryAsync(item.uri); exported += 1; } catch { failures += 1; }
        }
        offset += page.length;
      }
      if (failures) showAppError('اكتمل الحفظ جزئيًا', `تم حفظ ${exported} ملف، وتعذر حفظ ${failures}.`);
      else Alert.alert('حفظ في صور الجهاز', `تم حفظ ${exported} ملف. قد يستغرق تطبيق الصور وقتًا لعرض العناصر الجديدة.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر حفظ الألبوم في مكتبة الصور.'); }
    finally { setExporting(false); }
  };

  const exportSelectionToPhotos = async () => {
    try {
      const permissionResult = await MediaLibrary.requestPermissionsAsync(true, ['photo', 'video']);
      if (!permissionResult.granted) { setError('اسمح بحفظ الوسائط إلى مكتبة الصور ثم حاول مرة تانية.'); return; }
      let copied = 0;
      const selectedItems = selectionMode ? items.filter((entry) => selectedIds.has(entry.id)) : actionItem ? [actionItem] : [];
      for (const item of selectedItems) { await MediaLibrary.saveToLibraryAsync(item.uri); copied += 1; }
      if (selectionMode) { setSelectedIds(new Set()); setSelectionMode(false); }
      else setActionItem(null);
      Alert.alert('تم الحفظ', `تم حفظ ${copied} عنصر في صور الجهاز.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر حفظ العناصر المختارة.'); }
  };

  const cancelJob = async () => {
    if (!activeJob) return;
    if (activeJob.state === 'scanning') { await cancelScan(); return; }
    Alert.alert('إيقاف الاستيراد؟', 'ستبقى العناصر التي اكتمل نسخها. لن يُحذف أي ملف أصلي.', [
      { text: 'متابعة', style: 'cancel' }, { text: 'إيقاف', style: 'destructive', onPress: () => { void cancelImport(); } },
    ]);
  };

  const openImportMenu = () => Alert.alert('إضافة وسائط إلى مُرشد', 'اختر مصدر الاستيراد. يتم نسخ الملفات إلى تخزين التطبيق، ولا تُرفع إلى السحابة.', [
    { text: 'استيراد كل الصور والفيديو المتاح', onPress: () => { void scanAllDeviceMedia(); } },
    { text: 'استيراد الصور فقط', onPress: () => { void scanAllDeviceMedia(['photo']); } },
    { text: 'استيراد الفيديوهات فقط', onPress: () => { void scanAllDeviceMedia(['video']); } },
    { text: 'صور أو فيديوهات محددة', onPress: () => { void chooseFiles(['image/*', 'video/*']); } },
    { text: 'ملفات من الجهاز أو مزود سحابي', onPress: () => { void chooseFiles('*/*'); } },
    { text: 'استيراد مجلد كامل (Android)', onPress: () => { void scanSelectedFolder(); } },
    { text: 'إلغاء', style: 'cancel' },
  ]);

  const secretTap = () => { const next = secretTaps + 1; setSecretTaps(next); if (next === 3) { setSecretTaps(0); void openPrivate(); } setTimeout(() => setSecretTaps(0), 900); };

  const renderMedia = ({ item }: { item: StoredMediaItem }) => (
    <Pressable onPress={() => openMedia(item)} onLongPress={() => selectionMode ? toggleSelected(item.id) : setActionItem(item)} delayLongPress={450} style={[styles.tile, selectedIds.has(item.id) && styles.tileSelected]}>
      {item.type === 'image' ? <ExpoImage source={{ uri: item.uri }} style={styles.image} contentFit="cover" cachePolicy="disk" allowDownscaling transition={100} />
        : item.type === 'video' ? <VideoThumbnail uri={item.uri} filename={item.filename} duration={item.duration} />
          : <View style={styles.typeTile}><Ionicons name="document-text-outline" size={32} color={colors.tealDark} /><Text numberOfLines={2} style={styles.fileName}>{item.filename}</Text></View>}
      {selectedIds.has(item.id) ? <View style={styles.selectedBadge}><Ionicons name="checkmark" size={15} color={colors.paper} /></View> : null}
    </Pressable>
  );

  const Header = (
    <View>
      <ScreenHeader eyebrow="LIVING GALLERY" title="المعرض" detail={`${stats.itemCount.toLocaleString()} محفوظ · ${formatBytes(stats.totalBytes)} مستخدم · ${formatBytes(stats.freeBytes)} متاح`} />
      <View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={18} color={colors.tealDark} /><Text style={styles.noticeText}>مكتبة مُرشد محلية على الجهاز. تُحفظ النسخ داخل التطبيق ولا تُرفع إلى السحابة. حذف نسخة من مُرشد لا يحذف الأصل.</Text></View>
      <View style={styles.storageCard}>
        <View style={styles.storageLine}><Text style={styles.storageLabel}>الصور {stats.imageCount.toLocaleString()}</Text><Text style={styles.storageLabel}>الفيديو {stats.videoCount.toLocaleString()}</Text><Text style={styles.storageLabel}>الملفات {stats.fileCount.toLocaleString()}</Text></View>
        <View style={[styles.storageLine, { marginTop: spacing.xs }]}><Text style={styles.storageLabel}>{formatBytes(stats.imageBytes)}</Text><Text style={styles.storageLabel}>{formatBytes(stats.videoBytes)}</Text><Text style={styles.storageLabel}>{formatBytes(stats.fileBytes)}</Text></View>
        <View style={styles.storageBar}><View style={[styles.storageFill, { width: `${Math.min(100, stats.freeBytes ? stats.totalBytes / (stats.totalBytes + stats.freeBytes) * 100 : 0)}%` }]} /></View>
        <Text style={styles.storageHint}>الحجم تقريبي حسب البيانات المحلية. ملفات المصدر لا تُحمّل إلى الذاكرة بالكامل عند النسخ.</Text>
      </View>
      <View style={styles.modeRow}>
        <Pressable onPress={() => { setMode('library'); setAlbumId(undefined); }} style={[styles.modeButton, mode === 'library' && styles.modeButtonActive]}><Ionicons name="images-outline" size={16} color={mode === 'library' ? colors.paper : colors.inkMuted} /><Text style={[styles.modeText, mode === 'library' && styles.modeTextActive]}>المكتبة</Text></Pressable>
        <Pressable onPress={() => { setMode('collections'); setAlbumId(undefined); }} style={[styles.modeButton, mode === 'collections' && styles.modeButtonActive]}><Ionicons name="albums-outline" size={16} color={mode === 'collections' ? colors.paper : colors.inkMuted} /><Text style={[styles.modeText, mode === 'collections' && styles.modeTextActive]}>الألبومات والمجلدات</Text></Pressable>
      </View>
      {mode === 'library' ? <>
        <View style={styles.searchRow}><Ionicons name="search-outline" size={18} color={colors.inkMuted} /><TextInput value={search} onChangeText={setSearch} placeholder="ابحث باسم الملف" placeholderTextColor={colors.inkFaint} style={styles.searchInput} /><Pressable onPress={() => setSort((value) => value === 'newest' ? 'name' : value === 'name' ? 'size' : value === 'size' ? 'oldest' : 'newest')} style={styles.sortButton}><Ionicons name="swap-vertical-outline" size={16} color={colors.tealDark} /><Text style={styles.sortText}>{sort === 'newest' ? 'الأحدث' : sort === 'oldest' ? 'الأقدم' : sort === 'name' ? 'الاسم' : 'الحجم'}</Text></Pressable></View>
        <View style={styles.filterRow}>{(['all', 'image', 'video', 'file', ...(privateUnlocked ? ['private'] : [])] as Filter[]).map((value) => <Pressable key={value} onPress={() => { void switchFilter(value); }} style={[styles.filterChip, filter === value && styles.filterActive]}><Ionicons name={value === 'all' ? 'apps-outline' : value === 'image' ? 'image-outline' : value === 'video' ? 'videocam-outline' : value === 'file' ? 'document-outline' : 'lock-closed-outline'} size={15} color={filter === value ? colors.paper : colors.inkMuted} /><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value === 'all' ? 'الكل' : value === 'image' ? 'الصور' : value === 'video' ? 'الفيديو' : value === 'file' ? 'الملفات' : 'الخصوصية'}</Text></Pressable>)}</View>
        {permission?.accessPrivileges === 'limited' ? <Pressable onPress={() => { void MediaLibrary.presentPermissionsPickerAsync(['photo', 'video']).then(refreshStats).catch(() => setError('تعذر فتح إعداد الصور المحددة.')); }} style={styles.permissionBanner}><Ionicons name="options-outline" size={16} color={colors.tealDark} /><Text style={styles.permissionBannerText}>الوصول محدود إلى صور مختارة · تعديل الاختيار</Text></Pressable> : !permission?.granted ? <Pressable onPress={() => { void requestPermission().then(refreshStats); }} style={styles.permissionBanner}><Ionicons name="lock-open-outline" size={16} color={colors.tealDark} /><Text style={styles.permissionBannerText}>امنح إذنًا عند رغبتك في استيراد مكتبة الجهاز ({deviceCount})</Text></Pressable> : null}
        {albumId ? <Pressable onPress={() => { setAlbumId(undefined); void loadFirstPage(); }} style={styles.backToLibrary}><Ionicons name="arrow-back-outline" size={16} color={colors.tealDark} /><Text style={styles.permissionBannerText}>داخل ألبوم «{albums.find((album) => album.id === albumId)?.name ?? 'ألبوم'}» · عرض كل المكتبة</Text></Pressable> : null}
        <View style={styles.actions}><Pressable onPress={openImportMenu} style={styles.actionButton}><Ionicons name="add-circle-outline" size={19} color={colors.paper} /><Text style={styles.actionText}>استيراد</Text></Pressable><Pressable onPress={() => { setSelectionMode((value) => !value); setSelectedIds(new Set()); }} style={[styles.actionButton, styles.fileButton]}><Ionicons name={selectionMode ? 'close-outline' : 'checkbox-outline'} size={18} color={colors.ink} /><Text style={[styles.actionText, styles.fileText]}>{selectionMode ? 'إلغاء التحديد' : 'تحديد عناصر'}</Text></Pressable></View>
        {selectionMode ? <View style={styles.bulkBar}><Text style={styles.bulkCount}>محدد: {selectedIds.size}</Text><Pressable onPress={() => setAlbumPickerOpen(true)} disabled={!selectedIds.size} style={styles.bulkAction}><Text style={styles.bulkActionText}>إضافة إلى ألبوم</Text></Pressable><Pressable onPress={exportSelectionToPhotos} disabled={!selectedIds.size} style={styles.bulkAction}><Text style={styles.bulkActionText}>حفظ في الصور</Text></Pressable>{albumId ? <Pressable onPress={removeSelectionFromAlbum} disabled={!selectedIds.size} style={styles.bulkAction}><Text style={styles.bulkActionText}>إزالة من الألبوم</Text></Pressable> : null}{albumId && selectedIds.size === 1 ? <Pressable onPress={setCoverFromSelection} style={styles.bulkAction}><Text style={styles.bulkActionText}>تعيين الغلاف</Text></Pressable> : null}<Pressable onPress={deleteSelection} disabled={!selectedIds.size} style={styles.bulkDelete}><Ionicons name="trash-outline" size={16} color={colors.danger} /></Pressable></View> : null}
        {activeJob ? <View style={styles.jobCard}><View style={styles.jobTitleRow}><Ionicons name={activeJob.state === 'completed' ? 'checkmark-circle-outline' : 'sync-outline'} size={20} color={colors.tealDark} /><Text style={styles.jobTitle}>{activeJob.state === 'scanning' ? `فحص المصدر · ${scanProgress?.scannedFiles ?? 0} عنصر` : activeJob.state === 'ready' ? 'المصدر جاهز للاستيراد' : activeJob.state === 'running' ? `نسخ ${activeJob.completedFiles}/${activeJob.totalFiles}` : activeJob.state === 'paused' ? 'الاستيراد متوقف مؤقتًا' : activeJob.state === 'completed' ? 'اكتمل الاستيراد' : activeJob.state === 'cancelled' ? 'أُوقف الاستيراد' : 'تعذر الاستيراد'}</Text></View>
          {activeJob.state === 'scanning' ? <Text style={styles.jobDetail}>تم فحص {scanProgress?.scannedFiles ?? 0} عنصر · تقدير {formatBytes(scanProgress?.estimatedBytes)}</Text> : <Text style={styles.jobDetail}>{activeJob.currentFilename ? `الملف الحالي: ${activeJob.currentFilename}` : `${activeJob.completedFiles} اكتمل · ${activeJob.failedFiles} تعذر · ${formatBytes(activeJob.copiedBytes)} من تقدير ${formatBytes(activeJob.totalBytes)}`}</Text>}
          {activeJob.state === 'running' ? <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${activeJob.totalFiles ? Math.min(100, (activeJob.completedFiles + activeJob.failedFiles) / activeJob.totalFiles * 100) : 0}%` }]} /></View> : null}
          <View style={styles.jobButtons}>{activeJob.state === 'scanning' ? <Pressable onPress={() => { void cancelJob(); }} style={styles.jobButton}><Text style={styles.jobButtonText}>إلغاء الفحص</Text></Pressable> : null}{['ready', 'paused'].includes(activeJob.state) ? <Pressable onPress={() => { void beginImport(activeJob); }} style={styles.jobButton}><Text style={styles.jobButtonText}>{activeJob.state === 'ready' ? 'بدء النسخ' : 'استئناف'}</Text></Pressable> : null}{activeJob.state === 'running' ? <Pressable onPress={() => { void pauseImport(); }} style={styles.jobButton}><Text style={styles.jobButtonText}>{fallbackRunning ? 'إيقاف مؤقت' : 'إيقاف مؤقت'}</Text></Pressable> : null}{['running', 'paused', 'ready'].includes(activeJob.state) ? <Pressable onPress={() => { void cancelJob(); }} style={styles.jobButtonSecondary}><Text style={styles.jobButtonSecondaryText}>إيقاف نهائي</Text></Pressable> : null}{activeJob.state === 'completed' || activeJob.state === 'cancelled' ? <Pressable onPress={() => setActiveJob(null)} style={styles.jobButtonSecondary}><Text style={styles.jobButtonSecondaryText}>إخفاء</Text></Pressable> : null}</View>
        </View> : null}
      </> : <>
        <View style={styles.collectionHeader}><View style={styles.breadcrumbRow}>{folderStack.length ? <Pressable onPress={() => setFolderStack((stack) => stack.slice(0, -1))} style={styles.backButton}><Ionicons name="arrow-back" size={17} color={colors.tealDark} /><Text style={styles.backText}>رجوع</Text></Pressable> : null}<Text style={styles.collectionPath}>{folderStack.length ? folderStack.map((item) => item.name).join(' / ') : 'كل الألبومات'}</Text></View><View style={styles.collectionActions}><Pressable onPress={() => setEditor({ kind: 'folder', mode: 'create', value: '' })} style={styles.smallButton}><Ionicons name="folder-open-outline" size={16} color={colors.tealDark} /><Text style={styles.smallButtonText}>مجلد</Text></Pressable><Pressable onPress={() => setEditor({ kind: 'album', mode: 'create', value: '' })} style={styles.smallButton}><Ionicons name="add-circle-outline" size={16} color={colors.tealDark} /><Text style={styles.smallButtonText}>ألبوم</Text></Pressable></View></View>
      </>}
    </View>
  );

  const CollectionHeader = <View>
    {folders.length ? <><Text style={styles.sectionTitle}>المجلدات</Text><View style={styles.collectionGrid}>{folders.map((folder) => <Pressable key={folder.id} onPress={() => setFolderStack((stack) => [...stack, folder])} onLongPress={() => openFolderActions(folder)} style={styles.folderTile}><Ionicons name="folder-outline" size={27} color={colors.tealDark} /><Text numberOfLines={1} style={styles.collectionName}>{folder.name}</Text><Text style={styles.collectionMeta}>{folder.itemCount} ألبوم</Text></Pressable>)}</View></> : null}
    <Text style={styles.sectionTitle}>الألبومات</Text>
  </View>;

  if (loading && !items.length && mode === 'library') return <View style={styles.center}><ActivityIndicator color={colors.tealDark} /></View>;

  return <View style={styles.screen}>
    {mode === 'library' ? <FlatList
      data={items}
      numColumns={3}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={Header}
      ListFooterComponent={<View>{loadingMore ? <ActivityIndicator style={styles.footerSpinner} color={colors.tealDark} /> : null}{!items.length && !loading ? <View style={styles.empty}><Ionicons name="images-outline" size={35} color={colors.inkFaint} /><Text style={styles.emptyTitle}>{filter === 'private' ? 'لا توجد وسائط مخفية' : 'مكتبة مُرشد فارغة'}</Text><Text style={styles.emptyBody}>استورد وسائط محددة أو من مكتبة الجهاز. لا تبدأ عملية النسخ قبل مراجعة العدد والحجم التقديري.</Text></View> : null}<Pressable onPress={secretTap} style={styles.secretTile}><View style={styles.secretBlack}><Ionicons name="lock-closed-outline" size={24} color={colors.paper} /></View><Text style={styles.secretText}>قسم الصور الخصوصية</Text></Pressable></View>}
      onEndReached={() => { void loadMore(); }}
      onEndReachedThreshold={0.45}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadFirstPage(true); }} tintColor={colors.tealDark} />}
      renderItem={renderMedia}
      initialNumToRender={18}
      maxToRenderPerBatch={18}
      windowSize={7}
      removeClippedSubviews
      ListEmptyComponent={null}
    /> : <FlatList
      data={albums}
      keyExtractor={(item) => item.id}
      numColumns={2}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={albums.length ? styles.row : undefined}
      ListHeaderComponent={<View>{Header}{CollectionHeader}</View>}
      ListEmptyComponent={<View style={styles.empty}><Ionicons name="albums-outline" size={35} color={colors.inkFaint} /><Text style={styles.emptyTitle}>لا توجد ألبومات في هذا المجلد</Text><Text style={styles.emptyBody}>أنشئ ألبومًا أو مجلدًا، ثم أضف إليه صورًا وفيديوهات من المكتبة.</Text></View>}
      renderItem={({ item }) => <Pressable onPress={() => openAlbum(item)} onLongPress={() => openAlbumActions(item)} style={styles.albumTile}><View style={[styles.albumCover, { overflow: 'hidden' }]}>{item.coverUri ? <ExpoImage source={{ uri: item.coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : <Ionicons name="images-outline" size={29} color={colors.tealDark} />}<View style={styles.albumCount}><Text style={styles.albumCountText}>{item.itemCount}</Text></View></View><Text numberOfLines={1} style={styles.collectionName}>{item.name}</Text><Text style={styles.collectionMeta}>{item.itemCount} عنصر</Text></Pressable>}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadNextCollectionList(); setRefreshing(false); }} tintColor={colors.tealDark} />}
    />}

    <Modal visible={Boolean(actionItem)} transparent animationType="fade" onRequestClose={() => setActionItem(null)}><View style={styles.modalBackdrop}><View style={styles.actionCard}><Text style={styles.actionTitle}>إدارة العنصر</Text><Text numberOfLines={2} style={styles.actionBody}>{actionItem?.filename}</Text><Pressable onPress={() => { if (actionItem) setEditor({ kind: 'media', mode: 'rename', id: actionItem.id, value: actionItem.filename }); setActionItem(null); }} style={styles.modalAction}><Ionicons name="create-outline" size={18} color={colors.tealDark} /><Text style={styles.modalActionText}>إعادة تسمية</Text></Pressable><Pressable onPress={() => actionItem && hideItem(actionItem)} style={styles.modalAction}><Ionicons name="eye-off-outline" size={18} color={colors.tealDark} /><Text style={styles.modalActionText}>إخفاء في الصور الخصوصية</Text></Pressable><Pressable onPress={() => { if (actionItem) void exportSelectionToPhotos(); }} style={styles.modalAction}><Ionicons name="share-outline" size={18} color={colors.tealDark} /><Text style={styles.modalActionText}>حفظ في صور الجهاز</Text></Pressable><Pressable onPress={() => actionItem && removeItem(actionItem)} style={[styles.modalAction, styles.deleteAction]}><Ionicons name="trash-outline" size={18} color={colors.danger} /><Text style={[styles.modalActionText, styles.deleteText]}>حذف نسخة مُرشد فقط</Text></Pressable><Pressable onPress={() => setActionItem(null)} style={styles.cancelAction}><Text style={styles.cancelText}>إلغاء</Text></Pressable></View></View></Modal>

    <Modal visible={pinOpen} transparent animationType="fade" onRequestClose={() => setPinOpen(false)}><View style={styles.modalBackdrop}><View style={styles.actionCard}><Text style={styles.actionTitle}>{pinMode === 'create' ? 'أنشئ رمز الصور الخصوصية' : pinMode === 'recover' ? 'استرجاع رمز الصور الخصوصية' : pinMode === 'reset' ? 'أنشئ رمزًا جديدًا' : 'أدخل رمز الصور الخصوصية'}</Text><Text style={styles.actionBody}>{pinMode === 'create' ? 'يُحفظ محليًا ولا يُرسل إلى أي خادم.' : pinMode === 'recover' ? 'أجب عن سؤال الاسترجاع الذي حددته سابقًا.' : 'الرمز لا يُرسل إلى أي خادم.'}</Text>{pinMode !== 'recover' ? <TextInput value={pin} onChangeText={setPin} maxLength={32} secureTextEntry placeholder="رمز من 4 إلى 32 حرفًا أو رقمًا" placeholderTextColor={colors.inkFaint} style={styles.pinInput} /> : <><Text style={styles.recoveryQuestion}>{recoveryQuestion || 'لا يوجد سؤال استرجاع محفوظ.'}</Text><TextInput value={recoveryAnswer} onChangeText={setRecoveryAnswer} placeholder="إجابة سؤال الاسترجاع" placeholderTextColor={colors.inkFaint} style={styles.pinInput} /></>}{pinMode === 'create' || pinMode === 'reset' ? <TextInput value={pinConfirm} onChangeText={setPinConfirm} maxLength={32} secureTextEntry placeholder="تأكيد الرمز" placeholderTextColor={colors.inkFaint} style={styles.pinInput} /> : null}{pinMode === 'create' ? <><TextInput value={recoveryQuestion} onChangeText={setRecoveryQuestion} placeholder="سؤال الاسترجاع" placeholderTextColor={colors.inkFaint} style={styles.pinInput} /><TextInput value={recoveryAnswer} onChangeText={setRecoveryAnswer} placeholder="إجابة سؤال الاسترجاع" placeholderTextColor={colors.inkFaint} style={styles.pinInput} /></> : null}{pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}{pinMode === 'unlock' ? <Pressable onPress={() => { void startRecovery(); }} style={styles.forgotButton}><Text style={styles.forgotText}>نسيت الرمز؟ استخدم سؤال الاسترجاع</Text></Pressable> : null}<Pressable onPress={() => { void submitPin(); }} style={styles.savePin}><Text style={styles.savePinText}>{pinMode === 'create' ? 'حفظ الرمز وسؤال الاسترجاع' : pinMode === 'recover' ? 'تحقق من الإجابة' : pinMode === 'reset' ? 'حفظ الرمز الجديد' : 'فتح القسم'}</Text></Pressable><Pressable onPress={() => setPinOpen(false)} style={styles.cancelAction}><Text style={styles.cancelText}>إلغاء</Text></Pressable></View></View></Modal>

    <Modal visible={Boolean(editor)} transparent animationType="fade" onRequestClose={() => setEditor(null)}><View style={styles.modalBackdrop}><View style={styles.actionCard}><Text style={styles.actionTitle}>{editor?.mode === 'create' ? editor.kind === 'album' ? 'إنشاء ألبوم' : 'إنشاء مجلد' : editor?.kind === 'media' ? 'إعادة تسمية الملف' : 'إعادة تسمية'}</Text><TextInput autoFocus value={editor?.value ?? ''} onChangeText={(value) => setEditor((current) => current ? { ...current, value } : current)} placeholder="الاسم" placeholderTextColor={colors.inkFaint} style={styles.pinInput} /><View style={styles.editorButtons}><Pressable onPress={() => setEditor(null)} style={styles.cancelAction}><Text style={styles.cancelText}>إلغاء</Text></Pressable><Pressable onPress={() => { void saveEditor(); }} style={styles.savePin}><Text style={styles.savePinText}>حفظ</Text></Pressable></View></View></View></Modal>

    <Modal visible={albumPickerOpen} transparent animationType="fade" onRequestClose={() => setAlbumPickerOpen(false)}><View style={styles.modalBackdrop}><View style={styles.actionCard}><Text style={styles.actionTitle}>اختر ألبومًا</Text><FlatList data={[]} renderItem={() => null} ListHeaderComponent={<View>{albums.map((album) => <Pressable key={album.id} onPress={() => { void assignSelection(album.id); }} style={styles.pickerRow}><Ionicons name="albums-outline" size={18} color={colors.tealDark} /><Text style={styles.pickerText}>{album.name}</Text><Text style={styles.collectionMeta}>{album.itemCount}</Text></Pressable>)}<Pressable onPress={() => { setAlbumPickerOpen(false); setMode('collections'); setEditor({ kind: 'album', mode: 'create', value: '' }); }} style={styles.pickerRow}><Ionicons name="add-circle-outline" size={18} color={colors.tealDark} /><Text style={styles.pickerText}>إنشاء ألبوم جديد</Text></Pressable></View>} /></View></View></Modal>

    <Modal visible={folderPickerOpen} transparent animationType="fade" onRequestClose={() => setFolderPickerOpen(false)}><View style={styles.modalBackdrop}><View style={styles.actionCard}><Text style={styles.actionTitle}>نقل الألبوم إلى مجلد</Text><Pressable onPress={() => { if (selectedAlbumForActions) void setAlbumFolder(selectedAlbumForActions.id).then(loadNextCollectionList); setFolderPickerOpen(false); }} style={styles.pickerRow}><Ionicons name="albums-outline" size={18} color={colors.tealDark} /><Text style={styles.pickerText}>بدون مجلد</Text></Pressable>{folders.map((folder) => <Pressable key={folder.id} onPress={() => { if (selectedAlbumForActions) void setAlbumFolder(selectedAlbumForActions.id, folder.id).then(loadNextCollectionList); setFolderPickerOpen(false); }} style={styles.pickerRow}><Ionicons name="folder-outline" size={18} color={colors.tealDark} /><Text style={styles.pickerText}>{folder.name}</Text></Pressable>)}<Pressable onPress={() => setFolderPickerOpen(false)} style={styles.cancelAction}><Text style={styles.cancelText}>إلغاء</Text></Pressable></View></View></Modal>

    {viewerOpen ? <Viewer items={items} startIndex={viewerStart} onClose={() => setViewerOpen(false)} /> : null}
    {exporting ? <View pointerEvents="none" style={styles.exportOverlay}><ActivityIndicator color={colors.paper} /><Text style={styles.exportText}>جارٍ تصدير الوسائط…</Text></View> : null}
  </View>;
}

function Viewer({ items, startIndex, onClose }: { items: StoredMediaItem[]; startIndex: number; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const onViewableItemsChanged = useMemo(() => ({ viewableItems }: { viewableItems: ViewToken<StoredMediaItem>[] }) => {
    const nextIndex = viewableItems.find((item) => item.isViewable)?.index;
    if (nextIndex !== null && nextIndex !== undefined) { setActiveIndex(nextIndex); setPlayingVideoId(null); }
  }, []);
  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 55 }), []);
  return <Modal visible animationType="fade" onRequestClose={onClose}><View style={styles.viewer}><Pressable accessibilityRole="button" accessibilityLabel="إغلاق العارض" onPress={onClose} style={styles.viewerClose}><Ionicons name="close" size={24} color={colors.paper} /></Pressable><FlatList data={items} horizontal pagingEnabled initialScrollIndex={startIndex} initialNumToRender={1} maxToRenderPerBatch={1} windowSize={3} keyExtractor={(item) => item.id} getItemLayout={(_, index) => ({ length: VIEWER_WIDTH, offset: VIEWER_WIDTH * index, index })} onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={viewabilityConfig} renderItem={({ item, index }) => <View style={styles.viewerPage}>{item.type === 'image' ? <Image source={{ uri: item.uri }} style={styles.viewerImage} resizeMode="contain" /> : item.type === 'video' ? index !== activeIndex ? <View style={styles.viewerVideoPlaceholder}><Ionicons name="videocam-outline" size={28} color={colors.tealDark} /><Text style={styles.viewerHint}>اسحب لعرض هذا الفيديو</Text></View> : playingVideoId === item.id ? <VideoAsset key={item.id} uri={item.uri} large /> : <Pressable onPress={() => setPlayingVideoId(item.id)} style={styles.viewerVideoPoster}><VideoThumbnail uri={item.uri} filename={item.filename} duration={item.duration} /><Text style={styles.playPrompt}>اضغط لتشغيل الفيديو</Text></Pressable> : <View style={styles.fileViewer}><Ionicons name="document-text-outline" size={72} color={colors.tealSoft} /><Text style={styles.viewerFileName}>{item.filename}</Text><Text style={styles.viewerHint}>هذا الملف محفوظ داخل مساحة مُرشد.</Text></View>}</View>} /></View></Modal>;
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }, row: { gap: spacing.sm }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  notice: { marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.tealSoft, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }, noticeText: { ...typography.body, color: colors.inkMuted, fontSize: 11, flex: 1, lineHeight: 18 },
  storageCard: { marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }, storageLine: { flexDirection: 'row', justifyContent: 'space-between' }, storageLabel: { ...typography.label, color: colors.inkMuted, fontSize: 10 }, storageBar: { height: 5, borderRadius: 4, backgroundColor: colors.line, marginTop: spacing.sm, overflow: 'hidden' }, storageFill: { height: 5, backgroundColor: colors.tealDark }, storageHint: { ...typography.body, color: colors.inkFaint, fontSize: 9, marginTop: spacing.xs },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md }, modeButton: { flex: 1, minHeight: 40, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderRadius: radii.pill, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, modeButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink }, modeText: { ...typography.label, color: colors.inkMuted, fontSize: 11 }, modeTextActive: { color: colors.paper },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingHorizontal: spacing.md, minHeight: 44 }, searchInput: { flex: 1, color: colors.ink, ...typography.body, paddingVertical: spacing.xs, textAlign: 'right' }, sortButton: { flexDirection: 'row', alignItems: 'center', gap: 3, padding: spacing.xs }, sortText: { ...typography.label, fontSize: 10, color: colors.tealDark },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }, filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 }, filterActive: { backgroundColor: colors.ink, borderColor: colors.ink }, filterText: { ...typography.label, color: colors.inkMuted, fontSize: 10 }, filterTextActive: { color: colors.paper },
  permissionBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, marginTop: spacing.xs }, permissionBannerText: { ...typography.label, color: colors.tealDark, fontSize: 10 }, backToLibrary: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs }, actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }, actionButton: { flex: 1, minHeight: 42, borderRadius: radii.pill, backgroundColor: colors.tealDark, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center' }, actionText: { ...typography.label, color: colors.paper, fontSize: 11 }, fileButton: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, fileText: { color: colors.ink },
  bulkBar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.tealSoft }, bulkCount: { ...typography.label, color: colors.ink, fontSize: 10 }, bulkAction: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.paper }, bulkActionText: { ...typography.label, color: colors.tealDark, fontSize: 9 }, bulkDelete: { padding: 6, marginStart: 'auto' },
  jobCard: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.sm }, jobTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, jobTitle: { ...typography.label, color: colors.ink, fontSize: 11 }, jobDetail: { ...typography.body, color: colors.inkMuted, fontSize: 10, marginTop: 5 }, jobButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }, jobButton: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.tealSoft }, jobButtonText: { ...typography.label, color: colors.tealDark, fontSize: 10 }, jobButtonSecondary: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line }, jobButtonSecondaryText: { ...typography.label, color: colors.inkMuted, fontSize: 10 }, jobError: { ...typography.body, color: colors.danger, fontSize: 10, marginTop: spacing.xs }, progressTrack: { height: 6, backgroundColor: colors.line, borderRadius: 5, marginTop: spacing.sm, overflow: 'hidden' }, progressFill: { height: 6, backgroundColor: colors.tealDark },
  errorNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, marginTop: spacing.xs, borderRadius: radii.md, backgroundColor: colors.coralSoft },
  tile: { width: '31.7%', aspectRatio: 1, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.paper, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', alignItems: 'center' }, tileSelected: { borderWidth: 3, borderColor: colors.tealDark }, image: { width: '100%', height: '100%' }, typeTile: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: spacing.xs }, fileName: { ...typography.label, color: colors.inkMuted, fontSize: 9, textAlign: 'center', marginTop: 4 }, videoThumbnail: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealSoft }, videoThumbnailImage: { width: '100%', height: '100%' }, videoFallback: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: spacing.sm }, videoDuration: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.72)' }, videoDurationText: { ...typography.label, color: colors.paper, fontSize: 8 }, videoPlayBadge: { position: 'absolute', right: 7, bottom: 7, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, selectedBadge: { position: 'absolute', top: 5, right: 5, width: 23, height: 23, borderRadius: 12, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }, emptyTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.sm }, emptyBody: { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.xs, lineHeight: 20, fontSize: 12 }, secretTile: { alignItems: 'center', padding: spacing.md, alignSelf: 'center' }, secretBlack: { width: 48, height: 48, backgroundColor: '#050607', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }, secretText: { ...typography.label, color: colors.inkFaint, fontSize: 9, marginTop: 4 }, footerSpinner: { padding: spacing.md },
  collectionHeader: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 }, backButton: { flexDirection: 'row', alignItems: 'center', gap: 3 }, backText: { ...typography.label, color: colors.tealDark, fontSize: 10 }, collectionPath: { ...typography.label, color: colors.ink, fontSize: 11 }, collectionActions: { flexDirection: 'row', gap: 6 }, smallButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 7, backgroundColor: colors.tealSoft }, smallButtonText: { ...typography.label, color: colors.tealDark, fontSize: 10 }, sectionTitle: { ...typography.h2, color: colors.ink, fontSize: 15, marginTop: spacing.md, marginBottom: spacing.sm }, collectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, folderTile: { width: '48%', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.xs }, albumTile: { width: '48%', marginBottom: spacing.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.sm }, albumCover: { height: 92, borderRadius: radii.sm, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs }, albumCount: { position: 'absolute', bottom: 5, right: 5, borderRadius: radii.pill, backgroundColor: colors.paper, paddingHorizontal: 7, paddingVertical: 2 }, albumCountText: { ...typography.label, color: colors.tealDark, fontSize: 9 }, collectionName: { ...typography.label, color: colors.ink, fontSize: 11 }, collectionMeta: { ...typography.body, color: colors.inkFaint, fontSize: 9, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5,7,8,0.58)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }, actionCard: { width: '100%', maxWidth: 430, maxHeight: '86%', backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg }, actionTitle: { ...typography.h2, color: colors.ink }, actionBody: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: spacing.xs, lineHeight: 19 }, modalAction: { minHeight: 46, borderRadius: radii.md, backgroundColor: colors.tealSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm }, modalActionText: { ...typography.label, color: colors.tealDark, fontSize: 11 }, deleteAction: { backgroundColor: colors.coralSoft }, deleteText: { color: colors.danger }, cancelAction: { alignItems: 'center', padding: spacing.md, marginTop: spacing.xs }, cancelText: { ...typography.label, color: colors.inkMuted }, pinInput: { minHeight: 46, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, color: colors.ink, paddingHorizontal: spacing.md, marginTop: spacing.sm, ...typography.body }, savePin: { flex: 1, minHeight: 46, borderRadius: radii.md, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md }, savePinText: { ...typography.label, color: colors.paper, fontSize: 11 }, pinError: { ...typography.body, color: colors.danger, fontSize: 11, marginTop: spacing.sm }, forgotButton: { alignItems: 'center', paddingVertical: spacing.sm }, forgotText: { ...typography.label, color: colors.tealDark, fontSize: 10 }, recoveryQuestion: { ...typography.body, color: colors.ink, backgroundColor: colors.tealSoft, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.sm }, editorButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, pickerRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, pickerText: { ...typography.label, color: colors.ink, fontSize: 11, flex: 1 },
  viewer: { flex: 1, backgroundColor: '#050607', justifyContent: 'center' }, viewerClose: { position: 'absolute', zIndex: 2, top: 48, right: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center' }, viewerPage: { width: VIEWER_WIDTH, height: '100%', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 24 }, viewerImage: { width: '100%', height: '100%' }, viewerVideo: { width: '100%', height: '75%' }, videoPreview: { width: '100%', height: '100%' }, viewerVideoPlaceholder: { alignItems: 'center', gap: spacing.sm }, viewerHint: { ...typography.body, color: colors.paper, fontSize: 12 }, viewerVideoPoster: { alignItems: 'center', gap: spacing.md, width: '75%' }, playPrompt: { ...typography.label, color: colors.paper }, fileViewer: { alignItems: 'center', gap: spacing.md }, viewerFileName: { ...typography.h2, color: colors.paper, textAlign: 'center', paddingHorizontal: spacing.lg },
  exportOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, exportText: { ...typography.label, color: colors.paper },
}); }
