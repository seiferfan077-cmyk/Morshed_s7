import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { RootTabParamList } from '../navigation/AppNavigator';
import { colors, radii, spacing, typography } from '../theme';
import { makeBridgeDeliveryScript, WEB_SPEECH_BRIDGE_VERSION, WEB_SPEECH_INJECTED_SCRIPT } from '../services/speech/webSpeechBridge';
import { SPEECH_TEST_HTML } from '../services/speech/speechTestHtml';

const HOME_URL = 'https://www.google.com';
const SEARCH_URL = 'https://www.google.com/search?q=';
const HANZAKR_URL = 'https://haneenstudy-tu9hntzp.manus.space/';
const MAX_UTTERANCE_LENGTH = 10_000;

type Voice = Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>>[number];
type BridgeMessage = { bridge?: string; type?: string; id?: string; text?: string; lang?: string; voiceURI?: string; rate?: number; pitch?: number; volume?: number };

function resolveAddress(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return HOME_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return `${SEARCH_URL}${encodeURIComponent(trimmed)}`;
}

export function BrowserScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const webViewRef = useRef<WebView>(null);
  const [address, setAddress] = useState(HOME_URL);
  const [draft, setDraft] = useState(HOME_URL);
  const [navigationState, setNavigationState] = useState<WebViewNavigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  const addDiagnostic = useCallback((stage: string, detail?: string) => {
    const line = `${new Date().toLocaleTimeString()} · ${stage}${detail ? ` · ${detail}` : ''}`;
    setDiagnostics((current) => [...current.slice(-19), line]);
  }, []);

  const deliver = useCallback((message: unknown) => {
    webViewRef.current?.injectJavaScript(makeBridgeDeliveryScript({ bridge: `murshid.webSpeech.v1`, ...((message || {}) as object) }));
  }, []);

  const handleSpeechMessage = useCallback(async (event: WebViewMessageEvent) => {
    let message: BridgeMessage;
    try { message = JSON.parse(event.nativeEvent.data) as BridgeMessage; } catch { return; }
    if (message.bridge !== `murshid.webSpeech.v1`) return;
    if (message.type === 'ready') { addDiagnostic('Web Speech API detected', `bridge ${WEB_SPEECH_BRIDGE_VERSION}`); addDiagnostic('speechSynthesis initialized'); return; }
    if (message.type === 'getVoices') {
      addDiagnostic('getVoices()');
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        addDiagnostic('Selected voice', voices[0]?.name || 'Android default');
        deliver({ type: 'voices', voices: voices.map((voice, index) => ({ voiceURI: voice.identifier, identifier: voice.identifier, name: voice.name, lang: voice.language, language: voice.language, isDefault: index === 0 })) });
      } catch (error) { addDiagnostic('Error', `getVoices: ${String(error)}`); deliver({ type: 'voices', voices: [] }); }
      return;
    }
    if (message.type === 'cancel') {
      addDiagnostic('cancel() received');
      await Speech.stop();
      return;
    }
    if (message.type !== 'speak' || !message.id) return;
    const text = String(message.text || '').slice(0, MAX_UTTERANCE_LENGTH);
    if (!text) return;
    addDiagnostic('speak() received', `${text.length} chars · ${message.lang || 'device language'}`);
    addDiagnostic('Bridge received', message.id);
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const selected = message.voiceURI ? voices.find((voice) => voice.identifier === message.voiceURI) : undefined;
      if (selected) addDiagnostic('Selected voice', `${selected.name} · ${selected.language}`);
      Speech.speak(text, {
        language: message.lang || undefined,
        voice: selected?.identifier,
        rate: typeof message.rate === 'number' ? Math.min(4, Math.max(0.1, message.rate)) : 1,
        pitch: typeof message.pitch === 'number' ? Math.min(2, Math.max(0.5, message.pitch)) : 1,
        volume: typeof message.volume === 'number' ? Math.min(1, Math.max(0, message.volume)) : 1,
        onStart: () => { addDiagnostic('Native TTS started', message.id); addDiagnostic('Audio started'); deliver({ type: 'event', id: message.id, event: 'start' }); },
        onBoundary: ({ charIndex, charLength }: { charIndex: number; charLength: number }) => { addDiagnostic('boundary events', `${charIndex}`); deliver({ type: 'event', id: message.id, event: 'boundary', charIndex, charLength }); },
        onDone: () => { addDiagnostic('Audio ended', message.id); deliver({ type: 'event', id: message.id, event: 'end' }); },
        onStopped: () => { addDiagnostic('Audio ended', `${message.id} stopped`); deliver({ type: 'event', id: message.id, event: 'stopped' }); },
        onError: (error) => { addDiagnostic('Error', `Native TTS: ${error.message}`); deliver({ type: 'event', id: message.id, event: 'error', error: error.message }); },
      });
    } catch (error) { addDiagnostic('Error', `speak: ${String(error)}`); deliver({ type: 'event', id: message.id, event: 'error', error: String(error) }); }
  }, [addDiagnostic, deliver]);

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ tabBarStyle: { display: 'none' } });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [navigation]));

  const submitAddress = () => { const nextUrl = resolveAddress(draft); setDraft(nextUrl); setAddress(nextUrl); setTestMode(false); Keyboard.dismiss(); };
  const goHome = () => { setDraft(HOME_URL); setAddress(HOME_URL); setTestMode(false); };
  const openHanzakr = () => { setDraft(HANZAKR_URL); setAddress(HANZAKR_URL); setTestMode(false); setShowControls(false); };
  const openSpeechTest = () => { setTestMode(true); setShowControls(false); setShowDiagnostics(true); addDiagnostic('Diagnostics test page opened'); };

  return <View style={styles.screen}>
    <WebView ref={webViewRef} style={styles.webView} source={testMode ? { html: SPEECH_TEST_HTML, baseUrl: 'https://murshid.local/' } : { uri: address }} onMessage={handleSpeechMessage} onNavigationStateChange={(state) => { setNavigationState(state); if (!testMode) setDraft(state.url); }} onLoadStart={() => setLoading(true)} onLoadEnd={() => setLoading(false)} onError={(event) => { setLoading(false); addDiagnostic('Error', `WebView: ${event.nativeEvent.description}`); }} javaScriptEnabled domStorageEnabled setSupportMultipleWindows={false} allowsBackForwardNavigationGestures={false} scalesPageToFit={false} injectedJavaScriptBeforeContentLoaded={`${WEB_SPEECH_INJECTED_SCRIPT}\n${INJECTED_KIOSK_SCRIPT}`} originWhitelist={['http://*', 'https://*']} startInLoadingState />
    <Pressable accessibilityLabel="إظهار أدوات المتصفح" onPress={() => setShowControls((visible) => !visible)} style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}><Ionicons name={showControls ? 'close' : 'ellipsis-horizontal'} size={20} color={colors.paper} /></Pressable>
    {loading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator size="small" color={colors.tealDark} /><Text style={styles.loadingText}>جارٍ التحميل</Text></View> : null}
    {showDiagnostics ? <View style={styles.diagnostics}><View style={styles.diagnosticHeader}><Text style={styles.diagnosticTitle}>تشخيص Hanzakro Voice</Text><Pressable onPress={() => setShowDiagnostics(false)}><Ionicons name="close" size={18} color={colors.inkMuted} /></Pressable></View><Text style={styles.diagnosticHint}>المسار: Web Page → Bridge → Android TTS → Audio Output</Text>{diagnostics.slice(-8).map((line, index) => <Text key={`${line}-${index}`} style={styles.diagnosticLine}>{line}</Text>)}</View> : null}
    {showControls ? <View style={styles.controls}><View style={styles.controlTitle}><Text style={styles.controlEyebrow}>FULLSCREEN BROWSER</Text><Pressable onPress={() => setShowControls(false)}><Ionicons name="close-circle-outline" size={21} color={colors.inkMuted} /></Pressable></View><View style={styles.addressBar}><Pressable accessibilityLabel="رجوع" disabled={!navigationState?.canGoBack} onPress={() => webViewRef.current?.goBack()} style={styles.navButton}><Ionicons name="chevron-back" size={20} color={navigationState?.canGoBack ? colors.ink : colors.inkFaint} /></Pressable><Pressable accessibilityLabel="تقدم" disabled={!navigationState?.canGoForward} onPress={() => webViewRef.current?.goForward()} style={styles.navButton}><Ionicons name="chevron-forward" size={20} color={navigationState?.canGoForward ? colors.ink : colors.inkFaint} /></Pressable><TextInput accessibilityLabel="العنوان أو البحث" value={testMode ? 'صفحة اختبار Web Speech' : draft} onChangeText={setDraft} onSubmitEditing={submitAddress} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" style={styles.input} placeholder="اكتب عنوانًا أو ابحث" placeholderTextColor={colors.inkFaint} /><Pressable accessibilityLabel="تحديث الصفحة" onPress={() => webViewRef.current?.reload()} style={styles.navButton}><Ionicons name="refresh-outline" size={19} color={colors.inkMuted} /></Pressable></View><View style={styles.actions}><Pressable onPress={openSpeechTest} style={styles.action}><Ionicons name="mic-outline" size={17} color={colors.tealDark} /><Text style={styles.actionText}>اختبار الصوت</Text></Pressable><Pressable onPress={() => setShowDiagnostics((visible) => !visible)} style={styles.action}><Ionicons name="pulse-outline" size={17} color={colors.tealDark} /><Text style={styles.actionText}>التشخيص</Text></Pressable><Pressable onPress={openHanzakr} style={styles.action}><Ionicons name="school-outline" size={17} color={colors.tealDark} /><Text style={styles.actionText}>ادخل هنذاكره</Text></Pressable><Pressable onPress={goHome} style={styles.action}><Ionicons name="home-outline" size={17} color={colors.ink} /><Text style={styles.actionText}>الرئيسية</Text></Pressable><Pressable onPress={() => navigation.navigate('الرئيسية')} style={styles.action}><Ionicons name="exit-outline" size={17} color={colors.ink} /><Text style={styles.actionText}>إنهاء</Text></Pressable></View></View> : null}
  </View>;
}

