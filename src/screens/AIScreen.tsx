import AsyncStorage from '@react-native-async-storage/async-storage';
import { RuqaaText as Text, RuqaaTextInput as TextInput } from '../components/RuqaaText';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AIConfigModal } from '../components/AIConfigModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { AIMessage, selectAIProvider } from '../services/ai/aiService';
import { createUserKeyProvider, providerErrorMessage } from '../services/ai/byokAIService';
import { clearUserAIConfig, getUserAIConfig, saveUserAIConfig, UserAIConfig } from '../services/ai/userAIConfig';
import { getFirebaseAIIdToken } from '../services/firebase/firebaseAuthService';
import { isFirebaseConfigured } from '../services/firebase/firebaseConfig';
import { assembleContext } from '../services/memory/contextAssembly';
import { extractMemoryCandidates } from '../services/memory/memoryExtractor';
import { localMemoryProvider } from '../services/memory/memoryService';
import { colors, radii, spacing, typography } from '../theme';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const hasBackendUrl = Boolean(configuredBaseUrl && !configuredBaseUrl.includes('api.example.com'));
const hasBackend = Boolean(hasBackendUrl && isFirebaseConfigured);
const CONVERSATIONS_KEY = '@murshid/ai-conversations';

type Conversation = { id: string; title: string; messages: AIMessage[]; updatedAt: number };
const welcomeMessage: AIMessage = { role: 'assistant', content: 'أهلًا بك في مرشد AI. اسألني مباشرة؛ يتولى الخادم الاتصال بالذكاء الاصطناعي.' };

function newConversation(): Conversation {
  return { id: `conversation-${Date.now()}`, title: 'محادثة جديدة', messages: [welcomeMessage], updatedAt: Date.now() };
}

function titleFromMessage(content: string) {
  const clean = content.replace(/\s+/g, ' ').trim();
  return clean.length > 34 ? `${clean.slice(0, 34)}…` : clean || 'محادثة جديدة';
}

