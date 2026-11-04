import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIdTokenAuthRequest } from 'expo-auth-session/providers/google';
import { GoogleOneTapSignIn, isCancelledResponse, isNoSavedCredentialFoundResponse, isSuccessResponse } from 'react-native-nitro-google-signin';
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
  hasChannelAdminAccess,
  listChannelPosts,
  loginChannelAdmin,
  logoutChannelAdmin,
  publishChannelPost,
  reactToChannelPost,
} from '../services/channel/channelService';
import { cacheChannelPosts, getCachedChannelPosts } from '../services/channel/channelCache';
import { registerForChannelNotifications } from '../services/channel/channelNotifications';
import { signInWithGoogleIdToken } from '../services/firebase/firebaseAuthService';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_CLIENT_ID_FALLBACK = 'google-oauth-not-configured.apps.googleusercontent.com';

export function ChannelScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [googleRequest, , promptGoogleSignIn] = useIdTokenAuthRequest({
    clientId: Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK : GOOGLE_WEB_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK,
    webClientId: GOOGLE_WEB_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK,
    iosClientId: GOOGLE_IOS_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK,
    selectAccount: true,
  }, Platform.OS === 'android' ? {} : { scheme: 'murshid' });
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState<ChannelCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminRole, setAdminRole] = useState<ChannelAdminRole | null>(null);
  const [newPost, setNewPost] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  const signInGoogleAccount = async () => {
    let idToken: string | null | undefined;
    if (Platform.OS === 'android') {
      if (!GOOGLE_WEB_CLIENT_ID) throw new Error('google_signin_not_configured');
      GoogleOneTapSignIn.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
      await GoogleOneTapSignIn.checkPlayServices();
      let result = await GoogleOneTapSignIn.signIn();
      if (isNoSavedCredentialFoundResponse(result)) result = await GoogleOneTapSignIn.createAccount();
      if (isNoSavedCredentialFoundResponse(result)) result = await GoogleOneTapSignIn.presentExplicitSignIn();
      if (isCancelledResponse(result)) return false;
      if (!isSuccessResponse(result)) throw new Error('google_signin_incomplete');
      idToken = result.data.idToken;
    } else {
      if (!googleRequest) throw new Error('google_signin_not_ready');
      const result = await promptGoogleSignIn();
      if (result.type === 'cancel' || result.type === 'dismiss') return false;
      if (result.type !== 'success') throw result.type === 'error' ? result.error ?? new Error('google_oauth_failed') : new Error('google_oauth_incomplete');
      idToken = result.authentication?.idToken ?? result.params.id_token;
    }
    if (!idToken) throw new Error('google_id_token_missing');
    await signInWithGoogleIdToken(idToken);
    return true;
  };

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
      const hasAccess = await hasChannelAdminAccess().catch(() => false);
      if (active) {
        if (cached.length) setPosts(cached);
        setLoggedIn(hasAccess);
        if (!hasAccess) setAdminRole(null);
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

  const enterAdmin = async () => {
    if (adminBusy) return;
    setAdminBusy(true);
    try {
      let access: { role: ChannelAdminRole };
      try {
        access = await loginChannelAdmin();
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'firebase_account_signin_required') throw error;
        const signedIn = await signInGoogleAccount();
        if (!signedIn) return;
        access = await loginChannelAdmin();
      }
      setAdminRole(access.role);
      setLoggedIn(true);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'google_signin_not_configured' || code === 'google_signin_not_ready') {
        showAppError('تسجيل الدخول غير مهيأ', 'يلزم ضبط إعداد Google OAuth لهذا الإصدار من التطبيق.');
      } else if (code === 'admin_required') {
        showAppError('الحساب غير مخوّل للنشر', 'حساب Google الذي اخترته غير مسجّل كمسؤول للقناة. اختر حساب Firebase المخوّل أو تواصل مع مالك القناة.');
      } else {
        showAppError('تعذر تسجيل الدخول', 'تعذر تسجيل الدخول بحساب Google أو التحقق من صلاحية UID. تحقق من الاتصال واختر حساب Firebase المخوّل ثم أعد المحاولة.');
      }
    } finally {
      setAdminBusy(false);
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
      if (code === 'admin_required' || code === 'unauthorized' || code === 'firebase_account_signin_required') {
        await logoutChannelAdmin().catch(() => undefined);
        setLoggedIn(false);
        setAdminRole(null);
      }
      showAppError('تعذر النشر', code === 'admin_required'
        ? 'الحساب الحالي لم يعد مخولًا للنشر. سجّل الدخول بالحساب المعتمد أو تواصل مع مالك القناة.'
        : 'تعذر التحقق من هوية Firebase أو اتصال الخادم. تحقق من الحساب والإنترنت ثم حاول مجددًا.');
    }
  };

  const leaveAdmin = async () => {
    await logoutChannelAdmin().catch(() => undefined);
    setLoggedIn(false);
    setAdminRole(null);
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

      <Pressable onPress={() => { void enterAdmin(); }} accessibilityRole="button" style={styles.adminEntry} disabled={adminBusy}>
        <Ionicons name={loggedIn ? 'shield-checkmark-outline' : 'person-circle-outline'} size={17} color={colors.tealDark} />
        <Text style={styles.adminEntryText}>{adminBusy ? 'جارٍ تسجيل الدخول والتحقق…' : loggedIn ? 'إعادة التحقق من صلاحية النشر' : 'فتح لوحة النشر بحساب Google'}</Text>
      </Pressable>

      {loggedIn && (
        <SurfaceCard accent={colors.teal}>
          <View style={styles.adminHeader}>
            <View>
              <Text style={styles.cardTitle}>لوحة النشر</Text>
              {adminRole && <Text style={styles.footerText}>{adminRole === 'owner' ? 'مسؤول القناة' : 'أدمن القناة'}</Text>}
            </View>
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

      <View style={styles.footer}>
        <Text style={styles.footerText}>لا يُسمح إلا لمعرّف Firebase المسجّل كمسؤول بإرسال الرسائل</Text>
        <Ionicons name="checkmark-circle" size={14} color="#2f80ed" />
      </View>
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
    adminEntry: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.paper, paddingVertical: spacing.sm },
    adminEntryText: { ...typography.label, color: colors.tealDark, fontSize: 12 },
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
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: spacing.lg },
    footerText: { ...typography.body, color: colors.inkMuted, fontSize: 12 },
  });
}
