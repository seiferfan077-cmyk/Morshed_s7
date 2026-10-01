import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { RootTabParamList } from '../navigation/AppNavigator';
import { colors, radii, spacing, typography } from '../theme';

const HOME_URL = 'https://www.google.com';
const SEARCH_URL = 'https://www.google.com/search?q=';
const HANZAKR_URL = 'https://haneenstudy-tu9hntzp.manus.space/';

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

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ tabBarStyle: { display: 'none' } });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [navigation]));

  const submitAddress = () => {
    const nextUrl = resolveAddress(draft);
    setDraft(nextUrl);
    setAddress(nextUrl);
    Keyboard.dismiss();
  };

  const goHome = () => { setDraft(HOME_URL); setAddress(HOME_URL); };
  const openHanzakr = () => { setDraft(HANZAKR_URL); setAddress(HANZAKR_URL); setShowControls(false); };

  return <View style={styles.screen}>
    <WebView ref={webViewRef} style={styles.webView} source={{ uri: address }} onNavigationStateChange={(state) => { setNavigationState(state); setDraft(state.url); }} onLoadStart={() => setLoading(true)} onLoadEnd={() => setLoading(false)} onError={() => setLoading(false)} javaScriptEnabled domStorageEnabled setSupportMultipleWindows={false} allowsBackForwardNavigationGestures={false} scalesPageToFit={false} injectedJavaScriptBeforeContentLoaded={INJECTED_KIOSK_SCRIPT} originWhitelist={['http://*', 'https://*']} startInLoadingState />
    <Pressable accessibilityLabel="إظهار أدوات المتصفح" onPress={() => setShowControls((visible) => !visible)} style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}><Ionicons name={showControls ? 'close' : 'ellipsis-horizontal'} size={20} color={colors.paper} /></Pressable>
    {loading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator size="small" color={colors.tealDark} /><Text style={styles.loadingText}>جارٍ التحميل</Text></View> : null}
    {showControls ? <View style={styles.controls}>
      <View style={styles.controlTitle}><Text style={styles.controlEyebrow}>FULLSCREEN BROWSER</Text><Pressable onPress={() => setShowControls(false)}><Ionicons name="close-circle-outline" size={21} color={colors.inkMuted} /></Pressable></View>
      <View style={styles.addressBar}><Pressable accessibilityLabel="رجوع" disabled={!navigationState?.canGoBack} onPress={() => webViewRef.current?.goBack()} style={styles.navButton}><Ionicons name="chevron-back" size={20} color={navigationState?.canGoBack ? colors.ink : colors.inkFaint} /></Pressable><Pressable accessibilityLabel="تقدم" disabled={!navigationState?.canGoForward} onPress={() => webViewRef.current?.goForward()} style={styles.navButton}><Ionicons name="chevron-forward" size={20} color={navigationState?.canGoForward ? colors.ink : colors.inkFaint} /></Pressable><TextInput accessibilityLabel="العنوان أو البحث" value={draft} onChangeText={setDraft} onSubmitEditing={submitAddress} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" style={styles.input} placeholder="اكتب عنوانًا أو ابحث" placeholderTextColor={colors.inkFaint} /><Pressable accessibilityLabel="تحديث الصفحة" onPress={() => webViewRef.current?.reload()} style={styles.navButton}><Ionicons name="refresh-outline" size={19} color={colors.inkMuted} /></Pressable></View>
      <View style={styles.actions}><Pressable onPress={openHanzakr} style={styles.action}><Ionicons name="school-outline" size={17} color={colors.tealDark} /><Text style={styles.actionText}>ادخل هنذاكره</Text></Pressable><Pressable onPress={goHome} style={styles.action}><Ionicons name="home-outline" size={17} color={colors.ink} /><Text style={styles.actionText}>الرئيسية</Text></Pressable><Pressable onPress={() => navigation.navigate('الرئيسية')} style={styles.action}><Ionicons name="exit-outline" size={17} color={colors.ink} /><Text style={styles.actionText}>إنهاء ملء الشاشة</Text></Pressable></View>
    </View> : null}
  </View>;
}

const INJECTED_KIOSK_SCRIPT = `(function(){try{var m=document.querySelector('meta[name="viewport"]');if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}m.content='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';var s=document.createElement('style');s.innerHTML='html,body{overscroll-behavior:none;} body{-webkit-user-select:none;user-select:none;} input,textarea,select,[contenteditable="true"]{-webkit-user-select:text;user-select:text;}';document.head.appendChild(s);}catch(e){}})();true;`;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  webView: { flex: 1, backgroundColor: '#000' },
  menuButton: { position: 'absolute', top: 48, right: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(16,33,43,0.78)', alignItems: 'center', justifyContent: 'center' },
  loading: { position: 'absolute', top: 54, alignSelf: 'center', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.paper, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radii.pill, shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  loadingText: { ...typography.label, color: colors.inkMuted },
  controls: { position: 'absolute', top: 44, left: spacing.md, right: spacing.md, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface, shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  controlTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
  controlEyebrow: { ...typography.label, color: colors.tealDark, fontSize: 10, letterSpacing: 1 },
  addressBar: { minHeight: 46, borderRadius: radii.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  navButton: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, ...typography.body, color: colors.ink, paddingHorizontal: spacing.xs, paddingVertical: 0 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, paddingTop: spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.paper },
  actionText: { ...typography.label, color: colors.ink, fontSize: 11 },
  pressed: { opacity: 0.65 },
});
