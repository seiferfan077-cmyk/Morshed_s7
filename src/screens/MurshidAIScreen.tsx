import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ActionButton } from '../components/ActionButton';
import { RuqaaText as Text, RuqaaTextInput as TextInput } from '../components/RuqaaText';
import { BackendAIProvider, AIMessage, AIProvider, AIRequestContext, selectAIProvider } from '../services/ai/aiService';
import { createUserKeyProvider, providerErrorMessage } from '../services/ai/byokAIService';
import { AI_PROVIDER_PRESETS, clearUserAIConfig, getPreset, getUserAIConfig, saveUserAIConfig, UserAIConfig } from '../services/ai/userAIConfig';
import { getFirebaseAIIdToken } from '../services/firebase/firebaseAuthService';
import { localMemoryProvider } from '../services/memory/memoryService';
import { MemoryContextItem } from '../types/memory';
import { ThemeColors, radii, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

type ChatMessage = AIMessage & { id: string; createdAt: number };
const HISTORY_KEY = '@murshid/ai-chat-history';
const MAX_HISTORY = 12;
const DEFAULT_API_BASE_URL = 'https://murshid-ai-backend.murshid-s7.workers.dev';
const API_BASE_URL = typeof process !== 'undefined'
  ? process.env?.EXPO_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
  : DEFAULT_API_BASE_URL;
const GREETING_TITLE = 'ابدأ محادثتك مع مُرشد';
const GREETING_SUBTITLE = 'ابدأ محادثتك الآن. ما الذي تفكر به؟ سنساعدك';

export function MurshidAIScreen() {
  const { colors: themeColors, mode } = useAppTheme();
  const colors = useMemo(() => ({
    ...themeColors,
    surface: '#080B0F',
    paper: '#11171D',
    line: '#26313A',
    ink: '#F3F5F4',
    inkMuted: '#A9B5BC',
    inkFaint: '#71808A',
    tealDark: '#56D8C9',
    tealSoft: '#15312F',
  }), [themeColors]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isFocused = useIsFocused();
  const listRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [config, setConfig] = useState<UserAIConfig | null>(null);
  const [providerId, setProviderId] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(getPreset('openai').baseUrl);
  const [model, setModel] = useState(getPreset('openai').model);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [includeMemory, setIncludeMemory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [typedTitle, setTypedTitle] = useState('');
  const [typedSubtitle, setTypedSubtitle] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([getUserAIConfig(), AsyncStorage.getItem(HISTORY_KEY)]).then(([stored, rawHistory]) => {
      if (!mounted) return;
      if (stored) {
        setConfig(stored);
        setProviderId(stored.providerId);
        setBaseUrl(stored.baseUrl);
        setModel(stored.model);
      }
      if (rawHistory) {
        try {
          const parsed = JSON.parse(rawHistory) as ChatMessage[];
          if (Array.isArray(parsed)) setMessages(parsed.filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string').slice(-MAX_HISTORY));
        } catch { /* Ignore a corrupt local cache. */ }
      }
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!isFocused) return undefined;
    let titleIndex = 0;
    let subtitleIndex = 0;
    let typingTimer: ReturnType<typeof setInterval> | undefined;
    const resetTimer = setTimeout(() => {
      setTypedTitle('');
      setTypedSubtitle('');
      typingTimer = setInterval(() => {
        if (titleIndex < GREETING_TITLE.length) {
          titleIndex += 1;
          setTypedTitle(GREETING_TITLE.slice(0, titleIndex));
        } else if (subtitleIndex < GREETING_SUBTITLE.length) {
          subtitleIndex += 1;
          setTypedSubtitle(GREETING_SUBTITLE.slice(0, subtitleIndex));
        } else if (typingTimer) {
          clearInterval(typingTimer);
        }
      }, 32);
    }, 0);
    return () => {
      clearTimeout(resetTimer);
      if (typingTimer) clearInterval(typingTimer);
    };
  }, [isFocused]);

  const selectPreset = (id: string) => {
    const preset = getPreset(id);
    setProviderId(preset.id);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
  };

  const saveConfig = async () => {
    const preset = getPreset(providerId);
    const key = apiKey.trim() || config?.apiKey || '';
    if (!key) { Alert.alert('مفتاح API مطلوب', 'أدخل المفتاح الصادر من مزود الذكاء الاصطناعي.'); return; }
    if (!/^https?:\/\//i.test(baseUrl.trim()) || !model.trim()) { Alert.alert('إعداد غير مكتمل', 'تحقق من Base URL واسم النموذج.'); return; }
    const next: UserAIConfig = { providerId: preset.id, providerName: preset.name, kind: preset.kind, apiKey: key, baseUrl: baseUrl.trim(), model: model.trim(), apiUrl: preset.apiUrl };
    try {
      await saveUserAIConfig(next);
      setConfig(next);
      setApiKey('');
      Alert.alert('تم الحفظ', 'حُفظ المفتاح على هذا الجهاز داخل التخزين الآمن.');
    } catch {
      Alert.alert('تعذر الحفظ', 'لم يتمكن الجهاز من حفظ المفتاح بأمان.');
    }
  };

  const activeProvider = useCallback((candidate = config): AIProvider | null => {
    const fallback = candidate ? createUserKeyProvider(candidate) : null;
    const backendUrl = API_BASE_URL?.trim();
    const tokenProvider = backendUrl ? getFirebaseAIIdToken : undefined;
    return selectAIProvider(backendUrl, tokenProvider, fallback);
  }, [config]);

  const requestContext = useCallback(async (query: string): Promise<AIRequestContext> => {
    if (!includeMemory) return {};
    const memories = await localMemoryProvider.retrieve(query, 5);
    const safeMemories: MemoryContextItem[] = memories.filter((item) => item.sensitivity === 'normal' && item.consent === 'accepted').map(({ id, type, content, importance, tags }) => ({ id, type, content, importance, tags }));
    return { memory: safeMemories };
  }, [includeMemory]);

  const testConnection = async () => {
    if (API_BASE_URL?.trim()) {
      setTesting(true);
      try {
        const reply = await new BackendAIProvider(API_BASE_URL, getFirebaseAIIdToken).sendMessage([{ role: 'user', content: 'أجب بكلمة: متصل' }]);
        Alert.alert('الاتصال ناجح', `استلم مُرشد ردًا من الخدمة الآمنة: ${reply.content.slice(0, 120)}`);
      } catch (error) {
        Alert.alert('فشل اختبار الاتصال', providerErrorMessage(error));
      } finally { setTesting(false); }
      return;
    }
    const preset = getPreset(providerId);
    const key = apiKey.trim() || config?.apiKey || '';
    if (!key) { Alert.alert('مفتاح API مطلوب', 'أدخل المفتاح ثم اختبر الاتصال.'); return; }
    const candidate: UserAIConfig = { providerId: preset.id, providerName: preset.name, kind: preset.kind, apiKey: key, baseUrl: baseUrl.trim(), model: model.trim(), apiUrl: preset.apiUrl };
    setTesting(true);
    try {
      const reply = await createUserKeyProvider(candidate).sendMessage([{ role: 'user', content: 'أجب بكلمة: متصل' }]);
      if (reply.content.trim()) {
        await saveUserAIConfig(candidate);
        setConfig(candidate);
        setApiKey('');
        Alert.alert('الاتصال ناجح', `استلم مُرشد ردًا من ${preset.name} عبر النموذج ${candidate.model}.`);
      } else Alert.alert('لم يصل رد', 'تم الاتصال لكن لم يصل نص من النموذج.');
    } catch (error) {
      Alert.alert('فشل اختبار الاتصال', providerErrorMessage(error));
    } finally { setTesting(false); }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || busy) return;
    const provider = activeProvider();
    if (!provider) { setSettingsOpen(true); Alert.alert('إعداد مُرشد', 'أضف مفتاح API أو أعد إعداد Backend قبل بدء المحادثة.'); return; }
    const userMessage: ChatMessage = { id: `${Date.now()}-u`, role: 'user', content, createdAt: Date.now() };
    const next = [...messages, userMessage].slice(-MAX_HISTORY);
    setMessages(next);
    setDraft('');
    setBusy(true);
    try {
      const context = await requestContext(content);
      const history: AIMessage[] = next.map(({ role, content: text }) => ({ role, content: text }));
      const reply = await provider.sendMessage(history, undefined, context);
      const completed = [...next, { id: `${Date.now()}-a`, role: 'assistant' as const, content: reply.content, createdAt: Date.now() }].slice(-MAX_HISTORY);
      setMessages(completed);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(completed));
    } catch (error) {
      setMessages(next);
      Alert.alert('تعذر استلام الرد', providerErrorMessage(error));
    } finally { setBusy(false); }
  };

  const clearHistory = () => Alert.alert('مسح المحادثة؟', 'سيُحذف سجل المحادثة المحفوظ محليًا على هذا الجهاز.', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'مسح', style: 'destructive', onPress: () => { setMessages([]); void AsyncStorage.removeItem(HISTORY_KEY); } },
  ]);

  const removeKey = () => Alert.alert('حذف مفتاح API؟', 'سيُحذف المفتاح المخزن على هذا الجهاز فقط.', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف المفتاح', style: 'destructive', onPress: async () => { await clearUserAIConfig(); setConfig(null); setApiKey(''); setSettingsOpen(true); } },
  ]);

  return <>
    <StatusBar style={isFocused ? 'light' : mode === 'dark' ? 'light' : 'dark'} />
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.header}>
      <View style={styles.brandIcon}><Ionicons name="sparkles" size={22} color={colors.tealDark} /></View>
      <View style={styles.headerCopy}><Text style={styles.title}>مُرشد</Text><Text style={styles.subtitle}>{API_BASE_URL ? 'مساعدك الذكي' : config ? `متصل عبر ${config.providerName}` : 'أضف مفتاح مزودك للبدء'}</Text></View>
      <ActionButton tone="quiet" buttonStyle={styles.headerAction} labelStyle={styles.headerActionText} onPress={() => setSettingsOpen((value) => !value)}><Ionicons name="settings-outline" size={22} color={colors.inkMuted} /></ActionButton>
      <ActionButton tone="quiet" buttonStyle={styles.headerAction} labelStyle={styles.headerActionText} onPress={clearHistory}><Ionicons name="trash-outline" size={20} color={colors.inkMuted} /></ActionButton>
    </View>

    <View style={styles.greetingPanel}>
      <View style={styles.greetingIcon}><Ionicons name="chatbubble-ellipses" size={22} color={colors.tealDark} /></View>
      <View style={styles.greetingCopy}>
        <Text style={styles.greetingTitle}>{typedTitle}{typedTitle.length < GREETING_TITLE.length ? <Text style={styles.typingCursor}>▍</Text> : null}</Text>
        <Text style={styles.greetingSubtitle}>{typedSubtitle}{typedTitle.length === GREETING_TITLE.length && typedSubtitle.length < GREETING_SUBTITLE.length ? <Text style={styles.typingCursor}>▍</Text> : null}</Text>
      </View>
    </View>

    {settingsOpen && <ScrollView style={styles.settingsScroll} keyboardShouldPersistTaps="handled">
      <View style={styles.settingsCard}>
        <Text style={styles.cardTitle}>إعداد الاتصال</Text>
        {API_BASE_URL ? <>
          <Text style={styles.notice}>يتصل التطبيق بخدمة مُرشد الآمنة. مفتاح الذكاء الاصطناعي مضبوط على الخادم ولا يلزم إدخاله هنا.</Text>
          <View style={styles.backendTest}><ActionButton tone="quiet" buttonStyle={styles.quietAction} labelStyle={styles.quietActionText} onPress={testing ? undefined : testConnection}>{testing ? 'جارٍ الاختبار…' : 'اختبار الاتصال'}</ActionButton></View>
          {testing && <ActivityIndicator color={colors.tealDark} />}
        </> : <>
          <Text style={styles.label}>اختر مزود الخدمة</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
            {AI_PROVIDER_PRESETS.map((preset) => <ActionButton key={preset.id} tone={providerId === preset.id ? 'primary' : 'quiet'} buttonStyle={providerId === preset.id ? styles.primaryAction : styles.quietAction} labelStyle={providerId === preset.id ? styles.primaryActionText : styles.quietActionText} onPress={() => selectPreset(preset.id)}>{preset.name}</ActionButton>)}
          </ScrollView>
          <Text style={styles.label}>مفتاح API {config?.apiKey ? '(مخزن؛ اترك الحقل فارغًا للإبقاء عليه)' : ''}</Text>
          <TextInput value={apiKey} onChangeText={setApiKey} placeholder="الصق المفتاح هنا" placeholderTextColor={colors.inkFaint} secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.input} />
          <Text style={styles.label}>عنوان API (Base URL)</Text>
          <TextInput value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
          <Text style={styles.label}>اسم النموذج</Text>
          <TextInput value={model} onChangeText={setModel} autoCapitalize="none" autoCorrect={false} style={styles.input} />
          <View style={styles.buttonRow}>
            <View style={styles.flexButton}><ActionButton buttonStyle={styles.primaryAction} labelStyle={styles.primaryActionText} onPress={saveConfig}>حفظ آمن</ActionButton></View>
            <View style={styles.flexButton}><ActionButton tone="quiet" buttonStyle={styles.quietAction} labelStyle={styles.quietActionText} onPress={testing ? undefined : testConnection}>{testing ? 'جارٍ الاختبار…' : 'اختبار الاتصال'}</ActionButton></View>
          </View>
          {testing && <ActivityIndicator color={colors.tealDark} />}
          {config && <ActionButton tone="quiet" buttonStyle={styles.quietAction} labelStyle={styles.quietActionText} onPress={removeKey}>حذف المفتاح المخزن</ActionButton>}
          <Text style={styles.privacy}>يُحفظ المفتاح عبر SecureStore على الجهاز ولا يُدرج في سجل المحادثة. يرسله التطبيق مباشرة إلى المزود عند استخدام BYOK. لا تشارك المفتاح مع أحد.</Text>
        </>}
      </View>
    </ScrollView>}

    <ScrollView ref={listRef} style={styles.messages} contentContainerStyle={styles.messageList} keyboardShouldPersistTaps="handled" onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}>
      {messages.length === 0 && <View style={styles.emptyState}><View style={styles.emptyIcon}><Ionicons name="sparkles-outline" size={28} color={colors.tealDark} /></View><Text style={styles.emptyBody}>اكتب رسالتك في الأسفل، وسيظهر رد مُرشد هنا.</Text></View>}
      {messages.map((message) => <View key={message.id} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}><Text style={[styles.bubbleText, message.role === 'user' && styles.userBubbleText]}>{message.content}</Text></View>)}
      {busy && <View style={styles.thinking}><ActivityIndicator size="small" color={colors.tealDark} /><Text style={styles.thinkingText}>مُرشد يكتب…</Text></View>}
    </ScrollView>

    <View style={styles.composer}>
      <ActionButton tone="quiet" buttonStyle={styles.memoryAction} labelStyle={styles.memoryActionText} onPress={() => setIncludeMemory((value) => !value)}><Ionicons name={includeMemory ? 'bookmark' : 'bookmark-outline'} size={20} color={includeMemory ? colors.tealDark : colors.inkFaint} /><Text style={styles.memoryToggle}>{includeMemory ? 'الذاكرة مفعّلة' : 'استخدام الذاكرة'}</Text></ActionButton>
      <View style={styles.inputRow}><TextInput value={draft} onChangeText={setDraft} placeholder="اكتب رسالتك…" placeholderTextColor={colors.inkFaint} multiline maxLength={4000} editable={!busy} style={styles.composerInput} submitBehavior="submit" returnKeyType="send" onSubmitEditing={send} /><ActionButton buttonStyle={styles.sendAction} labelStyle={styles.sendActionText} onPress={busy || !draft.trim() ? undefined : send}><Ionicons name="arrow-up" size={21} color="#07110F" /></ActionButton></View>
      <Text style={styles.footer}>راجع الإجابات المهمة. لا ترسل كلمات مرور أو معلومات حساسة.</Text>
    </View>
    </KeyboardAvoidingView>
  </>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface },
    header: { minHeight: 72, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
    brandIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, borderWidth: 1, borderColor: colors.line },
    headerCopy: { flex: 1 }, title: { ...typography.h2, color: colors.ink }, subtitle: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 2 },
    headerAction: { minHeight: 42, paddingHorizontal: 9, marginLeft: 5, borderRadius: radii.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, headerActionText: { color: colors.inkMuted },
    greetingPanel: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm, padding: spacing.md, minHeight: 100, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
    greetingIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, backgroundColor: colors.tealSoft },
    greetingCopy: { flex: 1, minHeight: 66, justifyContent: 'center' }, greetingTitle: { ...typography.h2, color: colors.ink, fontSize: 17, lineHeight: 26, textAlign: 'right', writingDirection: 'rtl' }, greetingSubtitle: { ...typography.body, color: colors.inkMuted, fontSize: 13, lineHeight: 21, marginTop: 3, textAlign: 'right', writingDirection: 'rtl' }, typingCursor: { color: colors.tealDark },
    settingsScroll: { maxHeight: '48%', paddingHorizontal: spacing.md, paddingTop: spacing.xs }, settingsCard: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.line }, cardTitle: { ...typography.h2, color: colors.ink, marginBottom: spacing.sm }, notice: { ...typography.body, color: colors.inkMuted, lineHeight: 22 }, label: { ...typography.label, color: colors.ink, marginTop: spacing.sm, marginBottom: 5 }, presets: { gap: spacing.xs, paddingVertical: spacing.xs }, input: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing.sm, color: colors.ink, textAlign: 'left', writingDirection: 'ltr', backgroundColor: colors.surface }, buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }, flexButton: { flex: 1 }, backendTest: { marginTop: spacing.md }, privacy: { ...typography.body, color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: spacing.md },
    primaryAction: { backgroundColor: colors.tealDark }, primaryActionText: { color: '#07110F' }, quietAction: { backgroundColor: '#172228', borderColor: colors.line, borderWidth: 1 }, quietActionText: { color: '#C0CDD2' },
    messages: { flex: 1 }, messageList: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, flexGrow: 1, justifyContent: 'flex-end', gap: spacing.sm }, emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl }, emptyIcon: { width: 58, height: 58, borderRadius: 21, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }, emptyBody: { ...typography.body, color: colors.inkMuted, textAlign: 'center', lineHeight: 23, marginTop: spacing.xs }, bubble: { maxWidth: '88%', borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, userBubble: { alignSelf: 'flex-end', backgroundColor: colors.tealDark, borderBottomRightRadius: 5 }, assistantBubble: { alignSelf: 'flex-start', backgroundColor: colors.paper, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.line }, bubbleText: { ...typography.body, color: colors.ink, lineHeight: 23, textAlign: 'right', writingDirection: 'rtl' }, userBubbleText: { color: '#07110F' }, thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', padding: spacing.sm }, thinkingText: { ...typography.body, color: colors.inkMuted, fontSize: 12 },
    composer: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper }, memoryAction: { minHeight: 34, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, borderRadius: radii.md, backgroundColor: '#172228', borderWidth: 1, borderColor: colors.line }, memoryActionText: { color: colors.inkMuted }, memoryToggle: { ...typography.label, color: colors.inkMuted, marginLeft: 6 }, inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs }, composerInput: { flex: 1, maxHeight: 110, minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.ink, textAlign: 'right', backgroundColor: colors.surface }, sendAction: { minHeight: 48, width: 48, paddingHorizontal: 0, borderRadius: 24, backgroundColor: colors.tealDark }, sendActionText: { color: '#07110F' }, footer: { ...typography.body, color: colors.inkFaint, fontSize: 10, textAlign: 'center', marginTop: spacing.xs },
  });
}
