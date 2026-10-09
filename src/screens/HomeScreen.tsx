import { useAppTheme } from '../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { SurfaceCard } from '../components/SurfaceCard';
import { RootTabParamList } from '../navigation/AppNavigator';
import { radii, spacing, typography, ThemeColors } from '../theme';

type QuickTarget = 'Browser' | 'Media' | 'Files';
const ANNOUNCEMENT_TEXT = 'عزيزي مستخدم مُرشد،\n\nيرجى زيارة موقعنا الإلكتروني لمعرفة آخر التحديثات. ويسعدنا إبلاغكم بأن مُرشد سيحصل على تحديث Pro للمكالمات خلال الفترة من 25 إلى 3 من الشهر القادم. عند توفر النسخة على موقعنا، سنعلن عنها هنا مباشرة داخل التطبيق.\n\nشكرًا لثقتكم ودعمكم.';

export function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const onOpen = (screen: QuickTarget) => { const routes: Record<QuickTarget, keyof RootTabParamList> = { Browser: 'المتصفح', Media: 'المعرض', Files: 'المعرض' }; navigation.navigate(routes[screen]); };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.brandRow}><View><Text style={styles.kicker}>مُرشد · S7</Text><Text style={styles.title}>كل ما تحتاجه،<Text style={styles.titleAccent}> في مكان واحد.</Text></Text></View><View style={styles.avatar}><Text style={styles.avatarText}>م</Text></View></View>
    <Text style={styles.greeting}>أهلًا بك. اختر نقطة البداية اليوم.</Text>
    <AnnouncementCard />
    <SurfaceCard accent={colors.teal}><View style={styles.heroTop}><View><Text style={styles.heroLabel}>الوصول السريع</Text><Text style={styles.heroTitle}>تصفح بتركيز</Text><Text style={styles.heroBody}>افتح المواقع والأدوات التي تحتاجها داخل مساحة هادئة.</Text></View><View style={styles.heroIcon}><Ionicons name="compass-outline" size={30} color={colors.tealDark} /></View></View><ActionButton onPress={() => onOpen('Browser')}>فتح المتصفح</ActionButton></SurfaceCard>
    <Text style={styles.sectionTitle}>الأدوات الأساسية</Text>
    <View style={styles.grid}><Tool title="المعرض" detail="صور وفيديو" icon="images-outline" color={colors.coralSoft} iconColor={colors.coral} onPress={() => onOpen('Media')} /><Tool title="الملفات" detail="مساحة منظمة" icon="folder-open-outline" color={colors.blueSoft} iconColor={colors.blue} onPress={() => onOpen('Files')} /></View>
    <SurfaceCard accent={colors.amber}><View style={styles.featureRow}><View style={styles.featureIcon}><Ionicons name="sparkles-outline" size={22} color={colors.amber} /></View><View style={styles.featureCopy}><Text style={styles.featureTitle}>قسم المميزات</Text><Text style={styles.featureDetail}>قريبًا سيتوفر قسم المميزات.</Text></View></View></SurfaceCard>
    <Text style={styles.sectionTitle}>ملخص المساحة</Text><SurfaceCard><View style={styles.storageRow}><View style={styles.storageIcon}><Ionicons name="cloud-outline" size={20} color={colors.tealDark} /></View><View style={styles.storageText}><Text style={styles.storageTitle}>التخزين المحلي</Text><Text style={styles.storageDetail}>جاهز لإضافة ملفاتك في المرحلة التالية</Text></View><Text style={styles.storageValue}>0%</Text></View><View style={styles.progress}><View style={styles.progressFill} /></View></SurfaceCard>
  </ScrollView>;
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
    <View style={styles.proRow}><View style={styles.proIcon}><Ionicons name="call-outline" size={19} color={colors.paper} /></View><View style={styles.proCopy}><Text style={styles.proEyebrow}>إعلان قادم</Text><Text style={styles.proTitle}>مُرشد Pro للمكالمات</Text></View><Ionicons name="sparkles" size={18} color={colors.amber} /></View>
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
    announcementCard: { backgroundColor: colors.ink, borderRadius: 24, padding: spacing.lg, marginBottom: spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: '#294953', shadowColor: '#0d2730', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 }, announcementGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#145c61', opacity: 0.5, right: -80, top: -90 }, announcementHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, announcementBrand: { flexDirection: 'row', alignItems: 'center' }, announcementIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }, announcementIconText: { color: colors.paper, fontSize: 20, fontWeight: '800' }, announcementBrandName: { ...typography.h2, color: colors.paper, fontSize: 18 }, verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, announcementBrandCaption: { ...typography.body, color: '#a8d9d1', fontSize: 11, marginTop: 1 }, verifiedBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#2f80ed', alignItems: 'center', justifyContent: 'center' }, pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#d8f5ee', borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 5 }, pinnedText: { ...typography.label, color: colors.tealDark, fontSize: 11 }, announcementRule: { height: 1, backgroundColor: '#31545b', marginVertical: spacing.md }, proRow: { flexDirection: 'row', alignItems: 'center' }, proIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }, proCopy: { flex: 1 }, proEyebrow: { ...typography.label, color: '#8be0d2', fontSize: 10 }, proTitle: { ...typography.h2, color: colors.paper, fontSize: 19, marginTop: 2 }, announcementText: { ...typography.body, color: '#e5f5f1', lineHeight: 23, textAlign: 'right', writingDirection: 'rtl', marginTop: spacing.md, minHeight: 170 }, typingCursor: { color: '#75e0d0' }, announcementFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: '#31545b' }, announcementFooterText: { ...typography.label, color: '#9adbd1', fontSize: 11, flex: 1 },
    heroTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }, heroLabel: { ...typography.label, color: colors.tealDark }, heroTitle: { ...typography.h2, color: colors.ink, marginTop: 4 }, heroBody: { ...typography.body, color: colors.inkMuted, maxWidth: 230, marginTop: 4 }, heroIcon: { marginLeft: 'auto', width: 58, height: 58, borderRadius: 20, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' }, sectionTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.sm }, grid: { flexDirection: 'row', gap: spacing.sm }, toolInner: { alignItems: 'flex-start', width: 88 }, toolIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }, toolTitle: { ...typography.label, color: colors.ink }, toolDetail: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 2 }, featureRow: { flexDirection: 'row', alignItems: 'center' }, featureIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.amberSoft, alignItems: 'center', justifyContent: 'center' }, featureCopy: { flex: 1, marginLeft: spacing.sm }, featureTitle: { ...typography.label, color: colors.ink }, featureDetail: { ...typography.body, color: colors.inkMuted, marginTop: 3 }, storageRow: { flexDirection: 'row', alignItems: 'center' }, storageIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' }, storageText: { flex: 1, marginLeft: spacing.sm }, storageTitle: { ...typography.label, color: colors.ink }, storageDetail: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 2 }, storageValue: { ...typography.h2, color: colors.tealDark }, progress: { height: 8, borderRadius: radii.pill, backgroundColor: colors.tealSoft, marginTop: spacing.md, overflow: 'hidden' }, progressFill: { width: '4%', height: '100%', backgroundColor: colors.teal, borderRadius: radii.pill }
  });
}
