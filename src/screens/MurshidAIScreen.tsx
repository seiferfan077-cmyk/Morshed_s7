import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ActionButton } from '../components/ActionButton';
import { RuqaaText as Text, RuqaaTextInput as TextInput } from '../components/RuqaaText';
import { BackendAIProvider, AIMessage, AIRequestContext } from '../services/ai/aiService';
import { providerErrorMessage } from '../services/ai/byokAIService';
import { getFirebaseAIIdToken } from '../services/firebase/firebaseAuthService';
import { localMemoryProvider } from '../services/memory/memoryService';
import { MemoryContextItem } from '../types/memory';
import { ThemeColors, radii, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { PomodoroTimerCard } from '../components/PomodoroTimerCard';
import { CHAT_SESSIONS_KEY, ChatMessageRecord, ChatSessionRecord, LEGACY_CHAT_HISTORY_KEY, createChatSession, parseChatSessions, trimChatSessions } from '../services/ai/chatHistoryStorage';
import { createPomodoroTimer, parsePomodoroCommand, PomodoroTimer } from '../services/pomodoro/pomodoroPolicy';

type ChatMessage = ChatMessageRecord;
type ChatSession = ChatSessionRecord;
const MAX_HISTORY = 60;
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
  const { height: windowHeight } = useWindowDimensions();
  const listRef = useRef<ScrollView>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [draft, setDraft] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [includeMemory, setIncludeMemory] = useState(false);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [typedTitle, setTypedTitle] = useState('');
  const [typedSubtitle, setTypedSubtitle] = useState('');
  const sessionsRef = useRef<ChatSession[]>([]);
  const activeSessionIdRef = useRef('');
  const storageReadyRef = useRef(false);
  const activeRequestRef = useRef<{ id: string; controller: AbortController } | null>(null);
  const headerTouchStartY = useRef<number | null>(null);
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const messages = activeSession?.messages ?? [];
  const busy = busySessionId === activeSessionId;

  const commitSessions = useCallback((nextSessions: ChatSession[]) => {
    const trimmed = trimChatSessions(nextSessions);
    sessionsRef.current = trimmed;
    setSessions(trimmed);
    if (storageReadyRef.current) void AsyncStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(trimmed));
  }, []);

  const updateSession = useCallback((sessionId: string, updater: (session: ChatSession) => ChatSession) => {
    const current = sessionsRef.current;
    const existing = current.find((session) => session.id === sessionId);
    const next = existing
      ? current.map((session) => session.id === sessionId ? updater(session) : session)
      : [...current, updater({ ...createChatSession(), id: sessionId })];
    commitSessions(next);
  }, [commitSessions]);

  const abortActiveRequest = useCallback(() => {
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
    setBusySessionId(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem(CHAT_SESSIONS_KEY), AsyncStorage.getItem(LEGACY_CHAT_HISTORY_KEY)]).then(([rawSessions, rawLegacyHistory]) => {
      if (!mounted) return;
      const loadedSessions = parseChatSessions(rawSessions, rawLegacyHistory);
      sessionsRef.current = loadedSessions;
      setSessions(loadedSessions);
      activeSessionIdRef.current = loadedSessions[0].id;
      setActiveSessionId(loadedSessions[0].id);
      storageReadyRef.current = true;
      if (!rawSessions || rawLegacyHistory) {
        void AsyncStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(loadedSessions));
        if (rawLegacyHistory) void AsyncStorage.removeItem(LEGACY_CHAT_HISTORY_KEY);
      }
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!isFocused || messages.length > 0) return undefined;
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
  }, [activeSessionId, isFocused, messages.length]);

  const requestContext = useCallback(async (query: string): Promise<AIRequestContext> => {
    if (!includeMemory) return {};
    const memories = await localMemoryProvider.retrieve(query, 5);
    const safeMemories: MemoryContextItem[] = memories.filter((item) => item.sensitivity === 'normal' && item.consent === 'accepted').map(({ id, type, content, importance, tags }) => ({ id, type, content, importance, tags }));
    return { memory: safeMemories };
  }, [includeMemory]);

  const appendMessage = useCallback((sessionId: string, message: ChatMessage, anchorMessageId?: string) => {
    updateSession(sessionId, (session) => {
      const nextMessages = [...session.messages, message].slice(-MAX_HISTORY);
      const firstUser = nextMessages.find((item) => item.role === 'user');
      return {
        ...session,
        title: session.title === 'محادثة جديدة' && firstUser ? firstUser.content.slice(0, 48) : session.title,
        updatedAt: message.createdAt,
        messages: nextMessages,
        ...(anchorMessageId ? { anchorMessageId } : {}),
      };
    });
  }, [updateSession]);

  const startNewConversation = useCallback(() => {
    abortActiveRequest();
    const session = createChatSession();
    activeSessionIdRef.current = session.id;
    setActiveSessionId(session.id);
    commitSessions([session, ...sessionsRef.current]);
    setDrawerOpen(false);
    setSettingsOpen(false);
    setDraft('');
    setTypedTitle('');
    setTypedSubtitle('');
    setTimeout(() => listRef.current?.scrollTo({ y: 0, animated: false }), 40);
  }, [abortActiveRequest, commitSessions]);

  const selectConversation = useCallback((sessionId: string) => {
    if (sessionId === activeSessionIdRef.current) { setDrawerOpen(false); return; }
    abortActiveRequest();
    activeSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
    setDrawerOpen(false);
    setSettingsOpen(false);
    setDraft('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 40);
  }, [abortActiveRequest]);

  const updatePomodoroTimer = useCallback((sessionId: string, messageId: string, timer: PomodoroTimer) => {
    updateSession(sessionId, (session) => ({
      ...session,
      updatedAt: Date.now(),
      messages: session.messages.map((message) => message.id === messageId ? { ...message, timer } : message),
    }));
  }, [updateSession]);

  const handleHeaderTouchStart = (event: { nativeEvent: { pageY: number } }) => {
    headerTouchStartY.current = event.nativeEvent.pageY;
  };

  const handleHeaderTouchEnd = (event: { nativeEvent: { pageY: number } }) => {
    const startY = headerTouchStartY.current;
    headerTouchStartY.current = null;
    if (startY !== null && startY - event.nativeEvent.pageY > 58) startNewConversation();
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const reply = await new BackendAIProvider(API_BASE_URL, getFirebaseAIIdToken)
        .sendMessage([{ role: 'user', content: 'أجب بكلمة: متصل' }]);
      Alert.alert('الاتصال ناجح', `وصل رد من خدمة مرشد: ${reply.content.slice(0, 120)}`);
    } catch (error) {
      Alert.alert('فشل اختبار الاتصال', providerErrorMessage(error));
    } finally {
      setTesting(false);
    }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || busy) return;
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) return;
    const pomodoroCommand = parsePomodoroCommand(content);
    const provider = new BackendAIProvider(API_BASE_URL, getFirebaseAIIdToken);
    const now = Date.now();
    const userMessage: ChatMessage = { id: `${now}-u`, role: 'user', content, createdAt: now };
    const session = sessionsRef.current.find((item) => item.id === sessionId) ?? createChatSession(now);
    const currentMessages = session.messages;
    setDraft('');
    appendMessage(sessionId, userMessage, userMessage.id);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);

    if (pomodoroCommand) {
      let assistantMessage: ChatMessage;
      if (pomodoroCommand.kind === 'invalid-duration') {
        assistantMessage = { id: `${Date.now()}-a`, role: 'assistant', content: 'اختار مدة من دقيقة واحدة لحد 3 ساعات، وأنا أجهّز لك المؤقّت.', createdAt: Date.now() };
      } else if (currentMessages.some((message) => message.kind === 'pomodoro' && message.timer && (message.timer.status === 'running' || message.timer.status === 'paused'))) {
        assistantMessage = { id: `${Date.now()}-a`, role: 'assistant', content: 'عندك جلسة تركيز شغالة بالفعل في المحادثة دي. كمّلها أو انهيها من بطاقة المؤقّت الأول.', createdAt: Date.now() };
      } else {
        const minutes = pomodoroCommand.durationMs / 60_000;
        const durationLabel = minutes >= 60
          ? `${Math.floor(minutes / 60)} ساعة${minutes % 60 ? ` و${minutes % 60} دقيقة` : ''}`
          : `${minutes} دقيقة`;
        const startedAt = Date.now();
        assistantMessage = {
          id: `${startedAt}-pomodoro`, role: 'assistant', kind: 'pomodoro',
          content: `بدأت جلسة تركيز مدتها ${durationLabel}. تقدر توقفها مؤقتًا أو تنهيها من البطاقة.`,
          createdAt: startedAt,
          timer: createPomodoroTimer(pomodoroCommand.durationMs, startedAt),
        };
      }
      appendMessage(sessionId, assistantMessage);
      return;
    }

    const controller = new AbortController();
    const requestId = `${sessionId}:${now}`;
    activeRequestRef.current = { id: requestId, controller };
    setBusySessionId(sessionId);
    try {
      const context = await requestContext(content);
      const history: AIMessage[] = [...currentMessages, userMessage]
        .filter((message) => message.kind !== 'pomodoro')
        .map(({ role, content: text }) => ({ role, content: text }));
      const reply = await provider.sendMessage(history, controller.signal, context);
      appendMessage(sessionId, { id: `${Date.now()}-a`, role: 'assistant', content: reply.content, createdAt: Date.now() });
    } catch (error) {
      if (!controller.signal.aborted) {
        setDraft(content);
        Alert.alert('تعذر استلام الرد', providerErrorMessage(error));
      }
    } finally {
      if (activeRequestRef.current?.id === requestId) {
        activeRequestRef.current = null;
        setBusySessionId(null);
      }
    }
  };

  const clearHistory = () => Alert.alert('مسح المحادثة الحالية؟', 'سيُحذف سجل هذه المحادثة فقط. ستبقى المحادثات الأخرى محفوظة.', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'مسح', style: 'destructive', onPress: () => { abortActiveRequest(); updateSession(activeSessionIdRef.current, (session) => ({ ...session, title: 'محادثة جديدة', updatedAt: Date.now(), messages: [], anchorMessageId: undefined })); } },
  ]);

  useEffect(() => {
    const keyboardShown = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 90);
    });
    return () => keyboardShown.remove();
  }, []);

  return <>
    <StatusBar style={isFocused ? 'light' : mode === 'dark' ? 'light' : 'dark'} />
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
    <View style={styles.header} onTouchStart={handleHeaderTouchStart} onTouchEnd={handleHeaderTouchEnd}>
      <View style={styles.brandIcon}><Ionicons name="sparkles" size={22} color={colors.tealDark} /></View>
      <View style={styles.headerCopy}><Text style={styles.title}>مُرشد</Text><Text style={styles.subtitle}>مساعدك الذكي</Text></View>
      <ActionButton tone="quiet" buttonStyle={styles.headerAction} labelStyle={styles.headerActionText} onPress={() => setDrawerOpen(true)} accessibilityLabel="فتح قائمة المحادثات"><Ionicons name="menu-outline" size={23} color={colors.inkMuted} /></ActionButton>
      <ActionButton tone="quiet" buttonStyle={styles.headerAction} labelStyle={styles.headerActionText} onPress={startNewConversation} accessibilityLabel="محادثة جديدة"><Ionicons name="create-outline" size={21} color={colors.tealDark} /></ActionButton>
      <ActionButton tone="quiet" buttonStyle={styles.headerAction} labelStyle={styles.headerActionText} onPress={() => setSettingsOpen((value) => !value)}><Ionicons name="settings-outline" size={22} color={colors.inkMuted} /></ActionButton>
    </View>

    {messages.length === 0 && <View style={styles.greetingPanel}>
      <View style={styles.greetingIcon}><Ionicons name="chatbubble-ellipses" size={22} color={colors.tealDark} /></View>
      <View style={styles.greetingCopy}>
        <Text style={styles.greetingTitle}>{typedTitle}{typedTitle.length < GREETING_TITLE.length ? <Text style={styles.typingCursor}>▍</Text> : null}</Text>
        <Text style={styles.greetingSubtitle}>{typedSubtitle}{typedTitle.length === GREETING_TITLE.length && typedSubtitle.length < GREETING_SUBTITLE.length ? <Text style={styles.typingCursor}>▍</Text> : null}</Text>
      </View>
    </View>}

    {settingsOpen && <ScrollView style={styles.settingsScroll} keyboardShouldPersistTaps="handled">
      <View style={styles.settingsCard}>
        <Text style={styles.cardTitle}>خدمة مرشد الذكية</Text>
        <Text style={styles.notice}>المحادثة متصلة بخدمة مُرشد الآمنة. بيانات مزود الذكاء الاصطناعي محفوظة على الخادم ولا يلزم إدخال مفتاح هنا.</Text>
        <View style={styles.backendTest}>
          <ActionButton tone="quiet" buttonStyle={styles.quietAction} labelStyle={styles.quietActionText} onPress={testing ? undefined : testConnection}>
            {testing ? 'جارٍ اختبار الاتصال…' : 'اختبر اتصال مرشد'}
          </ActionButton>
        </View>
        {testing && <ActivityIndicator style={styles.testSpinner} color={colors.tealDark} />}
        <Text style={styles.privacy}>لا تضع كلمات مرور أو معلومات شخصية حساسة في المحادثة.</Text>
      </View>
    </ScrollView>}

        <ScrollView ref={listRef} style={styles.messages} contentContainerStyle={[styles.messageList, messages.length === 0 && styles.emptyMessageList]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}>
      {messages.length === 0 && <View style={styles.emptyState}><View style={styles.emptyIcon}><Ionicons name="sparkles-outline" size={28} color={colors.tealDark} /></View><Text style={styles.emptyBody}>اكتب رسالتك في الأسفل، وسيظهر رد مُرشد هنا.</Text></View>}
      {messages.map((message) => <View key={message.id} style={styles.messageBlock}>
        <View style={message.role === 'user' ? [styles.bubble, styles.userBubble] : message.kind === 'pomodoro' ? styles.pomodoroMessage : styles.assistantMessage}>
          <Text style={[styles.bubbleText, message.role === 'user' && styles.userBubbleText, message.role === 'assistant' && styles.assistantText]}>{message.content}</Text>
          {message.kind === 'pomodoro' && message.timer ? <PomodoroTimerCard timer={message.timer} onChange={(timer) => updatePomodoroTimer(activeSessionId, message.id, timer)} /> : null}
        </View>
        {activeSession?.anchorMessageId === message.id ? <View style={{ height: Math.min(160, windowHeight * 0.2) }} /> : null}
      </View>)}
      {busy && <View style={styles.thinking}><ActivityIndicator size="small" color={colors.tealDark} /><Text style={styles.thinkingText}>مُرشد يكتب…</Text></View>}
    </ScrollView>

    <View style={styles.composer}>
      <ActionButton tone="quiet" buttonStyle={styles.memoryAction} labelStyle={styles.memoryActionText} onPress={() => setIncludeMemory((value) => !value)}><Ionicons name={includeMemory ? 'bookmark' : 'bookmark-outline'} size={20} color={includeMemory ? colors.tealDark : colors.inkFaint} /><Text style={styles.memoryToggle}>{includeMemory ? 'الذاكرة مفعّلة' : 'استخدام الذاكرة'}</Text></ActionButton>
      <View style={styles.inputRow}><TextInput value={draft} onChangeText={setDraft} placeholder="اكتب رسالتك…" placeholderTextColor={colors.inkFaint} multiline maxLength={4000} editable={!busy} style={styles.composerInput} submitBehavior="submit" returnKeyType="send" onSubmitEditing={send} /><ActionButton buttonStyle={styles.sendAction} labelStyle={styles.sendActionText} onPress={busy || !draft.trim() ? undefined : send}><Ionicons name="arrow-up" size={21} color="#07110F" /></ActionButton></View>
      <Text style={styles.footer}>راجع الإجابات المهمة. لا ترسل كلمات مرور أو معلومات حساسة.</Text>
    </View>
    </KeyboardAvoidingView>

    <Modal visible={drawerOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDrawerOpen(false)}>
      <View style={styles.drawerRoot}>
        <Pressable style={styles.drawerScrim} onPress={() => setDrawerOpen(false)} accessibilityLabel="إغلاق القائمة" />
        <View style={styles.drawer}>
          <View style={styles.drawerHeader}>
            <View><Text style={styles.drawerTitle}>محادثات مُرشد</Text><Text style={styles.drawerCaption}>سجلك محفوظ على هذا الجهاز</Text></View>
            <Pressable onPress={() => setDrawerOpen(false)} accessibilityRole="button" accessibilityLabel="إغلاق القائمة" style={styles.drawerClose}><Ionicons name="close" size={20} color={colors.inkMuted} /></Pressable>
          </View>
          <Pressable onPress={startNewConversation} style={styles.newChatButton} accessibilityRole="button"><Ionicons name="add" size={19} color="#07110F" /><Text style={styles.newChatText}>محادثة جديدة</Text></Pressable>
          <Text style={styles.drawerSection}>الأخيرة</Text>
          <ScrollView style={styles.sessionList} keyboardShouldPersistTaps="handled">
            {[...sessions].sort((a, b) => b.updatedAt - a.updatedAt).map((session) => <Pressable key={session.id} onPress={() => selectConversation(session.id)} style={[styles.sessionItem, session.id === activeSessionId && styles.sessionItemActive]}>
              <Ionicons name="chatbubble-ellipses-outline" size={17} color={session.id === activeSessionId ? colors.tealDark : colors.inkFaint} />
              <View style={styles.sessionCopy}><Text numberOfLines={1} style={styles.sessionTitle}>{session.title}</Text><Text style={styles.sessionDate}>{session.messages.length ? new Date(session.updatedAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) : 'فارغة'}</Text></View>
            </Pressable>)}
          </ScrollView>
          <View style={styles.drawerFooter}>
            <Pressable onPress={() => { setDrawerOpen(false); setSettingsOpen((value) => !value); }} style={styles.drawerAction}><Ionicons name="settings-outline" size={18} color={colors.inkMuted} /><Text style={styles.drawerActionText}>إعدادات الاتصال</Text></Pressable>
            <Pressable onPress={() => { setDrawerOpen(false); clearHistory(); }} style={styles.drawerAction}><Ionicons name="trash-outline" size={18} color="#F08F8F" /><Text style={[styles.drawerActionText, styles.deleteSessionText]}>مسح المحادثة الحالية</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface },
    header: { minHeight: 72, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
    brandIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, borderWidth: 1, borderColor: colors.line },
    headerCopy: { flex: 1 }, title: { ...typography.h2, color: colors.ink }, subtitle: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 2 },
    headerAction: { minHeight: 42, minWidth: 40, paddingHorizontal: 8, marginLeft: 4, borderRadius: radii.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, headerActionText: { color: colors.inkMuted },
    greetingPanel: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm, padding: spacing.md, minHeight: 100, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
    greetingIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, backgroundColor: colors.tealSoft },
    greetingCopy: { flex: 1, minHeight: 66, justifyContent: 'center' }, greetingTitle: { ...typography.h2, color: colors.ink, fontSize: 17, lineHeight: 26, textAlign: 'right', writingDirection: 'rtl' }, greetingSubtitle: { ...typography.body, color: colors.inkMuted, fontSize: 13, lineHeight: 21, marginTop: 3, textAlign: 'right', writingDirection: 'rtl' }, typingCursor: { color: colors.tealDark },
    settingsScroll: { maxHeight: '48%', paddingHorizontal: spacing.md, paddingTop: spacing.xs }, settingsCard: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.line }, cardTitle: { ...typography.h2, color: colors.ink, marginBottom: spacing.sm }, notice: { ...typography.body, color: colors.inkMuted, lineHeight: 22 }, backendTest: { marginTop: spacing.md }, testSpinner: { marginTop: spacing.sm }, privacy: { ...typography.body, color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: spacing.md },
    primaryAction: { backgroundColor: colors.tealDark }, primaryActionText: { color: '#07110F' }, quietAction: { backgroundColor: '#172228', borderColor: colors.line, borderWidth: 1 }, quietActionText: { color: '#C0CDD2' },
    messages: { flex: 1 }, messageList: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, flexGrow: 1, justifyContent: 'flex-start', gap: spacing.sm }, emptyMessageList: { justifyContent: 'center' }, emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl }, emptyIcon: { width: 58, height: 58, borderRadius: 21, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }, emptyBody: { ...typography.body, color: colors.inkMuted, textAlign: 'center', lineHeight: 23, marginTop: spacing.xs }, messageBlock: { width: '100%' }, bubble: { maxWidth: '88%', borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, userBubble: { alignSelf: 'flex-end', backgroundColor: colors.tealDark, borderBottomRightRadius: 5 }, assistantMessage: { alignSelf: 'stretch', paddingVertical: 4, paddingHorizontal: 2 }, pomodoroMessage: { alignSelf: 'stretch', paddingVertical: 4, paddingHorizontal: 2 }, bubbleText: { ...typography.body, color: colors.ink, lineHeight: 23, textAlign: 'right', writingDirection: 'rtl' }, userBubbleText: { color: '#07110F' }, assistantText: { color: colors.ink, fontSize: 15, lineHeight: 26 }, thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 2, paddingVertical: spacing.sm }, thinkingText: { ...typography.body, color: colors.inkMuted, fontSize: 13 },
    composer: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper }, memoryAction: { minHeight: 34, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, borderRadius: radii.md, backgroundColor: '#172228', borderWidth: 1, borderColor: colors.line }, memoryActionText: { color: colors.inkMuted }, memoryToggle: { ...typography.label, color: colors.inkMuted, marginLeft: 6 }, inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs }, composerInput: { flex: 1, maxHeight: 110, minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.ink, textAlign: 'right', backgroundColor: colors.surface }, sendAction: { minHeight: 48, width: 48, paddingHorizontal: 0, borderRadius: 24, backgroundColor: colors.tealDark }, sendActionText: { color: '#07110F' }, footer: { ...typography.body, color: colors.inkFaint, fontSize: 10, textAlign: 'center', marginTop: spacing.xs },
    drawerRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.56)' }, drawerScrim: { ...StyleSheet.absoluteFill }, drawer: { position: 'absolute', top: 0, right: 0, width: '86%', maxWidth: 360, height: '100%', backgroundColor: colors.surface, borderLeftWidth: 1, borderColor: colors.line, paddingTop: Platform.OS === 'android' ? 38 : 52, paddingHorizontal: spacing.md, paddingBottom: spacing.md }, drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.md }, drawerTitle: { ...typography.h2, color: colors.ink, fontSize: 18 }, drawerCaption: { ...typography.body, color: colors.inkFaint, fontSize: 11, marginTop: 3 }, drawerClose: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }, newChatButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderRadius: 17, backgroundColor: colors.tealDark }, newChatText: { ...typography.label, color: '#07110F' }, drawerSection: { ...typography.label, color: colors.inkFaint, marginTop: spacing.lg, marginBottom: spacing.xs, textAlign: 'right' }, sessionList: { flex: 1 }, sessionItem: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: 15, marginBottom: 4 }, sessionItemActive: { backgroundColor: colors.tealSoft, borderWidth: 1, borderColor: '#28544F' }, sessionCopy: { flex: 1 }, sessionTitle: { ...typography.body, color: colors.ink, textAlign: 'right', fontSize: 13 }, sessionDate: { ...typography.body, color: colors.inkFaint, textAlign: 'right', fontSize: 10, marginTop: 2 }, drawerFooter: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, gap: 3 }, drawerAction: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm }, drawerActionText: { ...typography.label, color: colors.inkMuted, fontSize: 12 }, deleteSessionText: { color: '#F08F8F' },
  });
}
