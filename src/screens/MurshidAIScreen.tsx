import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { RuqaaText as Text, RuqaaTextInput as TextInput } from '../components/RuqaaText';
import { SurfaceCard } from '../components/SurfaceCard';
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
const API_BASE_URL = typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_BASE_URL : undefined;

export function MurshidAIScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
        Alert.alert('الاتصال ناجح', `استلم مُرشد ردًا من Backend: ${reply.content.slice(0, 120)}`);
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

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}>
      <View style={styles.brandIcon}><Ionicons name="sparkles" size={22} color={colors.paper} /></View>
      <View style={styles.headerCopy}><Text style={styles.title}>مُرشد AI</Text><Text style={styles.subtitle}>{API_BASE_URL ? 'محادثة عبر الخدمة الآمنة' : config ? `متصل عبر ${config.providerName}` : 'أضف مفتاح مزودك للبدء'}</Text></View>
      <ActionButton tone="quiet" onPress={() => setSettingsOpen((value) => !value)}><Ionicons name="settings-outline" size={22} color={colors.inkMuted} /></ActionButton>
      <ActionButton tone="quiet" onPress={clearHistory}><Ionicons name="trash-outline" size={20} color={colors.inkMuted} /></ActionButton>
    </View>

    {settingsOpen && <ScrollView style={styles.settingsScroll} keyboardShouldPersistTaps="handled">
      <SurfaceCard>
        <Text style={styles.cardTitle}>إعداد الاتصال</Text>
        {API_BASE_URL ? <>
          <Text style={styles.notice}>هذا الإصدار يستخدم Backend مُرشد الآمن. مفتاح المزود يُضبط على الخادم ولا يلزم وضعه هنا.</Text>
          <View style={styles.backendTest}><ActionButton tone="quiet" onPress={testing ? undefined : testConnection}>{testing ? 'جارٍ الاختبار…' : 'اختبار اتصال Backend'}</ActionButton></View>
          {testing && <ActivityIndicator color={colors.tealDark} />}
        </> : <>
          <Text style={styles.label}>اختر مزود الخدمة</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
            {AI_PROVIDER_PRESETS.map((preset) => <ActionButton key={preset.id} tone={providerId === preset.id ? 'primary' : 'quiet'} onPress={() => selectPreset(preset.id)}>{preset.name}</ActionButton>)}
          </ScrollView>
          <Text style={styles.label}>مفتاح API {config?.apiKey ? '(مخزن؛ اترك الحقل فارغًا للإبقاء عليه)' : ''}</Text>
          <TextInput value={apiKey} onChangeText={setApiKey} placeholder="الصق المفتاح هنا" placeholderTextColor={colors.inkFaint} secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.input} />
          <Text style={styles.label}>عنوان API (Base URL)</Text>
          <TextInput value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
          <Text style={styles.label}>اسم النموذج</Text>
          <TextInput value={model} onChangeText={setModel} autoCapitalize="none" autoCorrect={false} style={styles.input} />
          <View style={styles.buttonRow}>
            <View style={styles.flexButton}><ActionButton onPress={saveConfig}>حفظ آمن</ActionButton></View>
            <View style={styles.flexButton}><ActionButton tone="quiet" onPress={testing ? undefined : testConnection}>{testing ? 'جارٍ الاختبار…' : 'اختبار الاتصال'}</ActionButton></View>
          </View>
          {testing && <ActivityIndicator color={colors.tealDark} />}
          {config && <ActionButton tone="quiet" onPress={removeKey}>حذف المفتاح المخزن</ActionButton>}
          <Text style={styles.privacy}>يُحفظ المفتاح عبر SecureStore على الجهاز ولا يُدرج في سجل المحادثة. يرسله التطبيق مباشرة إلى المزود عند استخدام BYOK. لا تشارك المفتاح مع أحد.</Text>
        </>}
      </SurfaceCard>
    </ScrollView>}

    <ScrollView ref={listRef} style={styles.messages} contentContainerStyle={styles.messageList} keyboardShouldPersistTaps="handled" onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}>
      {messages.length === 0 && <View style={styles.emptyState}><View style={styles.emptyIcon}><Ionicons name="chatbubble-ellipses-outline" size={34} color={colors.tealDark} /></View><Text style={styles.emptyTitle}>كيف أساعدك اليوم؟</Text><Text style={styles.emptyBody}>اسأل عن تنظيم يومك أو التخطيط أو أي فكرة تريد تطويرها. تحقّق من المعلومات المهمة ولا ترسل بيانات حساسة.</Text></View>}
      {messages.map((message) => <View key={message.id} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}><Text style={[styles.bubbleText, message.role === 'user' && styles.userBubbleText]}>{message.content}</Text></View>)}
      {busy && <View style={styles.thinking}><ActivityIndicator size="small" color={colors.tealDark} /><Text style={styles.thinkingText}>مُرشد يكتب…</Text></View>}
    </ScrollView>

    <View style={styles.composer}>
      <ActionButton tone="quiet" onPress={() => setIncludeMemory((value) => !value)}><Ionicons name={includeMemory ? 'bookmark' : 'bookmark-outline'} size={20} color={includeMemory ? colors.tealDark : colors.inkFaint} /><Text style={styles.memoryToggle}>{includeMemory ? 'الذاكرة مفعّلة' : 'استخدام الذاكرة'}</Text></ActionButton>
      <View style={styles.inputRow}><TextInput value={draft} onChangeText={setDraft} placeholder="اكتب رسالتك…" placeholderTextColor={colors.inkFaint} multiline maxLength={4000} editable={!busy} style={styles.composerInput} onSubmitEditing={send} /><ActionButton onPress={busy || !draft.trim() ? undefined : send}><Ionicons name="arrow-up" size={21} color={colors.paper} /></ActionButton></View>
      <Text style={styles.footer}>راجع الإجابات المهمة. لا ترسل كلمات مرور أو معلومات حساسة.</Text>
    </View>
  </KeyboardAvoidingView>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface },
    header: { minHeight: 72, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper },
    brandIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
    headerCopy: { flex: 1 }, title: { ...typography.h2, color: colors.ink }, subtitle: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 2 },
    settingsScroll: { maxHeight: '55%', paddingHorizontal: spacing.md, paddingTop: spacing.sm }, cardTitle: { ...typography.h2, color: colors.ink, marginBottom: spacing.sm }, notice: { ...typography.body, color: colors.inkMuted, lineHeight: 22 }, label: { ...typography.label, color: colors.ink, marginTop: spacing.sm, marginBottom: 5 }, presets: { gap: spacing.xs, paddingVertical: spacing.xs }, input: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing.sm, color: colors.ink, textAlign: 'left', writingDirection: 'ltr', backgroundColor: colors.paper }, buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }, flexButton: { flex: 1 }, backendTest: { marginTop: spacing.md }, privacy: { ...typography.body, color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: spacing.md },
    messages: { flex: 1 }, messageList: { padding: spacing.md, paddingBottom: spacing.lg, flexGrow: 1, justifyContent: 'flex-end', gap: spacing.sm }, emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl }, emptyIcon: { width: 68, height: 68, borderRadius: 24, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }, emptyTitle: { ...typography.h2, color: colors.ink }, emptyBody: { ...typography.body, color: colors.inkMuted, textAlign: 'center', lineHeight: 23, marginTop: spacing.sm }, bubble: { maxWidth: '88%', borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, userBubble: { alignSelf: 'flex-end', backgroundColor: colors.tealDark, borderBottomRightRadius: 5 }, assistantBubble: { alignSelf: 'flex-start', backgroundColor: colors.paper, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.line }, bubbleText: { ...typography.body, color: colors.ink, lineHeight: 23 }, userBubbleText: { color: colors.paper }, thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', padding: spacing.sm }, thinkingText: { ...typography.body, color: colors.inkMuted, fontSize: 12 },
    composer: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper }, memoryToggle: { ...typography.label, color: colors.inkMuted, marginLeft: 6 }, inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs }, composerInput: { flex: 1, maxHeight: 110, minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.ink, textAlign: 'right', backgroundColor: colors.surface }, footer: { ...typography.body, color: colors.inkFaint, fontSize: 10, textAlign: 'center', marginTop: spacing.xs },
  });
}
