import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../theme';

const WELCOME_SEEN_KEY = '@murshid/welcome-seen';
type WelcomeStage = 'intro' | 'video';

export async function hasSeenWelcome() {
  return (await AsyncStorage.getItem(WELCOME_SEEN_KEY)) === 'true';
}

export function WelcomeScreen({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState<WelcomeStage>('intro');
  const [transitioning, setTransitioning] = useState(false);
  const [ambient] = useState(() => new Animated.Value(0));
  const [reveal] = useState(() => new Animated.Value(0));
  const [pageOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(ambient, { toValue: 1, duration: 3800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(ambient, { toValue: 0, duration: 3800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const entrance = Animated.timing(reveal, { toValue: 1, duration: 850, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    breathing.start();
    entrance.start();
    return () => {
      breathing.stop();
      entrance.stop();
    };
  }, [ambient, reveal]);

  const showVideoStage = () => {
    if (transitioning) return;
    setTransitioning(true);
    Animated.timing(pageOpacity, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setStage('video');
      pageOpacity.setValue(0);
      Animated.timing(pageOpacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setTransitioning(false));
    });
  };

  const finishWelcome = async () => {
    if (transitioning) return;
    setTransitioning(true);
    try {
      await AsyncStorage.setItem(WELCOME_SEEN_KEY, 'true');
    } catch {
      // The welcome must never prevent entry if local storage is unavailable.
    }
    onComplete();
  };

  const floatingScale = ambient.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.045] });
  const floatingShift = ambient.interpolate({ inputRange: [0, 1], outputRange: [5, -5] });
  const entranceY = reveal.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.screen}>
        <View pointerEvents="none" style={styles.backgroundGlowTop} />
        <View pointerEvents="none" style={styles.backgroundGlowBottom} />
        <View pointerEvents="none" style={styles.gridGlow} />

        <View style={styles.topBar}>
          <View style={styles.brandLockup}>
            <View style={styles.brandIconSmall}><Ionicons name="sparkles" size={15} color={colors.ink} /></View>
            <Text style={styles.brandName}>مُرشد</Text>
            <Text style={styles.brandVersion}>S7</Text>
          </View>
          <View style={styles.secureBadge}>
            <Ionicons name="shield-checkmark-outline" size={13} color="#9AE7DB" />
            <Text style={styles.secureText}>مساحتك الخاصة</Text>
          </View>
        </View>

        <Animated.View style={[styles.page, { opacity: pageOpacity }]}>
          {stage === 'intro' ? (
            <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
              <Animated.View style={[styles.introContent, { opacity: reveal, transform: [{ translateY: entranceY }] }]}>
                <View style={styles.heroArtwork}>
                  <Animated.View style={[styles.orbit, { transform: [{ scale: floatingScale }, { rotate: '18deg' }] }]} />
                  <Animated.View style={[styles.orbitInner, { transform: [{ scale: floatingScale }] }]} />
                  <Animated.View style={[styles.heroGlow, { transform: [{ translateY: floatingShift }, { scale: floatingScale }] }]} />
                  <View style={styles.heroLogo}>
                    <Ionicons name="sparkles" size={30} color={colors.ink} />
                    <View style={styles.logoDot} />
                  </View>
                  <View style={[styles.floatChip, styles.floatChipTop]}>
                    <Ionicons name="lock-closed-outline" size={14} color="#A8F0E5" />
                    <Text style={styles.floatChipText}>خصوصيتك أولاً</Text>
                  </View>
                  <View style={[styles.floatChip, styles.floatChipBottom]}>
                    <Ionicons name="leaf-outline" size={14} color="#FFE3A2" />
                    <Text style={styles.floatChipText}>على إيقاعك</Text>
                  </View>
                </View>

                <View style={styles.introCopy}>
                  <Text style={styles.eyebrow}>رفيقك الرقمي، بطريقتك</Text>
                  <Text style={styles.headline}>مساحة أهدأ.{ '\n' }يوم أوضح.</Text>
                  <Text style={styles.description}>
                    أدواتك ومساعدك وذكرياتك، في مكان واحد صُمّم ليكون قريباً منك.
                  </Text>
                </View>

                <View style={styles.featureRow}>
                  <Feature icon="chatbubble-ellipses-outline" label="مساعد يفهمك" />
                  <View style={styles.featureDivider} />
                  <Feature icon="albums-outline" label="كل شيء بمكانه" />
                  <View style={styles.featureDivider} />
                  <Feature icon="shield-checkmark-outline" label="خصوصية واضحة" />
                </View>
              </Animated.View>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={styles.videoScroll} showsVerticalScrollIndicator={false}>
              <Animated.View style={[styles.videoContent, { opacity: reveal, transform: [{ translateY: entranceY }] }]}>
                <View style={styles.videoHeading}>
                  <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>02</Text><View style={styles.stepBadgeLine} /><Text style={styles.stepCount}>من 02</Text></View>
                  <Text style={styles.videoTitle}>قبل أن نبدأ،{ '\n' }دعنا نعرّفك بمُرشد.</Text>
                  <Text style={styles.videoDescription}>سيكون هنا فيديو قصير يريك كيف تصنع مُرشد مساحتك اليومية.</Text>
                </View>

                <View style={styles.videoCard}>
                  <View style={styles.videoCardTop}>
                    <View style={styles.comingSoonBadge}><View style={styles.comingSoonDot} /><Text style={styles.comingSoonText}>قريباً</Text></View>
                    <Text style={styles.videoLabel}>جولة مُرشد</Text>
                  </View>
                  <View style={styles.videoArtwork}>
                    <Animated.View style={[styles.videoAura, { transform: [{ scale: floatingScale }] }]} />
                    <View style={styles.videoRing} />
                    <View style={styles.playButton}>
                      <Ionicons name="play" size={25} color={colors.ink} style={styles.playIcon} />
                    </View>
                    <View style={styles.videoBrandMark}><Ionicons name="sparkles" size={18} color="#A9F1E6" /><Text style={styles.videoBrandText}>مُرشد · S7</Text></View>
                  </View>
                  <View style={styles.videoCardFooter}>
                    <View style={styles.videoProgressTrack}><View style={styles.videoProgressStub} /></View>
                    <Text style={styles.videoDuration}>فيديو تعريفي</Text>
                  </View>
                </View>

                <View style={styles.videoNote}>
                  <View style={styles.noteIcon}><Ionicons name="link-outline" size={17} color="#9AE7DB" /></View>
                  <Text style={styles.noteText}>أرسل رابط الفيديو عندما يكون جاهزاً، وسأضعه هنا مكان هذه المعاينة.</Text>
                </View>
              </Animated.View>
            </ScrollView>
          )}
        </Animated.View>

        <View style={styles.footer}>
          {stage === 'intro' ? (
            <>
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, styles.stepDotActive]} /><View style={styles.stepLine} /><View style={styles.stepDot} />
                <Text style={styles.stepCaption}>خطوة واحدة لتبدأ</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="متابعة إلى فيديو التعريف" disabled={transitioning} onPress={showVideoStage} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
                <Text style={styles.primaryButtonText}>اكتشف مُرشد</Text>
                <Ionicons name="arrow-back" size={18} color={colors.ink} />
              </Pressable>
              <Text style={styles.footerHint}>تجربة بسيطة. مساحة تخصّك.</Text>
            </>
          ) : (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel="الدخول إلى التطبيق بدون مشاهدة الفيديو" disabled={transitioning} onPress={finishWelcome} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
                <Text style={styles.primaryButtonText}>دخول مُرشد</Text>
                <Ionicons name="arrow-back" size={18} color={colors.ink} />
              </Pressable>
              <Pressable accessibilityRole="button" disabled={transitioning} onPress={finishWelcome} hitSlop={12} style={styles.skipButton}>
                <Text style={styles.skipText}>أشاهده لاحقاً</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Feature({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return <View style={styles.feature}>
    <Ionicons name={icon} size={17} color="#9AE7DB" />
    <Text style={styles.featureLabel}>{label}</Text>
  </View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#08171D' },
  screen: { flex: 1, backgroundColor: '#08171D', overflow: 'hidden' },
  backgroundGlowTop: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: '#0D3C3E', top: -210, right: -100, opacity: 0.68 },
  backgroundGlowBottom: { position: 'absolute', width: 290, height: 290, borderRadius: 145, backgroundColor: '#103A3C', bottom: -215, left: -115, opacity: 0.48 },
  gridGlow: { position: 'absolute', width: 1, height: 420, backgroundColor: '#183238', top: 125, left: '16%', opacity: 0.26 },
  topBar: { minHeight: 56, paddingHorizontal: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandIconSmall: { width: 27, height: 27, borderRadius: 9, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  brandName: { ...typography.label, color: colors.paper, fontSize: 15 },
  brandVersion: { color: '#81969A', fontSize: 10, letterSpacing: 1.4, marginLeft: 1 },
  secureBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(154,231,219,0.08)', borderColor: 'rgba(154,231,219,0.14)', borderWidth: 1, borderRadius: radii.pill, paddingVertical: 6, paddingHorizontal: 10 },
  secureText: { color: '#B6DAD5', fontSize: 10 },
  page: { flex: 1 },
  introScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: spacing.md },
  introContent: { alignItems: 'center', width: '100%', maxWidth: 460, alignSelf: 'center' },
  heroArtwork: { width: '100%', height: 218, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  orbit: { position: 'absolute', width: 172, height: 172, borderRadius: 86, borderWidth: 1, borderColor: 'rgba(137,224,211,0.16)' },
  orbitInner: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 1, borderColor: 'rgba(137,224,211,0.1)' },
  heroGlow: { position: 'absolute', width: 104, height: 104, borderRadius: 52, backgroundColor: '#0B625D', opacity: 0.58 },
  heroLogo: { width: 82, height: 82, borderRadius: 28, backgroundColor: '#9AE7DB', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }], shadowColor: '#56D4C2', shadowOpacity: 0.25, shadowRadius: 25, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  logoDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF0B8', top: 13, right: 14 },
  floatChip: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(17,39,45,0.92)', borderColor: 'rgba(194,225,218,0.12)', borderWidth: 1, borderRadius: radii.pill, paddingVertical: 8, paddingHorizontal: 11 },
  floatChipTop: { top: 29, right: '7%' },
  floatChipBottom: { bottom: 24, left: '5%' },
  floatChipText: { color: '#D4E4E1', fontSize: 10 },
  introCopy: { alignItems: 'center', marginTop: 3 },
  eyebrow: { color: '#9AE7DB', fontSize: 12, letterSpacing: 0.5, marginBottom: 10 },
  headline: { ...typography.display, color: colors.paper, textAlign: 'center', fontSize: 38, lineHeight: 50, letterSpacing: -0.3 },
  description: { ...typography.body, color: '#A9BDBF', textAlign: 'center', maxWidth: 310, fontSize: 14, lineHeight: 23, marginTop: 10 },
  featureRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 25, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(191,223,217,0.1)' },
  feature: { alignItems: 'center', justifyContent: 'center', gap: 5, flex: 1 },
  featureLabel: { color: '#AFC4C1', fontSize: 9, textAlign: 'center' },
  featureDivider: { width: 1, height: 25, backgroundColor: 'rgba(191,223,217,0.1)' },
  videoScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  videoContent: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  videoHeading: { alignItems: 'flex-end', marginBottom: spacing.lg },
  stepBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  stepBadgeText: { color: '#9AE7DB', fontSize: 11, fontWeight: '700' },
  stepBadgeLine: { width: 28, height: 1, backgroundColor: 'rgba(154,231,219,0.35)' },
  stepCount: { color: '#71888D', fontSize: 10 },
  videoTitle: { ...typography.h1, color: colors.paper, textAlign: 'right', fontSize: 29, lineHeight: 40 },
  videoDescription: { ...typography.body, color: '#A9BDBF', textAlign: 'right', fontSize: 13, lineHeight: 21, marginTop: 8, maxWidth: 320 },
  videoCard: { width: '100%', alignSelf: 'center', maxWidth: 400, backgroundColor: '#10272D', borderColor: 'rgba(191,223,217,0.14)', borderWidth: 1, borderRadius: 24, overflow: 'hidden', padding: 13 },
  videoCardTop: { height: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  comingSoonBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(244,190,91,0.1)', borderRadius: radii.pill, paddingVertical: 4, paddingHorizontal: 8 },
  comingSoonDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#F4BE5B' },
  comingSoonText: { color: '#F4D69A', fontSize: 9 },
  videoLabel: { color: '#D9E6E3', fontSize: 11 },
  videoArtwork: { width: '100%', aspectRatio: 1.72, borderRadius: 16, backgroundColor: '#0A1A20', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  videoAura: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#0E554F', opacity: 0.45 },
  videoRing: { position: 'absolute', width: 124, height: 124, borderRadius: 62, borderWidth: 1, borderColor: 'rgba(154,231,219,0.18)' },
  playButton: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#9AE7DB', alignItems: 'center', justifyContent: 'center', paddingLeft: 3, shadowColor: '#64E2D0', shadowOpacity: 0.26, shadowRadius: 18, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  playIcon: { marginLeft: 2 },
  videoBrandMark: { position: 'absolute', bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  videoBrandText: { color: '#B7CDCA', fontSize: 10 },
  videoCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 11 },
  videoProgressTrack: { height: 3, flex: 1, borderRadius: 2, backgroundColor: '#294248', overflow: 'hidden', marginRight: 14 },
  videoProgressStub: { width: '13%', height: '100%', backgroundColor: '#65CDBC' },
  videoDuration: { color: '#809498', fontSize: 9 },
  videoNote: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 14, paddingHorizontal: 3 },
  noteIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: 'rgba(154,231,219,0.1)', alignItems: 'center', justifyContent: 'center' },
  noteText: { flex: 1, color: '#A9BDBF', fontSize: 11, lineHeight: 18, textAlign: 'right' },
  footer: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 12, alignItems: 'center' },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 13 },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3A5055' },
  stepDotActive: { width: 18, backgroundColor: '#9AE7DB' },
  stepLine: { width: 18, height: 1, backgroundColor: '#32494E' },
  stepCaption: { color: '#81969A', fontSize: 10, marginLeft: 3 },
  primaryButton: { width: '100%', maxWidth: 460, minHeight: 54, borderRadius: 18, backgroundColor: '#9AE7DB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryButtonText: { ...typography.label, color: '#0B2729', fontSize: 14 },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  footerHint: { color: '#70878B', fontSize: 10, marginTop: 11 },
  skipButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 16, marginTop: 5 },
  skipText: { color: '#9BAEAF', fontSize: 11 },
});
