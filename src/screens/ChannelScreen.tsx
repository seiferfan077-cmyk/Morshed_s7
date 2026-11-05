import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, AppState, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { ActionButton } from '../components/ActionButton';
import { showAppError } from '../components/AppDialogProvider';
import { SurfaceCard } from '../components/SurfaceCard';
import { useAppTheme } from '../theme/ThemeProvider';
import { radii, spacing, typography, type ThemeColors } from '../theme';
import {
  type ChannelCursor,
  type ChannelPost,
  type ChannelAdminRole,
  deleteChannelPost,
  editChannelPost,
  hasChannelAdminAccess,
  listChannelPosts,
  loginChannelAdmin,
  logoutChannelAdmin,
  publishChannelPost,
  reactToChannelPost,
  setChannelPostPinned,
} from '../services/channel/channelService';
import { cacheChannelPosts, getCachedChannelPosts, removeCachedChannelPosts } from '../services/channel/channelCache';
import { registerForChannelNotifications, type ChannelNotificationRegistration } from '../services/channel/channelNotifications';

const FEED_REFRESH_INTERVAL_MS = 30_000;
const HIDDEN_ADMIN_TAPS = 30;

export function ChannelScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState<ChannelCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [adminRole, setAdminRole] = useState<ChannelAdminRole | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [composerHeight, setComposerHeight] = useState(44);
  const [notificationStatus, setNotificationStatus] = useState<ChannelNotificationRegistration | 'checking' | 'failed'>('checking');
  const [loggedIn, setLoggedIn] = useState(false);
  const [editingPost, setEditingPost] = useState<ChannelPost | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const hiddenTapCount = useRef(0);
  const loadBusy = useRef(false);
  const feedRef = useRef<ScrollView>(null);

  const refreshNotificationStatus = useCallback(async (requestPermission = true) => {
    try {
      const registered = await registerForChannelNotifications({ requestPermission });
      setNotificationStatus(registered);
    } catch (error) {
      console.warn('Channel notification registration failed', error instanceof Error ? error.message : 'unknown');
      setNotificationStatus('failed');
    }
  }, []);

  const load = useCallback(async (showLoading = true) => {
    if (loadBusy.current) return;
    loadBusy.current = true;
    if (showLoading) setRefreshing(true);
    try {
      const feed = await listChannelPosts();
      await cacheChannelPosts(feed.posts, feed.deletedIds);
      const deleted = new Set(feed.deletedIds);
      setPosts((current) => mergePosts(current.filter((post) => !deleted.has(post.id)), feed.posts));
      setNextCursor(feed.nextCursor);
      setHasMore(Boolean(feed.nextCursor));
    } catch (error) {
      const cached = await getCachedChannelPosts().catch(() => []);
      setPosts((current) => current.length ? current : cached);
      if (showLoading && !cached.length && !(error instanceof Error && error.message === 'channel_not_configured')) {
        showAppError('تعذر تحميل القناة', 'افحص اتصال الإنترنت وحاول مرة تانية. اسحب الشاشة لتحديث المنشورات.');
      }
    } finally {
      loadBusy.current = false;
      if (showLoading) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const cached = await getCachedChannelPosts().catch(() => []);
      const hasAccess = await hasChannelAdminAccess().catch(() => false);
      if (active) {
        if (cached.length) setPosts(cached);
        setLoggedIn(hasAccess);
        if (!hasAccess) setAdminRole(null);
      }
      void refreshNotificationStatus();
    })();
    return () => { active = false; };
  }, [refreshNotificationStatus]);

  useFocusEffect(useCallback(() => {
    void load();
    void refreshNotificationStatus();
    const interval = setInterval(() => { void load(false); }, FEED_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load, refreshNotificationStatus]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshNotificationStatus(false);
    });
    return () => subscription.remove();
  }, [refreshNotificationStatus]);

  const loadOlder = async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const feed = await listChannelPosts(nextCursor);
      await cacheChannelPosts(feed.posts, feed.deletedIds);
      const deleted = new Set(feed.deletedIds);
      setPosts((current) => mergePosts(current.filter((post) => !deleted.has(post.id)), feed.posts));
      setNextCursor(feed.nextCursor);
      setHasMore(Boolean(feed.nextCursor));
    } catch {
      showAppError('تعذر تحميل الرسائل الأقدم', 'حاول مرة تانية بعد التأكد من اتصال الإنترنت.', { retryLabel: 'إعادة المحاولة', onRetry: () => { void loadOlder(); } });
    } finally {
      setLoadingOlder(false);
    }
  };

  const enterAdmin = async () => {
    if (adminBusy) return;
    if (!adminPassword) {
      showAppError('أدخل كلمة المرور', 'اكتب كلمة المرور المؤقتة المهيأة على الخادم لفتح لوحة النشر.');
      return;
    }
    setAdminBusy(true);
    try {
      const access = await loginChannelAdmin(adminPassword);
      setAdminRole(access.role);
      setLoggedIn(true);
      setAdminPassword('');
      setAdminModalVisible(false);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'invalid_admin_password') {
        showAppError('كلمة المرور غير صحيحة', 'تحقق من كلمة المرور المؤقتة المهيأة على الخادم ثم حاول مرة أخرى.');
      } else if (code === 'channel_admin_password_not_configured') {
        showAppError('الدخول غير مهيأ', 'لم تُضبط كلمة المرور المؤقتة على الخادم بعد.');
      } else {
        showAppError('تعذر فتح لوحة النشر', 'تحقق من اتصال الإنترنت ثم أعد المحاولة.');
      }
    } finally {
      setAdminBusy(false);
    }
  };

  const publish = async () => {
    const body = newPost.trim();
    if (!body || publishing) return;
    setPublishing(true);
    try {
      await publishChannelPost(body);
      setNewPost('');
      setComposerHeight(44);
      await load(false);
      requestAnimationFrame(() => feedRef.current?.scrollTo({ y: 0, animated: true }));
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      await clearExpiredAdmin(code);
      showAppError('تعذر النشر', code === 'invalid_admin_password'
        ? 'انتهت صلاحية كلمة المرور على الخادم. أدخل كلمة المرور الحالية مرة أخرى.'
        : 'تحقق من اتصال الإنترنت وإعداد كلمة المرور على الخادم ثم حاول مجددًا.');
    } finally {
      setPublishing(false);
    }
  };

  const clearExpiredAdmin = async (code: string) => {
    if (code !== 'invalid_admin_password' && code !== 'channel_admin_password_not_configured') return;
    await logoutChannelAdmin().catch(() => undefined);
    setLoggedIn(false);
    setAdminRole(null);
  };

  const leaveAdmin = async () => {
    await logoutChannelAdmin().catch(() => undefined);
    setLoggedIn(false);
    setAdminRole(null);
  };

  const openEditor = (post: ChannelPost) => {
    setEditingPost(post);
    setEditDraft(post.body);
  };

  const saveEdit = async () => {
    if (!editingPost || editBusy) return;
    const body = editDraft.trim();
    if (!body) {
      showAppError('الرسالة فارغة', 'اكتب نص الرسالة قبل حفظ التعديل.');
      return;
    }
    setEditBusy(true);
    try {
      const result = await editChannelPost(editingPost.id, body);
      if (result.post) setPosts((current) => mergePosts(current, [result.post as ChannelPost]));
      setEditingPost(null);
      setEditDraft('');
      await load(false);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      await clearExpiredAdmin(code);
      showAppError('تعذر تعديل الرسالة', code === 'invalid_admin_password'
        ? 'انتهت صلاحية كلمة المرور على الخادم. سجّل دخول المسؤول مرة أخرى.'
        : 'لم يُحفظ التعديل. تحقق من الاتصال ثم حاول مجددًا.');
    } finally {
      setEditBusy(false);
    }
  };

  const confirmDelete = (post: ChannelPost) => {
    Alert.alert('حذف الرسالة؟', 'ستختفي الرسالة من القناة على جميع الأجهزة بعد مزامنة القناة.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف للجميع', style: 'destructive', onPress: () => { void removePost(post); } },
    ]);
  };

  const removePost = async (post: ChannelPost) => {
    try {
      await deleteChannelPost(post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      await removeCachedChannelPosts([post.id]);
      await load(false);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      await clearExpiredAdmin(code);
      showAppError('تعذر حذف الرسالة', code === 'invalid_admin_password'
        ? 'انتهت صلاحية كلمة المرور على الخادم. سجّل دخول المسؤول مرة أخرى.'
        : 'لم يُحذف المنشور. تحقق من الاتصال ثم حاول مجددًا.');
    }
  };

  const togglePinned = async (post: ChannelPost) => {
    try {
      const result = await setChannelPostPinned(post.id, !post.pinned_at);
      if (result.post) setPosts((current) => mergePosts(current, [result.post as ChannelPost]));
      await load(false);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      await clearExpiredAdmin(code);
      showAppError('تعذر تحديث التثبيت', code === 'invalid_admin_password'
        ? 'انتهت صلاحية كلمة المرور على الخادم. سجّل دخول المسؤول مرة أخرى.'
        : 'تحقق من الاتصال ثم حاول مرة أخرى.');
    }
  };

  const openHiddenAdmin = () => {
    hiddenTapCount.current += 1;
    if (hiddenTapCount.current >= HIDDEN_ADMIN_TAPS) {
      hiddenTapCount.current = 0;
      setAdminModalVisible(true);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={feedRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(); }} />}
      >
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoText}>م</Text></View>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>القناة الرسمية</Text>
            <Text style={styles.title}>مُرشد</Text>
            <Text style={styles.subtitle}>آخر أخبار وتحديثات فريق مُرشد</Text>
          </View>
          <Ionicons name="checkmark-circle" size={25} color="#2f80ed" />
        </View>

        <View style={styles.syncNote}>
          <Ionicons name="cloud-done-outline" size={17} color={colors.tealDark} />
          <Text style={styles.syncText}>الرسائل محفوظة على الخادم، ونسخة منها متاحة على جهازك عند انقطاع النت.</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (notificationStatus === 'permission-denied') void Linking.openSettings();
            else void refreshNotificationStatus();
          }}
          style={[styles.notificationStatus, notificationStatus !== 'registered' && notificationStatus !== 'checking' && styles.notificationStatusWarning]}
        >
          <Ionicons name={notificationStatus === 'registered' ? 'notifications' : 'notifications-off-outline'} size={16} color={notificationStatus === 'registered' ? colors.tealDark : colors.coral} />
          <Text style={[styles.notificationStatusText, notificationStatus !== 'registered' && notificationStatus !== 'checking' && styles.notificationStatusWarningText]}>
            {notificationStatus === 'checking' ? 'جارٍ التحقق من إشعارات هذا الجهاز…' : notificationStatus === 'registered' ? 'إشعارات القناة مسجّلة على هذا الجهاز' : notificationStatus === 'permission-denied' ? 'اسمح بإشعارات القناة من إعدادات الهاتف — اضغط لفتحها' : 'تعذر تسجيل الإشعارات — اضغط لإعادة المحاولة'}
          </Text>
        </Pressable>

        {posts.length === 0 ? (
          <SurfaceCard><Text style={styles.empty}>لا توجد منشورات منشورة بعد.</Text></SurfaceCard>
        ) : posts.map((post) => (
          <View key={post.id} style={styles.messageRow}>
            <View style={styles.messageBubble}>
              {Boolean(post.pinned_at) && (
                <View style={styles.pinnedLabel}>
                  <Ionicons name="pin" size={13} color={colors.tealDark} />
                  <Text style={styles.pinnedLabelText}>رسالة مثبتة</Text>
                </View>
              )}
              <Text style={styles.post}>{post.body}</Text>
              <View style={styles.messageMeta}>
                <Text style={styles.messageTime}>{formatPostDate(post.created_at)}</Text>
                {post.updated_at > post.created_at && <Text style={styles.editedText}>تم التعديل</Text>}
                <Ionicons name="checkmark-done" size={14} color={colors.tealDark} />
              </View>
              <View style={styles.reactions}>
                {['❤️', '👍', '👏', '🤍'].map((emoji) => (
                  <Pressable key={emoji} onPress={() => reactToChannelPost(post.id, emoji).catch(() => undefined)} style={styles.reaction}>
                    <Text>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
              {loggedIn && (
                <View style={styles.adminMessageActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel={post.pinned_at ? 'إلغاء تثبيت الرسالة' : 'تثبيت الرسالة'} onPress={() => { void togglePinned(post); }} style={styles.messageAction}>
                    <Ionicons name={post.pinned_at ? 'pin' : 'pin-outline'} size={16} color={colors.tealDark} />
                    <Text style={styles.messageActionText}>{post.pinned_at ? 'إلغاء التثبيت' : 'تثبيت'}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="تعديل الرسالة" onPress={() => openEditor(post)} style={styles.messageAction}>
                    <Ionicons name="create-outline" size={16} color={colors.tealDark} />
                    <Text style={styles.messageActionText}>تعديل</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="حذف الرسالة" onPress={() => confirmDelete(post)} style={[styles.messageAction, styles.deleteAction]}>
                    <Ionicons name="trash-outline" size={16} color={colors.coral} />
                    <Text style={[styles.messageActionText, styles.deleteText]}>حذف</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        ))}

        {hasMore && (
          <ActionButton tone="quiet" onPress={loadOlder}>
            {loadingOlder ? 'جارٍ تحميل الرسائل الأقدم...' : 'تحميل الرسائل الأقدم'}
          </ActionButton>
        )}

        <Pressable accessibilityRole="button" onPress={openHiddenAdmin} style={styles.footer}>
          <Text style={styles.footerText}>لا يسمح سوى لمرشد بإرسال الرسائل</Text>
          <Ionicons name="checkmark-circle" size={14} color="#2f80ed" />
        </Pressable>
      </ScrollView>

      {loggedIn && (
        <View style={styles.composerDock}>
          <View style={styles.composerHeader}>
            <View style={styles.composerLabelGroup}>
              <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.tealDark} />
              <Text style={styles.composerLabel}>{adminRole === 'owner' ? 'مسؤول القناة' : 'إرسال رسالة'}</Text>
            </View>
            <Pressable onPress={leaveAdmin} accessibilityRole="button" style={styles.logoutButton}>
              <Text style={styles.logoutText}>خروج</Text>
            </Pressable>
          </View>
          <View style={styles.composerRow}>
            <TextInput
              value={newPost}
              onChangeText={setNewPost}
              onContentSizeChange={(event) => setComposerHeight(Math.max(44, Math.min(120, event.nativeEvent.contentSize.height + 16)))}
              placeholder="اكتب رسالة للقناة..."
              placeholderTextColor={colors.inkFaint}
              multiline
              maxLength={8_000}
              textAlignVertical="center"
              accessibilityLabel="رسالة القناة"
              style={[styles.input, styles.composerInput, { height: composerHeight }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إرسال رسالة وإشعار المتابعين"
              disabled={!newPost.trim() || publishing}
              onPress={() => { void publish(); }}
              style={[styles.sendButton, (!newPost.trim() || publishing) && styles.sendButtonDisabled]}
            >
              <Ionicons name={publishing ? 'hourglass-outline' : 'send'} size={20} color="#FFFFFF" />
            </Pressable>
          </View>
          <Text style={styles.composerHint}>{publishing ? 'جارٍ الإرسال…' : 'سيصل إشعار لمتابعي القناة عند النشر'}</Text>
        </View>
      )}

      <Modal visible={adminModalVisible} animationType="fade" transparent onRequestClose={() => setAdminModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <View style={styles.modalIcon}><Ionicons name="lock-closed-outline" size={20} color={colors.tealDark} /></View>
              <Text style={styles.cardTitle}>دخول المسؤول</Text>
            </View>
            <Text style={styles.modalDescription}>أدخل كلمة المرور لفتح أدوات إدارة القناة.</Text>
            <TextInput
              value={adminPassword}
              onChangeText={setAdminPassword}
              placeholder="كلمة المرور"
              placeholderTextColor={colors.inkFaint}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={256}
              returnKeyType="go"
              onSubmitEditing={() => { void enterAdmin(); }}
              style={styles.input}
            />
            <ActionButton onPress={enterAdmin}>{adminBusy ? 'جارٍ التحقق…' : 'دخول المسؤول'}</ActionButton>
            <Pressable accessibilityRole="button" onPress={() => { setAdminModalVisible(false); setAdminPassword(''); }} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(editingPost)} animationType="fade" transparent onRequestClose={() => setEditingPost(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>تعديل الرسالة</Text>
            <TextInput
              value={editDraft}
              onChangeText={setEditDraft}
              placeholder="نص الرسالة"
              placeholderTextColor={colors.inkFaint}
              multiline
              maxLength={8_000}
              textAlignVertical="top"
              style={[styles.input, styles.editComposer]}
            />
            <ActionButton onPress={saveEdit}>{editBusy ? 'جارٍ الحفظ…' : 'حفظ التعديل'}</ActionButton>
            <Pressable accessibilityRole="button" onPress={() => { setEditingPost(null); setEditDraft(''); }} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function mergePosts(current: ChannelPost[], incoming: ChannelPost[]) {
  const unique = new Map(current.map((post) => [post.id, post]));
  for (const post of incoming) unique.set(post.id, post);
  return [...unique.values()].sort((a, b) => {
    const pinOrder = Number(Boolean(b.pinned_at)) - Number(Boolean(a.pinned_at));
    if (pinOrder) return pinOrder;
    const pinTimeOrder = Number(b.pinned_at ?? 0) - Number(a.pinned_at ?? 0);
    return pinTimeOrder || Number(b.created_at) - Number(a.created_at) || b.id.localeCompare(a.id);
  });
}

function formatPostDate(timestamp: number) {
  const date = new Date(Number(timestamp));
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
    logo: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
    logoText: { color: colors.paper, fontSize: 24, fontWeight: '800' },
    headerCopy: { flex: 1 },
    kicker: { ...typography.label, color: colors.tealDark },
    title: { ...typography.display, color: colors.ink, fontSize: 27 },
    subtitle: { ...typography.body, color: colors.inkMuted },
    syncNote: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, borderRadius: radii.md, backgroundColor: colors.tealSoft, padding: spacing.sm },
    syncText: { ...typography.body, color: colors.tealDark, fontSize: 11, flex: 1, textAlign: 'right' },
    adminHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { ...typography.h2, color: colors.ink, marginBottom: spacing.sm },
    logoutButton: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
    logoutText: { ...typography.label, color: colors.coral },
    input: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, color: colors.ink, padding: spacing.sm, minHeight: 48, textAlign: 'right', writingDirection: 'rtl', marginBottom: spacing.sm },
    notificationStatus: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, alignSelf: 'flex-end', borderRadius: radii.pill, backgroundColor: colors.tealSoft, paddingHorizontal: spacing.sm, paddingVertical: 7 },
    notificationStatusWarning: { backgroundColor: '#FFF1ED' },
    notificationStatusText: { ...typography.body, color: colors.tealDark, fontSize: 11, textAlign: 'right' },
    notificationStatusWarningText: { color: colors.coral },
    composerDock: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper },
    composerHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    composerLabelGroup: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
    composerLabel: { ...typography.label, color: colors.ink, fontSize: 12 },
    composerRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: spacing.sm },
    composerInput: { flex: 1, minHeight: 44, maxHeight: 120, marginBottom: 0, borderRadius: radii.lg, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 8 },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center' },
    sendButtonDisabled: { opacity: 0.48 },
    composerHint: { ...typography.body, color: colors.inkFaint, fontSize: 10, textAlign: 'right', marginTop: 5 },
    editComposer: { minHeight: 170 },
    messageRow: { width: '100%', alignItems: 'flex-end' },
    messageBubble: { maxWidth: '96%', minWidth: '72%', borderRadius: 19, borderBottomRightRadius: 5, backgroundColor: '#E6F4EE', borderWidth: 1, borderColor: '#D2E9DE', padding: spacing.md, shadowColor: '#0d2730', shadowOpacity: 0.06, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
    post: { ...typography.body, color: '#18352C', lineHeight: 25, textAlign: 'right', writingDirection: 'rtl' },
    messageMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 5, marginTop: spacing.sm },
    messageTime: { ...typography.body, color: '#58786C', fontSize: 10 },
    editedText: { ...typography.body, color: '#58786C', fontSize: 10 },
    pinnedLabel: { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-start', gap: 4, borderRadius: radii.pill, backgroundColor: '#D5ECE2', paddingHorizontal: 9, paddingVertical: 4, marginBottom: spacing.xs },
    pinnedLabelText: { ...typography.label, color: colors.tealDark, fontSize: 10 },
    reactions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs, marginTop: spacing.sm },
    reaction: { borderWidth: 1, borderColor: '#C6DFD3', backgroundColor: '#F7FCF9', borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
    adminMessageActions: { flexDirection: 'row-reverse', justifyContent: 'flex-start', flexWrap: 'wrap', gap: 7, borderTopWidth: 1, borderTopColor: '#D2E9DE', marginTop: spacing.sm, paddingTop: spacing.sm },
    messageAction: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, borderRadius: radii.pill, backgroundColor: '#F7FCF9', borderWidth: 1, borderColor: '#C6DFD3', paddingHorizontal: 9, paddingVertical: 6 },
    messageActionText: { ...typography.label, color: colors.tealDark, fontSize: 10 },
    deleteAction: { borderColor: '#F0D2CB', backgroundColor: '#FFF8F6' },
    deleteText: { color: colors.coral },
    empty: { ...typography.body, color: colors.inkMuted, textAlign: 'center' },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: spacing.lg },
    footerText: { ...typography.body, color: colors.inkMuted, fontSize: 12 },
    modalBackdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(7, 20, 24, 0.56)' },
    modalCard: { borderRadius: radii.lg, backgroundColor: colors.paper, padding: spacing.lg, shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
    modalTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
    modalIcon: { width: 38, height: 38, borderRadius: radii.md, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
    modalDescription: { ...typography.body, color: colors.inkMuted, textAlign: 'right', marginBottom: spacing.md },
    modalCancel: { alignItems: 'center', paddingVertical: spacing.md },
    modalCancelText: { ...typography.label, color: colors.inkMuted },
  });
}