export function AIScreen({ onOpenMemory }: { onOpenMemory?: () => void } = {}) {
  const [userConfig, setUserConfig] = useState<UserAIConfig | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const provider = useMemo(() => selectAIProvider(
    configuredBaseUrl,
    isFirebaseConfigured ? getFirebaseAIIdToken : undefined,
    userConfig ? createUserKeyProvider(userConfig) : null,
  ), [userConfig]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<FlatList<AIMessage>>(null);

  const activeConversation = conversations.find((item) => item.id === activeId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    AsyncStorage.getItem(CONVERSATIONS_KEY).then((stored) => {
      try {
        const parsed = stored ? JSON.parse(stored) as Conversation[] : [];
        const initial = parsed.length ? parsed : [newConversation()];
        setConversations(initial);
        setActiveId(initial[0].id);
      } catch {
        const initial = [newConversation()];
        setConversations(initial);
        setActiveId(initial[0].id);
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  useEffect(() => { getUserAIConfig().then(setUserConfig).catch(() => setUserConfig(null)); }, []);

  const saveAIConfig = async (config: UserAIConfig) => { await saveUserAIConfig(config); setUserConfig(config); };
  const deleteAIConfig = async () => { await clearUserAIConfig(); setUserConfig(null); setConfigOpen(false); };

  const persist = async (next: Conversation[]) => {
    setConversations(next);
    await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(next));
  };

  const createConversation = async () => {
    const next = [newConversation(), ...conversations];
    await persist(next);
    setActiveId(next[0].id);
    setSidebarOpen(false);
    setError(null);
  };

  const selectConversation = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
    setError(null);
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || sending || !activeConversation) return;
    setError(null);
    const userMessage: AIMessage = { role: 'user', content };
    const nextMessages = [...activeConversation.messages, userMessage];
    const nextConversation = { ...activeConversation, title: activeConversation.title === 'محادثة جديدة' ? titleFromMessage(content) : activeConversation.title, messages: nextMessages, updatedAt: Date.now() };
    const nextConversations = conversations.map((item) => item.id === nextConversation.id ? nextConversation : item);
    await persist(nextConversations);
    setDraft('');
    const candidates = extractMemoryCandidates(content);
    await Promise.all(candidates.map((candidate) => localMemoryProvider.saveCandidate(candidate)));
    if (!provider) {
      setError('خدمة مرشد AI غير جاهزة لهذا الإصدار بعد. لن تُرسل الرسالة قبل إعداد الخدمة.');
      return;
    }
    setSending(true);
    try {
      const memorySettings = await localMemoryProvider.getSettings();
      const memories = memorySettings.enabled && memorySettings.retrievalEnabled ? await localMemoryProvider.list() : [];
      const context = assembleContext(content, nextMessages, memories, [], [], memorySettings);
      const reply = await provider.sendMessage(context.conversation, undefined, { conversationId: nextConversation.id, memory: context.relevantMemories, activeGoals: context.activeGoals, activeTasks: context.activeTasks });
      const completed = { ...nextConversation, messages: [...nextMessages, { role: 'assistant' as const, content: reply.content }], updatedAt: Date.now() };
      await persist(nextConversations.map((item) => item.id === completed.id ? completed : item));
    } catch (requestError) {
      setError(providerErrorMessage(requestError));
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  if (!hydrated || !activeConversation) return <View style={styles.loadingScreen}><ActivityIndicator color={colors.tealDark} /></View>;

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.headerRow}><View style={styles.headerCopy}><ScreenHeader eyebrow="AI ASSISTANT" title="مرشد AI" verified detail="اسأل مرشد مباشرة؛ يتولى Backend الاتصال بخدمة الذكاء الاصطناعي." /></View><View style={styles.headerActions}>{onOpenMemory ? <Pressable accessibilityLabel="فتح ذاكرة مرشد AI" onPress={onOpenMemory} style={styles.menuButton}><Ionicons name="bookmark-outline" size={21} color={colors.ink} /></Pressable> : null}{!hasBackend ? <Pressable accessibilityLabel="إعداد مفتاح API شخصي اختياري" onPress={() => setConfigOpen(true)} style={styles.menuButton}><Ionicons name="key-outline" size={21} color={colors.ink} /></Pressable> : null}<Pressable accessibilityLabel="فتح المحادثات" onPress={() => setSidebarOpen(true)} style={styles.menuButton}><Ionicons name="menu-outline" size={24} color={colors.ink} /></Pressable></View></View>
    {!provider ? <View style={styles.connectionNotice}><Ionicons name="cloud-offline-outline" size={18} color={colors.amber} /><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>خدمة الذكاء الاصطناعي غير جاهزة بعد</Text><Text style={styles.noticeBody}>{hasBackendUrl ? 'عنوان Backend مضبوط لكن بيانات مشروع Firebase غير مضبوطة في هذا الإصدار. تواصل مع فريق التطبيق؛ لا تحتاج إلى مفتاح API خاص.' : 'سيعمل Chat تلقائيًا بعد إعداد خدمة AI المركزية وإصدار التطبيق بها.'}</Text></View></View> : <View style={styles.providerNotice}><Ionicons name="checkmark-circle-outline" size={16} color={colors.tealDark} /><Text style={styles.providerNoticeText}>{hasBackend ? 'متصل بخدمة الذكاء الاصطناعي المركزية' : `متصل عبر ${userConfig?.providerName ?? 'مزودك الشخصي'}`}</Text></View>}
    <FlatList ref={listRef} data={messages} keyExtractor={(_, index) => `${activeConversation.id}-${index}`} contentContainerStyle={styles.messages} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })} renderItem={({ item }) => <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}><Text style={[styles.bubbleText, item.role === 'user' && styles.userBubbleText]}>{item.content}</Text></View>} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} placeholder="اسأل مرشد AI..." placeholderTextColor={colors.inkFaint} multiline maxLength={4000} style={styles.input} editable={!sending} /><Pressable accessibilityLabel="إرسال الرسالة" onPress={send} disabled={!draft.trim() || sending} style={({ pressed }) => [styles.sendButton, (!draft.trim() || sending) && styles.disabled, pressed && styles.pressed]}>{sending ? <ActivityIndicator size="small" color={colors.paper} /> : <Ionicons name="arrow-up" size={20} color={colors.paper} />}</Pressable></View>
    <Modal visible={sidebarOpen} animationType="slide" transparent onRequestClose={() => setSidebarOpen(false)}><View style={styles.modalBackdrop}><Pressable style={styles.dismissArea} onPress={() => setSidebarOpen(false)} /><View style={styles.sidebar}><View style={styles.sidebarHeader}><View><Text style={styles.sidebarEyebrow}>MURSHID AI</Text><Text style={styles.sidebarTitle}>محادثاتك</Text></View><Pressable onPress={() => setSidebarOpen(false)} style={styles.closeButton}><Ionicons name="close" size={20} color={colors.ink} /></Pressable></View><Pressable onPress={createConversation} style={({ pressed }) => [styles.newConversation, pressed && styles.pressed]}><Ionicons name="add" size={20} color={colors.paper} /><Text style={styles.newConversationText}>محادثة جديدة</Text></Pressable><Text style={styles.memoryHint}>ذاكرتك المحلية تُستخدم فقط عند تفعيلها وارتباطها بسؤالك.</Text><FlatList data={conversations} keyExtractor={(item) => item.id} contentContainerStyle={styles.conversationList} renderItem={({ item }) => <Pressable onPress={() => selectConversation(item.id)} style={({ pressed }) => [styles.conversationItem, item.id === activeConversation.id && styles.activeConversation, pressed && styles.pressed]}><Ionicons name="chatbubble-ellipses-outline" size={18} color={item.id === activeConversation.id ? colors.tealDark : colors.inkMuted} /><View style={styles.conversationCopy}><Text numberOfLines={1} style={styles.conversationTitle}>{item.title}</Text><Text style={styles.conversationMeta}>{item.messages.filter((message) => message.role === 'user').length} رسائل · {new Date(item.updatedAt).toLocaleDateString('ar-EG')}</Text></View></Pressable>} /></View></View></Modal><AIConfigModal visible={configOpen} config={userConfig} onClose={() => setConfigOpen(false)} onSave={saveAIConfig} onDelete={deleteAIConfig} />
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg },
  loadingScreen: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' }, headerActions: { flexDirection: 'row', gap: spacing.xs },
  headerCopy: { flex: 1 },
  menuButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  connectionNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.sm, borderRadius: radii.md, backgroundColor: colors.amberSoft }, providerNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.sm, marginBottom: spacing.sm }, providerNoticeText: { ...typography.body, color: colors.tealDark, fontSize: 11 },
  noticeCopy: { flex: 1 }, noticeTitle: { ...typography.label, color: colors.ink }, noticeBody: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  messages: { flexGrow: 1, justifyContent: 'flex-end', paddingVertical: spacing.md, gap: spacing.sm },
  bubble: { maxWidth: '86%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg }, assistantBubble: { alignSelf: 'flex-start', backgroundColor: colors.paper, borderBottomLeftRadius: 6 }, userBubble: { alignSelf: 'flex-end', backgroundColor: colors.ink, borderBottomRightRadius: 6 }, bubbleText: { ...typography.body, color: colors.ink }, userBubbleText: { color: colors.paper }, error: { ...typography.body, color: colors.danger, fontSize: 12, marginBottom: spacing.xs },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line }, input: { flex: 1, maxHeight: 120, minHeight: 46, borderRadius: radii.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, color: colors.ink, paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 10, ...typography.body }, sendButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center' }, disabled: { backgroundColor: colors.inkFaint }, pressed: { opacity: 0.75 },
  modalBackdrop: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(16,33,43,0.42)' }, dismissArea: { flex: 1 }, sidebar: { width: '86%', backgroundColor: colors.surface, padding: spacing.lg, paddingTop: 54 }, sidebarHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, sidebarEyebrow: { ...typography.label, color: colors.tealDark, letterSpacing: 1 }, sidebarTitle: { ...typography.h1, color: colors.ink, marginTop: 3 }, closeButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }, newConversation: { height: 48, borderRadius: radii.md, marginTop: spacing.lg, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }, newConversationText: { ...typography.label, color: colors.paper }, memoryHint: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: spacing.md }, conversationList: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xs }, conversationItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.md }, activeConversation: { backgroundColor: colors.tealSoft }, conversationCopy: { flex: 1 }, conversationTitle: { ...typography.label, color: colors.ink }, conversationMeta: { ...typography.body, color: colors.inkMuted, fontSize: 11, marginTop: 2 },
});