const INJECTED_KIOSK_SCRIPT = `(function(){try{var m=document.querySelector('meta[name="viewport"]');if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}m.content='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';var s=document.createElement('style');s.innerHTML='html,body{overscroll-behavior:none;} body{-webkit-user-select:none;user-select:none;} input,textarea,select,[contenteditable="true"]{-webkit-user-select:text;user-select:text;}';document.head.appendChild(s);}catch(e){}})();true;`;
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#000' }, webView: { flex: 1, backgroundColor: '#000' }, menuButton: { position: 'absolute', top: 48, right: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(16,33,43,0.78)', alignItems: 'center', justifyContent: 'center' }, loading: { position: 'absolute', top: 54, alignSelf: 'center', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.paper, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radii.pill, shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, loadingText: { ...typography.label, color: colors.inkMuted }, diagnostics: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: 90, maxHeight: 220, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: 'rgba(16,33,43,0.94)' }, diagnosticHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, diagnosticTitle: { ...typography.label, color: '#d9fff8' }, diagnosticHint: { ...typography.label, color: '#9ecfc6', fontSize: 10, marginTop: 4 }, diagnosticLine: { color: '#d9fff8', fontSize: 10, marginTop: 3 }, controls: { position: 'absolute', top: 44, left: spacing.md, right: spacing.md, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface, shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 7 }, controlTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xs, paddingBottom: spacing.xs }, controlEyebrow: { ...typography.label, color: colors.tealDark, fontSize: 10, letterSpacing: 1 }, addressBar: { minHeight: 46, borderRadius: radii.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }, navButton: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center' }, input: { flex: 1, ...typography.body, color: colors.ink, paddingHorizontal: spacing.xs, paddingVertical: 0 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, paddingTop: spacing.sm, flexWrap: 'wrap' }, action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.paper }, actionText: { ...typography.label, color: colors.ink, fontSize: 11 }, pressed: { opacity: 0.65 } });
