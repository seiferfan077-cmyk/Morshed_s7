import { useAppTheme } from '../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { showAppError } from '../components/AppDialogProvider';
import { SurfaceCard } from '../components/SurfaceCard';
import { useIdTokenAuthRequest } from 'expo-auth-session/providers/google';
import { User } from 'firebase/auth';
import { signInWithGoogleIdToken, signOutFirebaseUser, subscribeToFirebaseUser } from '../services/firebase/firebaseAuthService';
import { MURSHID_FEATURES_URL, SupportWebsiteModal } from './SupportWebsiteModal';
import { RootTabParamList } from '../navigation/AppNavigator';
import { radii, spacing, typography, ThemeColors } from '../theme';

type QuickTarget = 'Browser' | 'Media' | 'Files' | 'Channel';
const ANNOUNCEMENT_TEXT = 'عزيزي مستخدم مُرشد،\n\nمُرشد المتكامل يجمع لك المساعد الذكي، ومكتبة الوسائط، والرسائل، والمتصفح، والميزات اليومية في تطبيق واحد. تابع موقعنا الإلكتروني لمعرفة آخر التحديثات والمميزات الجديدة.\n\nشكرًا لثقتكم ودعمكم.';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID ?? '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_CLIENT_ID_FALLBACK = 'google-oauth-not-configured.apps.googleusercontent.com';

export function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const [websiteVisible, setWebsiteVisible] = useState(false);
  const onOpen = (screen: QuickTarget) => { const routes: Record<QuickTarget, keyof RootTabParamList> = { Browser: 'المتصفح', Media: 'المعرض', Files: 'المعرض', Channel: 'القناة الرسمية' }; navigation.navigate(routes[screen]); };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
    <View style={styles.websitePinnedArea}>
      <SurfaceCard accent={colors.teal}>
        <View style={styles.websiteHeading}>
          <View style={styles.websiteIcon}><Ionicons name="globe-outline" size={19} color={colors.tealDark} /></View>
          <View style={styles.websiteCopy}>
            <Text style={styles.websiteTitle}>موقع مُرشد الإلكتروني</Text>
            <Text style={styles.websiteDetail}>اكتشف المميزات وآخر التحديثات</Text>
          </View>
          <View style={styles.websitePinnedBadge}><Ionicons name="pin" size={13} color={colors.tealDark} /><Text style={styles.websitePinnedText}>مثبت</Text></View>
        </View>
        <ActionButton onPress={() => setWebsiteVisible(true)}>افتح الموقع الإلكتروني الآن</ActionButton>
      </SurfaceCard>
    </View>
    <GoogleAccountCard />
    <View style={styles.brandRow}><View><Text style={styles.kicker}>MURSHID · S7</Text><Text style={styles.title}>كل ما تحتاجه،<Text style={styles.titleAccent}> في مكان واحد.</Text></Text></View><View style={styles.avatar}><Text style={styles.avatarText}>م</Text></View></View>
    <Text style={styles.greeting}>أهلًا بك. اختر نقطة البداية اليوم.</Text>
    <AnnouncementCard />
    <SurfaceCard accent={colors.teal}><View style={styles.heroTop}><View><Text style={styles.heroLabel}>القناة الرسمية</Text><Text style={styles.heroTitle}>أخبار مُرشد</Text><Text style={styles.heroBody}>تابع المنشورات والتحديثات الرسمية من داخل التطبيق.</Text></View><View style={styles.heroIcon}><Ionicons name="megaphone-outline" size={28} color={colors.tealDark} /></View></View><ActionButton onPress={() => onOpen('Channel')}>فتح القناة</ActionButton></SurfaceCard>
    <SurfaceCard accent={colors.teal}><View style={styles.heroTop}><View><Text style={styles.heroLabel}>الوصول السريع</Text><Text style={styles.heroTitle}>تصفح بتركيز</Text><Text style={styles.heroBody}>افتح المواقع والأدوات التي تحتاجها داخل مساحة هادئة.</Text></View><View style={styles.heroIcon}><Ionicons name="compass-outline" size={30} color={colors.tealDark} /></View></View><ActionButton onPress={() => onOpen('Browser')}>فتح المتصفح</ActionButton></SurfaceCard>
    <Text style={styles.sectionTitle}>الأدوات الأساسية</Text>
    <View style={styles.grid}><Tool title="المعرض" detail="صور وفيديو" icon="images-outline" color={colors.coralSoft} iconColor={colors.coral} onPress={() => onOpen('Media')} /><Tool title="الملفات" detail="مساحة منظمة" icon="folder-open-outline" color={colors.blueSoft} iconColor={colors.blue} onPress={() => onOpen('Files')} /></View>
    <SurfaceCard accent={colors.amber}><View style={styles.featureRow}><View style={styles.featureIcon}><Ionicons name="sparkles-outline" size={22} color={colors.amber} /></View><View style={styles.featureCopy}><Text style={styles.featureTitle}>قسم المميزات</Text><Text style={styles.featureDetail}>اقرأ القرآن الكريم دون اتصال من تبويب المميزات.</Text></View></View></SurfaceCard>
    <Text style={styles.sectionTitle}>ملخص المساحة</Text><SurfaceCard><View style={styles.storageRow}><View style={styles.storageIcon}><Ionicons name="cloud-outline" size={20} color={colors.tealDark} /></View><View style={styles.storageText}><Text style={styles.storageTitle}>التخزين المحلي</Text><Text style={styles.storageDetail}>جاهز لإضافة ملفاتك في المرحلة التالية</Text></View><Text style={styles.storageValue}>0%</Text></View><View style={styles.progress}><View style={styles.progressFill} /></View></SurfaceCard>
    <SupportWebsiteModal visible={websiteVisible} onClose={() => setWebsiteVisible(false)} url={MURSHID_FEATURES_URL} title="موقع مُرشد الإلكتروني" />
  </ScrollView>;
}

