import AsyncStorage from '@react-native-async-storage/async-storage';
import { RuqaaText as Text } from '../components/RuqaaText';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

const WELCOME_SEEN_KEY = '@murshid/welcome-seen';
const WELCOME_LINE = 'مُرشد — كل اللي هتحتاجه في مكان واحد';

export async function hasSeenWelcome() {
  return (await AsyncStorage.getItem(WELCOME_SEEN_KEY)) === 'true';
}

export function WelcomeScreen({ onComplete }: { onComplete: () => void }) {
  const [started, setStarted] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [finishing, setFinishing] = useState(false);
  const reveal = useRef(new Animated.Value(0)).current;
  const buttonReveal = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(reveal, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(buttonReveal, { toValue: 1, duration: 900, delay: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [buttonReveal, reveal]);

  useEffect(() => {
    if (!started) return;
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setTypedText(WELCOME_LINE.slice(0, index));
      if (index >= WELCOME_LINE.length) {
        clearInterval(timer);
        setTimeout(() => {
          setFinishing(true);
          Animated.timing(exit, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(async ({ finished }) => {
            if (!finished) return;
            await AsyncStorage.setItem(WELCOME_SEEN_KEY, 'true');
            onComplete();
          });
        }, 650);
      }
    }, 58);
    return () => clearInterval(timer);
  }, [exit, onComplete, started]);

  const begin = () => {
    if (!started) {
      setStarted(true);
      setTypedText('');
    }
  };

  return <Animated.View style={[styles.screen, { opacity: exit }]}>
    <View style={styles.glowOne} />
    <View style={styles.glowTwo} />
    <Animated.View style={[styles.content, { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
      <View style={styles.brandMark}><Text style={styles.brandLetter}>م</Text></View>
      <Text style={styles.kicker}>مُرشد · S7</Text>
      <View style={styles.lineWrap}><Text style={styles.typeLine}>{started ? typedText : ' '}</Text>{started && !finishing ? <Text style={styles.cursor}>▍</Text> : null}</View>
      <Text style={styles.subline}>{started ? 'لحظة ونكون جاهزين لك.' : 'مساحتك الهادئة للوصول، التصفح، والتنظيم.'}</Text>
    </Animated.View>
    {!started ? <Animated.View style={[styles.footer, { opacity: buttonReveal, transform: [{ translateY: buttonReveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}><Pressable accessibilityLabel="ابدأ استخدام مُرشد" onPress={begin} style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}><Text style={styles.startText}>ابدأ الآن</Text><Text style={styles.arrow}>←</Text></Pressable><Text style={styles.hint}>اضغط للبدء</Text></Animated.View> : <View style={styles.footer}><View style={styles.progressTrack}><Animated.View style={[styles.progressFill, { width: typedText.length ? `${Math.min(100, (typedText.length / WELCOME_LINE.length) * 100)}%` : '0%' }]} /></View></View>}
  </Animated.View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, overflow: 'hidden' },
  glowOne: { position: 'absolute', width: 330, height: 330, borderRadius: 165, backgroundColor: '#164A51', top: -120, right: -100, opacity: 0.7 },
  glowTwo: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#0E3A3B', bottom: -100, left: -100, opacity: 0.8 },
  content: { alignItems: 'center', width: '100%' },
  brandMark: { width: 78, height: 78, borderRadius: 28, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  brandLetter: { color: colors.paper, fontSize: 38, fontWeight: '800' },
  kicker: { ...typography.label, color: '#A6E8DE', letterSpacing: 1.6 },
  lineWrap: { minHeight: 54, marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', maxWidth: 340 },
  typeLine: { ...typography.h1, color: colors.paper, textAlign: 'center', fontSize: 23, lineHeight: 32 },
  cursor: { color: colors.teal, fontSize: 25, marginLeft: 2 },
  subline: { ...typography.body, color: '#B9C9CB', textAlign: 'center', marginTop: spacing.sm, maxWidth: 290 },
  footer: { position: 'absolute', bottom: 46, alignItems: 'center', width: '100%', paddingHorizontal: spacing.lg },
  startButton: { minWidth: 188, borderRadius: radii.pill, backgroundColor: colors.teal, paddingVertical: 14, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  startText: { ...typography.label, color: colors.ink, fontSize: 14 },
  arrow: { color: colors.ink, fontSize: 20, lineHeight: 20 },
  hint: { ...typography.label, color: '#91B8B7', marginTop: spacing.sm, fontSize: 10 },
  progressTrack: { width: '68%', height: 4, borderRadius: radii.pill, backgroundColor: '#315057', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.teal, borderRadius: radii.pill },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
