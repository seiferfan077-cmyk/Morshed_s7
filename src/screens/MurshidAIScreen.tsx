import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { RuqaaText as Text, RuqaaTextInput as TextInput } from '../components/RuqaaText';
import { SurfaceCard } from '../components/SurfaceCard';
import { AIMessage, BackendAIProvider, AIRequestContext } from '../services/ai/aiService';
import { providerErrorMessage } from '../services/ai/byokAIService';
import { getFirebaseAIIdToken } from '../services/firebase/firebaseAuthService';
import { firebaseConfigStatus } from '../services/firebase/firebaseConfig';
import { localMemoryProvider } from '../services/memory/memoryService';
import { MemoryContextItem } from '../types/memory';
import { ThemeColors, radii, spacing, typography } from '../theme';

 type ChatMessage = AIMessage & { id: string; createdAt: number };
type ConnectionState = 'ready' | 'checking' | 'connected' | 'error';

const HISTORY_KEY = '@murshid/ai-chat-history';
const MAX_HISTORY = 12;
const DEFAULT_BACKEND_URL = 'https://murshid-ai-backend.murshid-s7.workers.dev';
const configuredBaseUrl = typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_BASE_URL?.trim() : undefined;
const API_BASE_URL = configuredBaseUrl && !configuredBaseUrl.includes('api.example.com') ? configuredBaseUrl : DEFAULT_BACKEND_URL;
const GREETING_TITLE = 'ابدأ محادثتك مع مرشد';
const GREETING_BODY = 'ابدأ محادثتك الآن. ما الذي تفكر به؟ سنساعدك';
const QUICK_PROMPTS = ['ساعدني أرتب يومي', 'عايز أفكر في هدف', 'اشرحلي فكرة ببساطة'];

const AI_COLORS: ThemeColors = {
  ink: '#F2F7F6',
  inkMuted: '#A8B7B9',
  inkFaint: '#75878B',
  surface: '#050708',
  paper: '#101719',
  line: '#263538',
  teal: '#45D8C4',
  tealDark: '#35CDB8',
  tealSoft: '#142E2B',
  coral: '#FF8B75',
  coralSoft: '#372321',
  amber: '#F1C36B',
  amberSoft: '#342C1D',
  blue: '#8DBAF0',
  blueSoft: '#202F42',
  danger: '#FF8181',
};

