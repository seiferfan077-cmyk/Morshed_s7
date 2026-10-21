import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { ActionButton } from '../components/ActionButton';
import { showAppError } from '../components/AppDialogProvider';
import { SurfaceCard } from '../components/SurfaceCard';
import { useAppTheme } from '../theme/ThemeProvider';
import { radii, spacing, typography, type ThemeColors } from '../theme';
import {
  bootstrapChannelAdmin,
  type ChannelCursor,
  type ChannelPost,
  hasChannelAdminSession,
  listChannelPosts,
  loginChannelAdmin,
  logoutChannelAdmin,
  publishChannelPost,
  reactToChannelPost,
  setAdminPassword,
} from '../services/channel/channelService';
import { cacheChannelPosts, getCachedChannelPosts } from '../services/channel/channelCache';
import { registerForChannelNotifications } from '../services/channel/channelNotifications';

export function ChannelScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState<ChannelCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [taps, setTaps] = useState(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [role, setRole] = useState<'owner' | 'admin'>('owner');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordSetupRequired, setPasswordSetupRequired] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const feed = await listChannelPosts();
      await cacheChannelPosts(feed.posts);
      setPosts(feed.posts);
      setNextCursor(feed.nextCursor);
      setHasMore(Boolean(feed.nextCursor));
    } catch (error) {
      const cached = await getCachedChannelPosts().catch(() => []);
      setPosts((current) => current.length ? current : cached);
      if (!cached.length && !(error instanceof Error && error.message === 'channel_not_configured')) {
        showAppError('تعذر تحميل القناة', 'افحص اتصال الإنترنت وحاول مرة تانية. اسحب الشاشة لتحديث المنشورات.');
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const cached = await getCachedChannelPosts().catch(() => []);
      const hasSession = await hasChannelAdminSession().catch(() => false);
      if (active) {
        if (cached.length) setPosts(cached);
        setLoggedIn(hasSession);
      }
      void registerForChannelNotifications().catch(() => undefined);
      if (active) await load();
    })();
    return () => { active = false; };
  }, [load]);

  const loadOlder = async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const feed = await listChannelPosts(nextCursor);
      await cacheChannelPosts(feed.posts);
      setPosts((current) => mergePosts(current, feed.posts));
      setNextCursor(feed.nextCursor);
      setHasMore(Boolean(feed.nextCursor));
    } catch {
      showAppError('تعذر تحميل الرسائل الأقدم', 'حاول مرة تانية بعد التأكد من اتصال الإنترنت.', { retryLabel: 'إعادة المحاولة', onRetry: () => { void loadOlder(); } });
    } finally {
      setLoadingOlder(false);
    }
  };

  const hiddenGate = () => {
    const next = taps + 1;
    setTaps(next);
    if (next >= 30) {
      setTaps(0);
      setPasswordSetupRequired(false);
      setPassword('');
      setConfirmation('');
      setAdminOpen(true);
    }
  };

  const enterAdmin = async () => {
    if (!password) {
      showAppError('كلمة المرور مطلوبة', 'اكتب كلمة المرور المؤقتة لأول تهيئة، أو كلمة المرور الدائمة لو الحساب متجهز.');
      return;
    }
    try {
      const bootstrap = await bootstrapChannelAdmin(role, password);
      if (bootstrap.requiresPasswordChange) {
        setPassword('');
        setConfirmation('');
        setPasswordSetupRequired(true);
        return;
      }
    } catch {
      // A previously initialized admin bypasses bootstrap and authenticates below.
    }
    try {
      await loginChannelAdmin(password);
      setLoggedIn(true);
      setAdminOpen(false);
      setPassword('');
      setConfirmation('');
    } catch (error) {
      if (error instanceof Error && error.message === 'password_setup_required') {
        setPasswordSetupRequired(true);
        setPassword('');
        setConfirmation('');
        return;
      }
      showAppError('تعذر دخول الإدارة', 'كلمة المرور غير صحيحة أو الحساب غير مهيأ للنشر. لو دي أول مرة، استخدم كلمة المرور المؤقتة المضبوطة على الخادم.');
    }
  };

  const savePermanentPassword = async () => {
    if (password.length < 10 || password !== confirmation) {
      showAppError('راجع كلمة المرور', 'لازم تكون 10 أحرف على الأقل، وتأكيدها مطابق لها بالضبط.');
      return;
    }
    try {
      await setAdminPassword(password, confirmation);
      await loginChannelAdmin(password);
      setLoggedIn(true);
      setAdminOpen(false);
      setPasswordSetupRequired(false);
      setPassword('');
      setConfirmation('');
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      showAppError('ماقدرناش نحفظ كلمة المرور', code === 'password_already_set'
        ? 'الحساب متجهز بالفعل. اقفل النافذة وادخل بكلمة المرور الدائمة.'
        : 'راجع كلمة المرور المؤقتة وإعدادات الخادم، ثم جرّب تاني.');
    }
  };

  const publish = async () => {
    const body = newPost.trim();
    if (!body) return;
    try {
      await publishChannelPost(body);
      setNewPost('');
      await load();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'admin_session_expired' || code === 'admin_session_required') {
        await logoutChannelAdmin().catch(() => undefined);
        setLoggedIn(false);
        setAdminOpen(true);
      }
      showAppError('تعذر النشر', code === 'admin_session_expired'
        ? 'انتهت جلسة الإدارة؛ سجّل دخولك مرة تانية.'
        : 'لازم تسجّل دخولك بصلاحية إدارية معتمدة قبل النشر.');
    }
  };

  const leaveAdmin = async () => {
    await logoutChannelAdmin().catch(() => undefined);
    setLoggedIn(false);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
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

      {loggedIn && (
        <SurfaceCard accent={colors.teal}>
          <View style={styles.adminHeader}>
            <Text style={styles.cardTitle}>لوحة النشر</Text>
            <Pressable onPress={leaveAdmin} accessibilityRole="button" style={styles.logoutButton}>
              <Text style={styles.logoutText}>خروج</Text>
            </Pressable>
          </View>
          <TextInput
            value={newPost}
            onChangeText={setNewPost}
            placeholder="اكتب رسالة رسمية للقناة..."
            placeholderTextColor={colors.inkFaint}
            multiline
            maxLength={8_000}
            textAlignVertical="top"
            style={[styles.input, styles.composer]}
          />
          <ActionButton onPress={publish}>نشر الرسالة وإشعار المتابعين</ActionButton>
        </SurfaceCard>
      )}

      {posts.length === 0 ? (
        <SurfaceCard><Text style={styles.empty}>لا توجد منشورات منشورة بعد.</Text></SurfaceCard>
      ) : posts.map((post) => (
        <View key={post.id} style={styles.messageRow}>
          <View style={styles.messageBubble}>
            <Text style={styles.post}>{post.body}</Text>
            <View style={styles.messageMeta}>
              <Text style={styles.messageTime}>{formatPostDate(post.created_at)}</Text>
              <Ionicons name="checkmark-done" size={14} color={colors.tealDark} />
            </View>
            <View style={styles.reactions}>
              {['❤️', '👍', '👏', '🤍'].map((emoji) => (
                <Pressable key={emoji} onPress={() => reactToChannelPost(post.id, emoji).catch(() => undefined)} style={styles.reaction}>
                  <Text>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      ))}

      {hasMore && (
        <ActionButton tone="quiet" onPress={loadOlder}>
          {loadingOlder ? 'جارٍ تحميل الرسائل الأقدم...' : 'تحميل الرسائل الأقدم'}
        </ActionButton>
      )}

      <Pressable onPress={hiddenGate} hitSlop={8}>
        <View style={styles.footer}>
          <Text style={styles.footerText}>لا يُسمح إلا للمسؤول المعتمد بإرسال الرسائل</Text>
          <Ionicons name="checkmark-circle" size={14} color="#2f80ed" />
        </View>
      </Pressable>

      <Modal visible={adminOpen} transparent animationType="slide" onRequestClose={() => setAdminOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{passwordSetupRequired ? 'تعيين كلمة مرور دائمة' : 'بوابة الإدارة'}</Text>
            <Text style={styles.modalBody}>
              {passwordSetupRequired
                ? 'اكتب كلمة مرور جديدة من 10 أحرف على الأقل، ثم أكدها. ينطبق الإعداد على المسؤول والأدمن.'
                : 'اختر صفتك. أول دخول يحتاج كلمة المرور المؤقتة من الخادم، وبعدها تختار كلمة دائمة.'}
            </Text>
            {!passwordSetupRequired && (
              <View style={styles.roleRow}>
                <ActionButton tone={role === 'owner' ? 'primary' : 'quiet'} onPress={() => setRole('owner')}>مسؤول</ActionButton>
                <ActionButton tone={role === 'admin' ? 'primary' : 'quiet'} onPress={() => setRole('admin')}>أدمن</ActionButton>
              </View>
            )}
            <TextInput
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder={passwordSetupRequired ? 'كلمة المرور الجديدة' : 'المؤقتة أو الدائمة'}
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={128}
            />
            {passwordSetupRequired && (
              <TextInput
                secureTextEntry
                value={confirmation}
                onChangeText={setConfirmation}
                placeholder="تأكيد كلمة المرور الجديدة"
                placeholderTextColor={colors.inkFaint}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={128}
              />
            )}
            <ActionButton onPress={passwordSetupRequired ? savePermanentPassword : enterAdmin}>
              {passwordSetupRequired ? 'حفظ كلمة المرور والدخول' : 'دخول'}
            </ActionButton>
            <Pressable onPress={() => setAdminOpen(false)}><Text style={styles.cancel}>إلغاء</Text></Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function mergePosts(current: ChannelPost[], incoming: ChannelPost[]) {
  const unique = new Map(current.map((post) => [post.id, post]));
  for (const post of incoming) unique.set(post.id, post);
  return [...unique.values()].sort((a, b) => Number(b.created_at) - Number(a.created_at) || b.id.localeCompare(a.id));
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
    composer: { minHeight: 108 },
    messageRow: { width: '100%', alignItems: 'flex-end' },
    messageBubble: { maxWidth: '96%', minWidth: '72%', borderRadius: 19, borderBottomRightRadius: 5, backgroundColor: '#E6F4EE', borderWidth: 1, borderColor: '#D2E9DE', padding: spacing.md, shadowColor: '#0d2730', shadowOpacity: 0.06, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
    post: { ...typography.body, color: '#18352C', lineHeight: 25, textAlign: 'right', writingDirection: 'rtl' },
    messageMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 4, marginTop: spacing.sm },
    messageTime: { ...typography.body, color: '#58786C', fontSize: 10 },
    reactions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs, marginTop: spacing.sm },
    reaction: { borderWidth: 1, borderColor: '#C6DFD3', backgroundColor: '#F7FCF9', borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
    empty: { ...typography.body, color: colors.inkMuted, textAlign: 'center' },
    roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: spacing.lg },
    footerText: { ...typography.body, color: colors.inkMuted, fontSize: 12 },
    modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
    modal: { backgroundColor: colors.paper, padding: spacing.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    modalTitle: { ...typography.h2, color: colors.ink },
    modalBody: { ...typography.body, color: colors.inkMuted, marginVertical: spacing.sm },
    cancel: { ...typography.label, color: colors.inkMuted, textAlign: 'center', padding: spacing.md },
  });
}