function GoogleAccountCard() {
  const { colors } = useAppTheme();
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [request, , promptAsync] = useIdTokenAuthRequest({
    clientId: Platform.OS === 'android' ? GOOGLE_ANDROID_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK : Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK : GOOGLE_WEB_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK,
    webClientId: GOOGLE_WEB_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK,
    iosClientId: GOOGLE_IOS_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK,
    selectAccount: true,
  }, { scheme: 'murshid' });
  const hasPlatformClientId = Platform.OS === 'android'
    ? Boolean(GOOGLE_ANDROID_CLIENT_ID)
    : Platform.OS === 'ios'
      ? Boolean(GOOGLE_IOS_CLIENT_ID)
      : Boolean(GOOGLE_WEB_CLIENT_ID);
  const signedInUser = user && !user.isAnonymous ? user : null;

  useEffect(() => subscribeToFirebaseUser(setUser), []);

  const signIn = async () => {
    if (!hasPlatformClientId) {
      showAppError('تسجيل الدخول بحساب Google غير جاهز', 'يلزم ضبط معرّف OAuth الخاص بنظام هاتفك، وتفعيل Google في مصادقة Firebase. بعد ضبطهما هيظهر اختيار الحساب هنا.');
      return;
    }
    if (!request || busy) return;
    setBusy(true);
    try {
      const result = await promptAsync();
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      if (result.type !== 'success') throw result.type === 'error' ? result.error ?? new Error('google_oauth_failed') : new Error('google_oauth_incomplete');
      const idToken = result.authentication?.idToken ?? result.params.id_token;
      if (!idToken) throw new Error('google_id_token_missing');
      await signInWithGoogleIdToken(idToken);
    } catch {
      showAppError('تعذر تسجيل الدخول', 'تأكد من تفعيل Google في Firebase ومن صحة إعداد OAuth لهذا التطبيق، ثم حاول مرة تانية.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try {
      await signOutFirebaseUser();
    } catch {
      showAppError('تعذر تسجيل الخروج', 'حاول تسجيل الخروج مرة تانية.');
    }
  };

  return <SurfaceCard accent={signedInUser ? colors.teal : colors.blue}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
      <View style={{ width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={signedInUser ? 'person-circle-outline' : 'logo-google'} size={24} color={colors.tealDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.h2, color: colors.ink }}>{signedInUser ? `أهلًا، ${signedInUser.displayName || 'بيك'}` : 'حسابك في مُرشد'}</Text>
        <Text style={{ ...typography.body, color: colors.inkMuted, marginTop: 2 }}>{signedInUser?.email || 'سجّل دخولك بحساب Google واحفظ هويتك على أجهزتك.'}</Text>
      </View>
    </View>
    {signedInUser
      ? <ActionButton tone="quiet" onPress={() => { void signOut(); }}>تسجيل الخروج</ActionButton>
      : <ActionButton onPress={() => { void signIn(); }}>
        <Ionicons name="logo-google" size={17} color={colors.paper} />{'  '}{busy ? 'جارٍ فتح تسجيل الدخول…' : 'تسجيل الدخول بحساب Google'}
      </ActionButton>}
  </SurfaceCard>;
}

function AnnouncementCard() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [displayedText, setDisplayedText] = useState('');
  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setDisplayedText(ANNOUNCEMENT_TEXT.slice(0, index));
      if (index >= ANNOUNCEMENT_TEXT.length) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, []);
  return <View style={styles.announcementCard}>
    <View style={styles.announcementGlow} />
    <View style={styles.announcementHeader}>
      <View style={styles.announcementBrand}>
        <View style={styles.announcementIcon}><Text style={styles.announcementIconText}>م</Text></View>
        <View><Text style={styles.announcementBrandName}>مُرشد</Text><View style={styles.verifiedRow}><Text style={styles.announcementBrandCaption}>فريق مطوري مُرشد</Text><View style={styles.verifiedBadge}><Ionicons name="checkmark" size={10} color={colors.paper} /></View></View></View>
      </View>
      <View style={styles.pinnedBadge}><Ionicons name="pin" size={12} color={colors.tealDark} /><Text style={styles.pinnedText}>مثبت</Text></View>
    </View>
    <View style={styles.announcementRule} />
    <View style={styles.proRow}><View style={styles.proIcon}><Ionicons name="apps-outline" size={21} color={colors.paper} /></View><View style={styles.proCopy}><Text style={styles.proEyebrow}>التجربة المتكاملة</Text><Text style={styles.proTitle}>مُرشد المتكامل</Text></View><Ionicons name="sparkles" size={18} color={colors.amber} /></View>
    <Text style={styles.announcementText}>{displayedText}<Text style={styles.typingCursor}>▌</Text></Text>
    <View style={styles.announcementFooter}><Ionicons name="globe-outline" size={15} color="#9adbd1" /><Text style={styles.announcementFooterText}>تابع الموقع الإلكتروني لمعرفة موعد التوفر</Text></View>
  </View>;
}

