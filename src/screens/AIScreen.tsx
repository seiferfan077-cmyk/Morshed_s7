import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { AIMessage, BackendAIProvider } from '../services/ai/aiService';
import { colors, radii, spacing, typography } from '../theme';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const hasBackend = Boolean(configuredBaseUrl && !configuredBaseUrl.includes('api.example.com'));
const CONVERSATIONS_KEY = '@murshid/ai-conversations';

type Conversation = { id: string; title: string; messages: AIMessage[]; updatedAt: number };
const welcomeMessage: AIMessage = { role: 'assistant', content: 'أهلًا بك. أنا مرشد. اكتب ما تحتاجه، وستظل محادثاتك محفوظة على جهازك.' };

function newConversation(): Conversation {
  return { id: `conversation-${Date.now()}`, title: 'محادثة جديدة', messages: [welcomeMessage], updatedAt: Date.now() };
}

function titleFromMessage(content: string) {
  const clean = content.replace(/\s+/g, ' ').trim();
  return clean.length > 34 ? `${clean.slice(0, 34)}…` : clean || 'محادثة جديدة';
}

export function AIScreen() {
  const provider = useMemo(() => hasBackend ? new BackendAIProvider(configuredBaseUrl as string) : null, []);
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
    if (!provider) {
      setError('مرشد غير موصل بعد. أضف EXPO_PUBLIC_API_BASE_URL لواجهة Backend التي توفر /ai/chat.');
      return;
    }
    setSending(true);
    try {
      const reply = await provider.sendMessage(nextMessages, undefined, { conversationId: nextConversation.id, memory: nextMessages });
      const completed = { ...nextConversation, messages: [...nextMessages, { role: 'assistant' as const, content: reply.content }], updatedAt: Date.now() };
      await persist(nextConversations.map((item) => item.id === completed.id ? completed : item));
    } catch {
      setError('تعذر الاتصال بمرشد. راجع Backend والاتصال بالشبكة ثم حاول مرة أخرى.');
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  if (!hydrated || !activeConversation) return <View style={styles.loadingScreen}><ActivityIndicator color={colors.tealDark} /></View>;

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.headerRow}><View style={styles.headerCopy}><ScreenHeader eyebrow="AI ASSISTANT" title="مرشد" verified detail="محادثتك محفوظة محليًا ويمكن استكمالها لاحقًا." /></View><Pressable accessibilityLabel="فتح المحادثات" onPress={() => setSidebarOpen(true)} style={styles.menuButton}><Ionicons name="menu-outline" size={24} color={colors.ink} /></Pressable></View>
    {!hasBackend ? <View style={styles.connectionNotice}><Ionicons name="cloud-offline-outline" size={18} color={colors.amber} /><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>مرشد ينتظر الربط</Text><Text style={styles.noticeBody}>الذاكرة المحلية تعمل، ولن يتم إرسال أي طلب قبل إعداد Backend.</Text></View></View> : null}
    <FlatList ref={listRef} data={messages} keyExtractor={(_, index) => `${activeConversation.id}-${index}`} contentContainerStyle={styles.messages} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })} renderItem={({ item }) => <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}><Text style={[styles.bubbleText, item.role === 'user' && styles.userBubbleText]}>{item.content}</Text></View>} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} placeholder="اكتب رسالتك..." placeholderTextColor={colors.inkFaint} multiline maxLength={4000} style={styles.input} editable={!sending} /><Pressable accessibilityLabel="إرسال الرسالة" onPress={send} disabled={!draft.trim() || sending} style={({ pressed }) => [styles.sendButton, (!draft.trim() || sending) && styles.disabled, pressed && styles.pressed]}>{sending ? <ActivityIndicator size="small" color={colors.paper} /> : <Ionicons name="arrow-up" size={20} color={colors.paper} />}</Pressable></View>
    <Modal visible={sidebarOpen} animationType="slide" transparent onRequestClose={() => setSidebarOpen(false)}><View style={styles.modalBackdrop}><Pressable style={styles.dismissArea} onPress={() => setSidebarOpen(false)} /><View style={styles.sidebar}><View style={styles.sidebarHeader}><View><Text style={styles.sidebarEyebrow}>MURSHID MEMORY</Text><Text style={styles.sidebarTitle}>محادثاتك</Text></View><Pressable onPress={() => setSidebarOpen(false)} style={styles.closeButton}><Ionicons name="close" size={20} color={colors.ink} /></Pressable></View><Pressable onPress={createConversation} style={({ pressed }) => [styles.newConversation, pressed && styles.pressed]}><Ionicons name="add" size={20} color={colors.paper} /><Text style={styles.newConversationText}>محادثة جديدة</Text></Pressable><Text style={styles.memoryHint}>ذاكرة طويلة المدى محفوظة على هذا الجهاز.</Text><FlatList data={conversations} keyExtractor={(item) => item.id} contentContainerStyle={styles.conversationList} renderItem={({ item }) => <Pressable onPress={() => selectConversation(item.id)} style={({ pressed }) => [styles.conversationItem, item.id === activeConversation.id && styles.activeConversation, pressed && styles.pressed]}><Ionicons name="chatbubble-ellipses-outline" size={18} color={item.id === activeConversation.id ? colors.tealDark : colors.inkMuted} /><View style={styles.conversationCopy}><Text numberOfLines={1} style={styles.conversationTitle}>{item.title}</Text><Text style={styles.conversationMeta}>{item.messages.filter((message) => message.role === 'user').length} رسائل · {new Date(item.updatedAt).toLocaleDateString('ar-EG')}</Text></View></Pressable>} /></View></View></Modal>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg },
  loadingScreen: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headerCopy: { flex: 1 },
  menuButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  connectionNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.sm, borderRadius: radii.md, backgroundColor: colors.amberSoft },
  noticeCopy: { flex: 1 }, noticeTitle: { ...typography.label, color: colors.ink }, noticeBody: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  messages: { flexGrow: 1, justifyContent: 'flex-end', paddingVertical: spacing.md, gap: spacing.sm },
  bubble: { maxWidth: '86%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg }, assistantBubble: { alignSelf: 'flex-start', backgroundColor: colors.paper, borderBottomLeftRadius: 6 }, userBubble: { alignSelf: 'flex-end', backgroundColor: colors.ink, borderBottomRightRadius: 6 }, bubbleText: { ...typography.body, color: colors.ink }, userBubbleText: { color: colors.paper }, error: { ...typography.body, color: colors.danger, fontSize: 12, marginBottom: spacing.xs },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line }, input: { flex: 1, maxHeight: 120, minHeight: 46, borderRadius: radii.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, color: colors.ink, paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 10, ...typography.body }, sendButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center' }, disabled: { backgroundColor: colors.inkFaint }, pressed: { opacity: 0.75 },
  modalBackdrop: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(16,33,43,0.42)' }, dismissArea: { flex: 1 }, sidebar: { width: '86%', backgroundColor: colors.surface, padding: spacing.lg, paddingTop: 54 }, sidebarHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, sidebarEyebrow: { ...typography.label, color: colors.tealDark, letterSpacing: 1 }, sidebarTitle: { ...typography.h1, color: colors.ink, marginTop: 3 }, closeButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }, newConversation: { height: 48, borderRadius: radii.md, marginTop: spacing.lg, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }, newConversationText: { ...typography.label, color: colors.paper }, memoryHint: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: spacing.md }, conversationList: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xs }, conversationItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.md }, activeConversation: { backgroundColor: colors.tealSoft }, conversationCopy: { flex: 1 }, conversationTitle: { ...typography.label, color: colors.ink }, conversationMeta: { ...typography.body, color: colors.inkMuted, fontSize: 11, marginTop: 2 },
});