export function MurshidAIScreen() {
  const styles = useMemo(() => createStyles(AI_COLORS), []);
  const listRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [includeMemory, setIncludeMemory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('ready');
  const [sendError, setSendError] = useState<string | null>(null);
  const [failedDraft, setFailedDraft] = useState('');
  const [typedTitle, setTypedTitle] = useState('');
  const [typedBody, setTypedBody] = useState('');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(HISTORY_KEY).then((rawHistory) => {
      if (!mounted || !rawHistory) return;
      try {
        const parsed = JSON.parse(rawHistory) as ChatMessage[];
        if (Array.isArray(parsed)) {
          setMessages(parsed.filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string').slice(-MAX_HISTORY));
        }
      } catch { /* Ignore a corrupt local cache. */ }
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    let titleIndex = 0;
    let bodyIndex = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setTypedTitle('');
    setTypedBody('');

    const typeBody = () => {
      if (!active) return;
      bodyIndex += 1;
      setTypedBody(GREETING_BODY.slice(0, bodyIndex));
      if (bodyIndex < GREETING_BODY.length) timer = setTimeout(typeBody, 24);
    };
    const typeTitle = () => {
      if (!active) return;
      titleIndex += 1;
      setTypedTitle(GREETING_TITLE.slice(0, titleIndex));
      if (titleIndex < GREETING_TITLE.length) timer = setTimeout(typeTitle, 38);
      else timer = setTimeout(typeBody, 220);
    };

    timer = setTimeout(typeTitle, 120);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []));

  const requestContext = useCallback(async (query: string): Promise<AIRequestContext> => {
    if (!includeMemory) return {};
    const memories = await localMemoryProvider.retrieve(query, 5);
    const safeMemories: MemoryContextItem[] = memories
      .filter((item) => item.sensitivity === 'normal' && item.consent === 'accepted')
      .map(({ id, type, content, importance, tags }) => ({ id, type, content, importance, tags }));
    return { memory: safeMemories };
  }, [includeMemory]);

  const testConnection = async () => {
    setTesting(true);
    setConnectionState('checking');
    try {
      const reply = await new BackendAIProvider(API_BASE_URL, getFirebaseAIIdToken)
        .sendMessage([{ role: 'user', content: 'أجب بكلمة: متصل' }]);
      setConnectionState('connected');
      Alert.alert('الاتصال ناجح', `وصل رد من خدمة مرشد: ${reply.content.slice(0, 120)}`);
    } catch (error) {
      setConnectionState('error');
      Alert.alert('فشل اختبار الاتصال', providerErrorMessage(error));
    } finally {
      setTesting(false);
    }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || busy) return;

    const userMessage: ChatMessage = { id: `${Date.now()}-u`, role: 'user', content, createdAt: Date.now() };
    const next = [...messages, userMessage].slice(-MAX_HISTORY);
    setMessages(next);
    setDraft('');
    setBusy(true);
    setConnectionState('checking');
    setSendError(null);
    setFailedDraft('');
    void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => undefined);

    try {
      const context = await requestContext(content);
      const history: AIMessage[] = next.map(({ role, content: text }) => ({ role, content: text }));
      const reply = await new BackendAIProvider(API_BASE_URL, getFirebaseAIIdToken).sendMessage(history, undefined, context);
      const completed = [...next, { id: `${Date.now()}-a`, role: 'assistant' as const, content: reply.content, createdAt: Date.now() }].slice(-MAX_HISTORY);
      setMessages(completed);
      setConnectionState('connected');
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(completed));
    } catch (error) {
      setMessages(next);
      setConnectionState('error');
      setSendError(providerErrorMessage(error));
      setFailedDraft(content);
      void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const clearHistory = () => Alert.alert('مسح المحادثة؟', 'سيُحذف سجل المحادثة المحفوظ محليًا على هذا الجهاز.', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'مسح', style: 'destructive', onPress: () => {
      setMessages([]);
      setSendError(null);
      setFailedDraft('');
      void AsyncStorage.removeItem(HISTORY_KEY);
    } },
  ]);

  const serviceLabel = connectionState === 'checking'
    ? 'مرشد بيجهّز الرد'
    : connectionState === 'connected'
      ? 'متصل وجاهز'
      : connectionState === 'error'
        ? 'في مشكلة اتصال'
        : firebaseConfigStatus.configured
          ? 'الخدمة مفعّلة'
          : 'إعداد الدخول مطلوب';
  const serviceWarning = connectionState === 'error' || !firebaseConfigStatus.configured;

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.header}>
      <View style={styles.brandIcon}><Ionicons name="sparkles" size={22} color={AI_COLORS.surface} /></View>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>مرشد</Text>
        <Text style={styles.subtitle}>مساعدك الذكي</Text>
      </View>
      <ActionButton themeColors={AI_COLORS} tone="quiet" onPress={() => setSettingsOpen((value) => !value)}>
        <Ionicons name="settings-outline" size={21} color={AI_COLORS.teal} />
      </ActionButton>
      <ActionButton themeColors={AI_COLORS} tone="quiet" onPress={clearHistory}>
        <Ionicons name="trash-outline" size={19} color={AI_COLORS.inkMuted} />
      </ActionButton>
    </View>

    <View style={styles.welcomeCard}>
      <View style={styles.welcomeTopRow}>
        <View style={styles.welcomeMark}><Ionicons name="sparkles" size={15} color={AI_COLORS.teal} /></View>
        <Text style={styles.welcomeEyebrow}>موجود معاك</Text>
        <View style={[styles.statusPill, serviceWarning ? styles.statusWarning : styles.statusReady]}>
          <View style={[styles.statusDot, serviceWarning ? styles.statusDotWarning : styles.statusDotReady]} />
          <Text style={styles.statusText}>{serviceLabel}</Text>
        </View>
      </View>
      <Text style={styles.greetingTitle} accessibilityLiveRegion="polite">
        {typedTitle}{typedTitle.length < GREETING_TITLE.length ? <Text style={styles.cursor}>▌</Text> : null}
      </Text>
      <Text style={styles.greetingBody}>
        {typedBody}{typedTitle.length === GREETING_TITLE.length && typedBody.length < GREETING_BODY.length ? <Text style={styles.cursor}>▌</Text> : null}
      </Text>
    </View>

    {settingsOpen && <ScrollView style={styles.settingsScroll} keyboardShouldPersistTaps="handled">
      <SurfaceCard themeColors={AI_COLORS}>
        <Text style={styles.cardTitle}>خدمة مرشد الذكية</Text>
        <Text style={styles.notice}>
          {firebaseConfigStatus.configured
            ? 'المحادثة متصلة بالخدمة المركزية. مش محتاج تدخل مفتاح أو بيانات مزوّد؛ مرشد يستقبل رسالتك ويرجع لك الرد هنا.'
            : 'عنوان الخدمة مضبوط، لكن إعداد Firebase العام غير مكتمل في نسخة التطبيق. يلزم إعداده حتى يقدر مرشد يتحقق من جلسة المستخدم ويرد.'}
        </Text>
        <View style={styles.backendRow}>
          <Ionicons name={firebaseConfigStatus.configured ? 'shield-checkmark-outline' : 'information-circle-outline'} size={19} color={firebaseConfigStatus.configured ? AI_COLORS.teal : AI_COLORS.amber} />
          <Text style={styles.backendStatus}>{firebaseConfigStatus.configured ? 'المفتاح السري محفوظ على الخادم' : 'راجع إعدادات Firebase العامة للبناء'}</Text>
        </View>
        <View style={styles.testButton}>
          <ActionButton themeColors={AI_COLORS} tone="quiet" onPress={testing ? undefined : testConnection}>
            {testing ? 'جارٍ اختبار الاتصال…' : 'اختبر اتصال مرشد'}
          </ActionButton>
        </View>
        {testing && <ActivityIndicator style={styles.testSpinner} color={AI_COLORS.teal} />}
        <Text style={styles.privacy}>ما تحطش مفتاح Gemini هنا. ما تبعتش كلمات مرور أو معلومات شخصية حساسة في المحادثة.</Text>
      </SurfaceCard>
    </ScrollView>}

    <ScrollView
      ref={listRef}
      style={styles.messages}
      contentContainerStyle={styles.messageList}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
    >
      {messages.length === 0 && <View style={styles.emptyState}>
        <View style={styles.emptyIcon}><Ionicons name="chatbubble-ellipses-outline" size={30} color={AI_COLORS.teal} /></View>
        <Text style={styles.emptyTitle}>يلا نبدأ</Text>
        <Text style={styles.emptyBody}>اختار سؤالًا نبدأ بيه، أو اكتب اللي في بالك.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
          {QUICK_PROMPTS.map((prompt) => (
            <ActionButton key={prompt} themeColors={AI_COLORS} tone="quiet" onPress={() => setDraft(prompt)}>{prompt}</ActionButton>
          ))}
        </ScrollView>
      </View>}

      {messages.map((message) => (
        <View key={message.id} style={[styles.messageLine, message.role === 'user' ? styles.userLine : styles.assistantLine]}>
          {message.role === 'assistant' && <View style={styles.messageAvatar}><Ionicons name="sparkles" size={14} color={AI_COLORS.teal} /></View>}
          <View style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
            {message.role === 'assistant' && <Text style={styles.messageAuthor}>مرشد</Text>}
            <Text style={[styles.bubbleText, message.role === 'user' && styles.userBubbleText]}>{message.content}</Text>
          </View>
        </View>
      ))}

      {busy && <View style={styles.thinking}>
        <ActivityIndicator size="small" color={AI_COLORS.teal} />
        <Text style={styles.thinkingText}>مرشد بيفكر في الرد…</Text>
      </View>}

      {!!sendError && <View style={styles.errorPanel}>
        <Text style={styles.errorTitle}>الرسالة لسه ما وصلهاش رد</Text>
        <Text style={styles.errorText}>{sendError}</Text>
        <ActionButton themeColors={AI_COLORS} tone="quiet" onPress={() => { setDraft(failedDraft); setSendError(null); }}>
          رجّع الرسالة عشان تحاول تاني
        </ActionButton>
      </View>}
    </ScrollView>

    <View style={styles.composer}>
      <View style={styles.composerTools}>
        <ActionButton themeColors={AI_COLORS} tone="quiet" onPress={() => setIncludeMemory((value) => !value)}>
          <Ionicons name={includeMemory ? 'bookmark' : 'bookmark-outline'} size={17} color={includeMemory ? AI_COLORS.teal : AI_COLORS.inkFaint} />
          <Text style={styles.memoryToggle}>{includeMemory ? 'الذاكرة مفعّلة' : 'استخدام الذاكرة'}</Text>
        </ActionButton>
        <Text style={styles.composerHint}>الرد قد ياخد ثواني بسيطة</Text>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="اكتب رسالتك لمرشد…"
          placeholderTextColor={AI_COLORS.inkFaint}
          multiline
          maxLength={4000}
          editable={!busy}
          style={styles.composerInput}
          onSubmitEditing={send}
          accessibilityLabel="اكتب رسالتك لمرشد"
          selectionColor={AI_COLORS.teal}
        />
        <ActionButton
          themeColors={AI_COLORS}
          tone={busy || !draft.trim() ? 'quiet' : 'primary'}
          onPress={busy || !draft.trim() ? undefined : send}
        >
          <Ionicons name="arrow-up" size={21} color={busy || !draft.trim() ? AI_COLORS.inkFaint : AI_COLORS.surface} />
        </ActionButton>
      </View>
      <Text style={styles.footer}>راجع المعلومات المهمة، وما تبعتش بيانات حساسة.</Text>
    </View>
  </KeyboardAvoidingView>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface },
    header: { minHeight: 68, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
    brandIcon: { width: 40, height: 40, borderRadius: 15, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
    headerCopy: { flex: 1 },
    title: { ...typography.h2, color: colors.ink, fontSize: 19 },
    subtitle: { ...typography.body, color: colors.inkMuted, fontSize: 11, marginTop: 1 },
    welcomeCard: { marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg, borderWidth: 1, borderColor: '#23403D', backgroundColor: '#0B1516' },
    welcomeTopRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    welcomeMark: { width: 25, height: 25, borderRadius: 9, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
    welcomeEyebrow: { ...typography.label, color: colors.teal, fontSize: 11, flex: 1 },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 4 },
    statusReady: { borderColor: '#23584F', backgroundColor: '#10231F' },
    statusWarning: { borderColor: '#65502B', backgroundColor: '#292216' },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusDotReady: { backgroundColor: colors.teal },
    statusDotWarning: { backgroundColor: colors.amber },
    statusText: { ...typography.label, color: colors.inkMuted, fontSize: 9, letterSpacing: 0 },
    greetingTitle: { ...typography.h1, color: colors.ink, textAlign: 'right', writingDirection: 'rtl', marginTop: spacing.sm, fontSize: 20, lineHeight: 29 },
    greetingBody: { ...typography.body, color: colors.inkMuted, textAlign: 'right', writingDirection: 'rtl', marginTop: 2, fontSize: 13, lineHeight: 20, minHeight: 22 },
    cursor: { color: colors.teal },
    settingsScroll: { maxHeight: '48%', paddingHorizontal: spacing.md, paddingTop: spacing.xs },
    cardTitle: { ...typography.h2, color: colors.ink, marginBottom: spacing.sm },
    notice: { ...typography.body, color: colors.inkMuted, lineHeight: 22, fontSize: 13 },
    backendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md, padding: spacing.sm, borderRadius: radii.md, backgroundColor: '#0A1012' },
    backendStatus: { ...typography.label, color: colors.inkMuted, fontSize: 11, flex: 1 },
    testButton: { marginTop: spacing.md },
    testSpinner: { marginTop: spacing.sm },
    privacy: { ...typography.body, color: colors.inkFaint, fontSize: 11, lineHeight: 18, marginTop: spacing.md },
    messages: { flex: 1 },
    messageList: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, flexGrow: 1, justifyContent: 'flex-end', gap: spacing.sm },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
    emptyIcon: { width: 54, height: 54, borderRadius: 19, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    emptyTitle: { ...typography.h2, color: colors.ink, fontSize: 17 },
    emptyBody: { ...typography.body, color: colors.inkMuted, textAlign: 'center', lineHeight: 21, fontSize: 12, marginTop: 3 },
    suggestions: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.md, paddingBottom: spacing.xs },
    messageLine: { maxWidth: '94%', flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
    userLine: { alignSelf: 'flex-end' },
    assistantLine: { alignSelf: 'flex-start' },
    messageAvatar: { width: 27, height: 27, borderRadius: 10, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    bubble: { maxWidth: '88%', borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    userBubble: { alignSelf: 'flex-end', backgroundColor: colors.tealDark, borderBottomRightRadius: 5 },
    assistantBubble: { alignSelf: 'flex-start', backgroundColor: colors.paper, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.line },
    messageAuthor: { ...typography.label, color: colors.teal, fontSize: 10, marginBottom: 3 },
    bubbleText: { ...typography.body, color: colors.ink, lineHeight: 23, textAlign: 'right', writingDirection: 'rtl' },
    userBubbleText: { color: '#041412' },
    thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', padding: spacing.sm, backgroundColor: colors.paper, borderRadius: radii.pill },
    thinkingText: { ...typography.body, color: colors.inkMuted, fontSize: 12 },
    errorPanel: { gap: spacing.xs, alignSelf: 'stretch', borderWidth: 1, borderColor: '#593538', backgroundColor: '#211517', borderRadius: radii.md, padding: spacing.sm },
    errorTitle: { ...typography.label, color: colors.coral },
    errorText: { ...typography.body, color: colors.inkMuted, fontSize: 12, lineHeight: 20 },
    composer: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
    composerTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 },
    memoryToggle: { ...typography.label, color: colors.inkMuted, marginLeft: 5, fontSize: 10 },
    composerHint: { ...typography.body, color: colors.inkFaint, fontSize: 10 },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
    composerInput: { flex: 1, maxHeight: 120, minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: 11, color: colors.ink, textAlign: 'right', writingDirection: 'rtl', backgroundColor: colors.paper, fontSize: 15 },
    footer: { ...typography.body, color: colors.inkFaint, fontSize: 10, textAlign: 'center', marginTop: spacing.xs },
  });
}