function Tool({ title, detail, icon, color, iconColor, onPress }: { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; color: string; iconColor: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return <SurfaceCard><ActionButton tone="quiet" onPress={onPress}><View style={styles.toolInner}><View style={[styles.toolIcon, { backgroundColor: color }]}><Ionicons name={icon} size={20} color={iconColor} /></View><View><Text style={styles.toolTitle}>{title}</Text><Text style={styles.toolDetail}>{detail}</Text></View></View></ActionButton></SurfaceCard>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface }, content: { padding: spacing.lg, paddingBottom: spacing.xxl }, brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: spacing.sm }, kicker: { ...typography.label, color: colors.tealDark, letterSpacing: 1.2 }, title: { ...typography.display, color: colors.ink, marginTop: spacing.xs }, titleAccent: { color: colors.teal }, greeting: { ...typography.body, color: colors.inkMuted, marginTop: spacing.sm, marginBottom: spacing.xl }, avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.paper, fontSize: 18, fontWeight: '800' },
    websitePinnedArea: { backgroundColor: colors.surface, paddingBottom: spacing.sm, zIndex: 1 }, websiteHeading: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: spacing.md }, websiteIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm }, websiteCopy: { flex: 1, alignItems: 'flex-end' }, websiteTitle: { ...typography.label, color: colors.ink }, websiteDetail: { ...typography.body, color: colors.inkMuted, fontSize: 11, marginTop: 2, textAlign: 'right' }, websitePinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.tealSoft, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 4 }, websitePinnedText: { ...typography.label, color: colors.tealDark, fontSize: 10 },
    announcementCard: { backgroundColor: colors.ink, borderRadius: 24, padding: spacing.lg, marginBottom: spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: '#294953', shadowColor: '#0d2730', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 }, announcementGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#145c61', opacity: 0.5, right: -80, top: -90 }, announcementHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, announcementBrand: { flexDirection: 'row', alignItems: 'center' }, announcementIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }, announcementIconText: { color: colors.paper, fontSize: 20, fontWeight: '800' }, announcementBrandName: { ...typography.h2, color: colors.paper, fontSize: 18 }, verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, announcementBrandCaption: { ...typography.body, color: '#a8d9d1', fontSize: 11, marginTop: 1 }, verifiedBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#2f80ed', alignItems: 'center', justifyContent: 'center' }, pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#d8f5ee', borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 5 }, pinnedText: { ...typography.label, color: colors.tealDark, fontSize: 11 }, announcementRule: { height: 1, backgroundColor: '#31545b', marginVertical: spacing.md }, proRow: { flexDirection: 'row', alignItems: 'center' }, proIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }, proCopy: { flex: 1 }, proEyebrow: { ...typography.label, color: '#8be0d2', fontSize: 10 }, proTitle: { ...typography.h2, color: colors.paper, fontSize: 19, marginTop: 2 }, announcementText: { ...typography.body, color: '#e5f5f1', lineHeight: 23, textAlign: 'right', writingDirection: 'rtl', marginTop: spacing.md, minHeight: 170 }, typingCursor: { color: '#75e0d0' }, announcementFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: '#31545b' }, announcementFooterText: { ...typography.label, color: '#9adbd1', fontSize: 11, flex: 1 },
    heroTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }, heroLabel: { ...typography.label, color: colors.tealDark }, heroTitle: { ...typography.h2, color: colors.ink, marginTop: 4 }, heroBody: { ...typography.body, color: colors.inkMuted, maxWidth: 230, marginTop: 4 }, heroIcon: { marginLeft: 'auto', width: 58, height: 58, borderRadius: 20, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' }, sectionTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.sm }, grid: { flexDirection: 'row', gap: spacing.sm }, toolInner: { alignItems: 'flex-start', width: 88 }, toolIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }, toolTitle: { ...typography.label, color: colors.ink }, toolDetail: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 2 }, featureRow: { flexDirection: 'row', alignItems: 'center' }, featureIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.amberSoft, alignItems: 'center', justifyContent: 'center' }, featureCopy: { flex: 1, marginLeft: spacing.sm }, featureTitle: { ...typography.label, color: colors.ink }, featureDetail: { ...typography.body, color: colors.inkMuted, marginTop: 3 }, storageRow: { flexDirection: 'row', alignItems: 'center' }, storageIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' }, storageText: { flex: 1, marginLeft: spacing.sm }, storageTitle: { ...typography.label, color: colors.ink }, storageDetail: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 2 }, storageValue: { ...typography.h2, color: colors.tealDark }, progress: { height: 8, borderRadius: radii.pill, backgroundColor: colors.tealSoft, marginTop: spacing.md, overflow: 'hidden' }, progressFill: { width: '4%', height: '100%', backgroundColor: colors.teal, borderRadius: radii.pill }
  });
}
