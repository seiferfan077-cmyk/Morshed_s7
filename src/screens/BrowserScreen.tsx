import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { colors, radii, spacing, typography } from '../theme';

const HOME_URL = 'https://www.google.com';
const SEARCH_URL = 'https://www.google.com/search?q=';

function resolveAddress(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return HOME_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return `${SEARCH_URL}${encodeURIComponent(trimmed)}`;
}

export function BrowserScreen() {
  const webViewRef = useRef<WebView>(null);
  const [address, setAddress] = useState(HOME_URL);
  const [draft, setDraft] = useState(HOME_URL);
  const [navigation, setNavigation] = useState<WebViewNavigation | null>(null);
  const [loading, setLoading] = useState(true);

  const submitAddress = () => {
    const nextUrl = resolveAddress(draft);
    setDraft(nextUrl);
    setAddress(nextUrl);
    Keyboard.dismiss();
  };

  const goHome = () => { setDraft(HOME_URL); setAddress(HOME_URL); };

  return <View style={styles.screen}>
    <View style={styles.topBar}>
      <View style={styles.titleRow}><View style={styles.mark}><Ionicons name="compass-outline" size={18} color={colors.paper} /></View><View><Text style={styles.eyebrow}>KIOSK BROWSER</Text><Text style={styles.title}>تصفح بتركيز</Text></View></View>
      <Pressable accessibilityLabel="العودة إلى الصفحة الرئيسية" onPress={goHome} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons name="home-outline" size={19} color={colors.ink} /></Pressable>
    </View>
    <View style={styles.addressBar}><Pressable accessibilityLabel="رجوع" disabled={!navigation?.canGoBack} onPress={() => webViewRef.current?.goBack()} style={styles.navButton}><Ionicons name="chevron-back" size={20} color={navigation?.canGoBack ? colors.ink : colors.inkFaint} /></Pressable><Pressable accessibilityLabel="تقدم" disabled={!navigation?.canGoForward} onPress={() => webViewRef.current?.goForward()} style={styles.navButton}><Ionicons name="chevron-forward" size={20} color={navigation?.canGoForward ? colors.ink : colors.inkFaint} /></Pressable><TextInput accessibilityLabel="العنوان أو البحث" value={draft} onChangeText={setDraft} onSubmitEditing={submitAddress} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" style={styles.input} placeholder="اكتب عنوانًا أو ابحث" placeholderTextColor={colors.inkFaint} /><Pressable accessibilityLabel="تحديث الصفحة" onPress={() => webViewRef.current?.reload()} style={styles.navButton}><Ionicons name="refresh-outline" size={19} color={colors.inkMuted} /></Pressable></View>
    <View style={styles.webFrame}><WebView ref={webViewRef} source={{ uri: address }} onNavigationStateChange={(state) => { setNavigation(state); setDraft(state.url); }} onLoadStart={() => setLoading(true)} onLoadEnd={() => setLoading(false)} onError={() => setLoading(false)} javaScriptEnabled domStorageEnabled setSupportMultipleWindows={false} allowsBackForwardNavigationGestures={false} scalesPageToFit={false} injectedJavaScriptBeforeContentLoaded={INJECTED_KIOSK_SCRIPT} originWhitelist={['http://*', 'https://*']} startInLoadingState />{loading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator size="small" color={colors.tealDark} /><Text style={styles.loadingText}>جارٍ التحميل</Text></View> : null}</View>
    <View style={styles.statusBar}><View style={[styles.statusDot, { backgroundColor: loading ? colors.amber : colors.teal }]} /><Text style={styles.statusText}>{loading ? 'يتم تحميل الصفحة' : 'جلسة التصفح جاهزة'}</Text><Text style={styles.urlHint} numberOfLines={1}>{navigation?.url ?? address}</Text></View>
  </View>;
}

const INJECTED_KIOSK_SCRIPT = `(function(){try{var m=document.querySelector('meta[name="viewport"]');if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}m.content='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';var s=document.createElement('style');s.innerHTML='html,body{overscroll-behavior:none;} body{-webkit-user-select:none;user-select:none;} input,textarea,select,[contenteditable="true"]{-webkit-user-select:text;user-select:text;}';document.head.appendChild(s);}catch(e){}})();true;`;

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.surface }, topBar: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, titleRow: { flexDirection: 'row', alignItems: 'center' }, mark: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }, eyebrow: { ...typography.label, color: colors.tealDark, fontSize: 10, letterSpacing: 1 }, title: { ...typography.h2, color: colors.ink, marginTop: 1 }, iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }, addressBar: { marginHorizontal: spacing.md, marginBottom: spacing.sm, minHeight: 48, borderRadius: radii.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }, navButton: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' }, input: { flex: 1, ...typography.body, color: colors.ink, paddingHorizontal: spacing.xs, paddingVertical: 0 }, webFrame: { flex: 1, marginHorizontal: spacing.md, overflow: 'hidden', borderRadius: radii.lg, backgroundColor: colors.paper }, loading: { position: 'absolute', top: 12, alignSelf: 'center', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.paper, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radii.pill, ...{ shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 } }, loadingText: { ...typography.label, color: colors.inkMuted }, statusBar: { minHeight: 40, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 7 }, statusDot: { width: 7, height: 7, borderRadius: 4 }, statusText: { ...typography.label, color: colors.inkMuted, fontSize: 10 }, urlHint: { flex: 1, ...typography.body, color: colors.inkFaint, fontSize: 10, textAlign: 'right' }, pressed: { opacity: 0.65 } });
