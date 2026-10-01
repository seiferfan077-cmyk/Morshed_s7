import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { AIMessage, BackendAIProvider } from '../services/ai/aiService';
import { colors, radii, spacing, typography } from '../theme';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const hasBackend = Boolean(configuredBaseUrl && !configuredBaseUrl.includes('api.example.com'));

export function AIScreen() {
  const provider = useMemo(() => hasBackend ? new BackendAIProvider(configuredBaseUrl as string) : null, []);
  const [messages, setMessages] = useState<AIMessage[]>([{ role: 'assistant', content: 'أهلًا بك. أنا مساعد مُرشد. اكتب ما تحتاجه وسأساعدك عندما يكون Backend متصلًا.' }]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<AIMessage>>(null);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setError(null);
    const nextMessages = [...messages, { role: 'user' as const, content }];
    setMessages(nextMessages);
    setDraft('');
    if (!provider) {
      setError('طبقة AI غير موصلة بعد. أضف EXPO_PUBLIC_API_BASE_URL لواجهة Backend التي توفر /ai/chat.');
      return;
    }
    setSending(true);
    try {
      const reply = await provider.sendMessage(nextMessages);
      setMessages((current) => [...current, { role: 'assistant', content: reply.content }]);
    } catch {
      setError('تعذر الاتصال بالمساعد. راجع Backend والاتصال بالشبكة ثم حاول مرة أخرى.');
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScreenHeader eyebrow="AI ASSISTANT" title="المساعد" detail="محادثة عبر Backend مستقل، من دون مفاتيح سرية داخل التطبيق." />{!hasBackend ? <View style={styles.connectionNotice}><Ionicons name="cloud-offline-outline" size={18} color={colors.amber} /><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>المساعد ينتظر الربط</Text><Text style={styles.noticeBody}>الواجهة جاهزة، ولن يتم إرسال أي طلب قبل إعداد Backend.</Text></View></View> : null}<FlatList ref={listRef} data={messages} keyExtractor={(_, index) => `${index}`} contentContainerStyle={styles.messages} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })} renderItem={({ item }) => <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}><Text style={[styles.bubbleText, item.role === 'user' && styles.userBubbleText]}>{item.content}</Text></View>} />{error ? <Text style={styles.error}>{error}</Text> : null}<View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} placeholder="اكتب رسالتك..." placeholderTextColor={colors.inkFaint} multiline maxLength={4000} style={styles.input} editable={!sending} /><Pressable accessibilityLabel="إرسال الرسالة" onPress={send} disabled={!draft.trim() || sending} style={({ pressed }) => [styles.sendButton, (!draft.trim() || sending) && styles.disabled, pressed && styles.pressed]}>{sending ? <ActivityIndicator size="small" color={colors.paper} /> : <Ionicons name="arrow-up" size={20} color={colors.paper} />}</Pressable></View></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg },
  connectionNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: spacing.sm, borderRadius: radii.md, backgroundColor: colors.amberSoft },
  noticeCopy: { flex: 1 },
  noticeTitle: { ...typography.label, color: colors.ink },
  noticeBody: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  messages: { flexGrow: 1, justifyContent: 'flex-end', paddingVertical: spacing.md, gap: spacing.sm },
  bubble: { maxWidth: '86%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: colors.paper, borderBottomLeftRadius: 6 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.ink, borderBottomRightRadius: 6 },
  bubbleText: { ...typography.body, color: colors.ink },
  userBubbleText: { color: colors.paper },
  error: { ...typography.body, color: colors.danger, fontSize: 12, marginBottom: spacing.xs },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  input: { flex: 1, maxHeight: 120, minHeight: 46, borderRadius: radii.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, color: colors.ink, paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 10, ...typography.body },
  sendButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center' },
  disabled: { backgroundColor: colors.inkFaint },
  pressed: { opacity: 0.75 },
});
