import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
  hasChannelAdminAccess,
  listChannelPosts,
  loginChannelAdmin,
  logoutChannelAdmin,
  publishChannelPost,
  reactToChannelPost,
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
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminRole, setAdminRole] = useState<ChannelAdminRole | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
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
    if (!body) return;
    try {
      await publishChannelPost(body);
      setNewPost('');
      await load();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'invalid_admin_password' || code === 'channel_admin_password_not_configured') {
        await logoutChannelAdmin().catch(() => undefined);
        setLoggedIn(false);
        setAdminRole(null);
      }
      showAppError('تعذر النشر', code === 'invalid_admin_password'
        ? 'انتهت صلاحية كلمة المرور على الخادم. أدخل كلمة المرور الحالية مرة أخرى.'
        : 'تحقق من اتصال الإنترنت وإعداد كلمة المرور على الخادم ثم حاول مجددًا.');
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

      {!loggedIn && (
        <SurfaceCard accent={colors.teal}>
          <Text style={styles.cardTitle}>دخول المسؤول</Text>
          <TextInput
            value={adminPassword}
            onChangeText={setAdminPassword}
            placeholder="كلمة المرور المؤقتة"
            placeholderTextColor={colors.inkFaint}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={256}
            returnKeyType="go"
            onSubmitEditing={() => { void enterAdmin(); }}
            style={styles.input}
          />
          <ActionButton onPress={enterAdmin}>{adminBusy ? 'جارٍ التحقق…' : 'فتح لوحة النشر'}</ActionButton>
        </SurfaceCard>
      )}

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
        <Text style={styles.footerText}>لا يُسمح بالنشر إلا بكلمة المرور المهيأة على الخادم</Text>
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
