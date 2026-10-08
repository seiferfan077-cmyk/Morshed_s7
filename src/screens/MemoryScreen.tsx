import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text, RuqaaTextInput as TextInput } from '../components/RuqaaText';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radii, spacing, typography } from '../theme';
import { defaultMemorySettings, MemoryCandidate, MemoryItem, MemorySettings, MemoryType } from '../types/memory';
import { localMemoryProvider } from '../services/memory/memoryService';

const typeLabels: Record<MemoryType, string> = { fact: 'معلومة', context: 'سياق', situation: 'موقف', habit: 'عادة', goal: 'هدف', preference: 'تفضيل' };
const types: MemoryType[] = ['fact', 'preference', 'context', 'habit', 'goal', 'situation'];

export function MemoryScreen({ onBackToAssistant }: { onBackToAssistant?: () => void } = {}) {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([]);
  const [settings, setSettings] = useState<MemorySettings>(defaultMemorySettings);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [selectedType, setSelectedType] = useState<MemoryType>('fact');
  const [showComposer, setShowComposer] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [nextItems, nextCandidates, nextSettings] = await Promise.all([localMemoryProvider.list(), localMemoryProvider.listCandidates(), localMemoryProvider.getSettings()]);
    setItems(nextItems);
    setCandidates(nextCandidates);
    setSettings(nextSettings);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  useEffect(() => {
    let active = true;
    void Promise.all([localMemoryProvider.list(), localMemoryProvider.listCandidates(), localMemoryProvider.getSettings()]).then(([nextItems, nextCandidates, nextSettings]) => {
      if (!active) return;
      setItems(nextItems);
      setCandidates(nextCandidates);
      setSettings(nextSettings);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => !normalized || `${item.content} ${item.tags.join(' ')}`.toLowerCase().includes(normalized));
  }, [items, query]);

  const addMemory = async () => {
    const content = draft.trim();
    if (!content || !settings.enabled) return;
    const now = new Date().toISOString();
    const item: MemoryItem = { id: `memory-${Date.now()}`, userId: 'local-user', type: selectedType, content, source: 'user', createdAt: now, updatedAt: now, confidence: 1, importance: 'medium', sensitivity: 'normal', consent: 'accepted', tags: [] };
    await localMemoryProvider.save(item);
    setDraft('');
    setShowComposer(false);
    await load();
  };

  const approveCandidate = async (candidate: MemoryCandidate) => { await localMemoryProvider.approveCandidate(candidate.id); await load(); };
  const rejectCandidate = async (candidate: MemoryCandidate) => { await localMemoryProvider.rejectCandidate(candidate.id); await load(); };

  const removeMemory = (id: string) => Alert.alert('حذف الذاكرة؟', 'سيتم حذف هذه المعلومة من جهازك ولا يمكن التراجع عن ذلك.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: async () => { await localMemoryProvider.remove(id); await load(); } }]);
  const clearMemory = () => Alert.alert('حذف الذاكرة بالكامل؟', 'سيتم حذف كل العناصر المحفوظة محليًا.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف الكل', style: 'destructive', onPress: async () => { await localMemoryProvider.clear(); await load(); } }]);
  const toggleMemory = async (enabled: boolean) => { const next = { ...settings, enabled }; setSettings(next); await localMemoryProvider.saveSettings(next); };

  return <View style={styles.screen}><View style={{ flexDirection: 'row', alignItems: 'flex-start' }}><View style={{ flex: 1 }}><ScreenHeader eyebrow="LIVING MEMORY" title="ذاكرة مرشد AI" detail="أنت من يقرر ما يحفظه مرشد AI ويستخدمه عند الإجابة." /></View>{onBackToAssistant ? <Pressable accessibilityLabel="العودة إلى محادثة مرشد AI" onPress={onBackToAssistant} style={{ height: 40, paddingHorizontal: spacing.sm, borderRadius: radii.md, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.line }}><Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.tealDark} /><Text style={{ ...typography.label, color: colors.tealDark, fontSize: 11 }}>المحادثة</Text></Pressable> : null}</View><View style={styles.controlCard}><View style={styles.controlRow}><View style={styles.controlCopy}><Text style={styles.controlTitle}>ذاكرة مرشد AI مفعّلة</Text><Text style={styles.controlDetail}>لن تُحفظ معلومة جديدة عند إيقافها.</Text></View><Switch value={settings.enabled} onValueChange={toggleMemory} trackColor={{ false: colors.line, true: colors.tealSoft }} thumbColor={settings.enabled ? colors.tealDark : colors.inkFaint} /></View><View style={styles.privacyNote}><Ionicons name="shield-checkmark-outline" size={17} color={colors.tealDark} /><Text style={styles.privacyText}>تُحفظ البيانات على جهازك. عند تفعيل الذاكرة، لا يُرسل لمزودك إلا ما يرتبط بسؤالك.</Text></View></View><View style={styles.searchRow}><Ionicons name="search-outline" size={19} color={colors.inkMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="ابحث في ذاكرتك..." placeholderTextColor={colors.inkFaint} style={styles.searchInput} /></View><View style={styles.actionsRow}><Pressable onPress={() => setShowComposer((value) => !value)} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><Ionicons name="add" size={19} color={colors.paper} /><Text style={styles.addText}>إضافة معلومة</Text></Pressable><Pressable onPress={clearMemory} disabled={!items.length} style={({ pressed }) => [styles.clearButton, !items.length && styles.disabled, pressed && styles.pressed]}><Ionicons name="trash-outline" size={17} color={colors.danger} /><Text style={styles.clearText}>حذف الكل</Text></Pressable></View>{candidates.length ? <View style={styles.candidatesCard}><View style={styles.candidatesHeader}><Ionicons name="bulb-outline" size={18} color={colors.tealDark} /><Text style={styles.candidatesTitle}>اقتراحات مرشد AI للمراجعة</Text></View><Text style={styles.candidatesBody}>لن تُحفظ هذه الاقتراحات إلا بعد موافقتك.</Text>{candidates.map((candidate) => <View key={candidate.id} style={styles.candidateRow}><Text style={styles.candidateText}>{candidate.content}</Text><Text style={styles.candidateMeta}>{candidate.suggestedAction === 'update' ? 'سيحدّث ذكرى متعارضة بعد موافقتك.' : candidate.suggestedExpiration ? 'معلومة مؤقتة؛ تنتهي تلقائيًا خلال 7 أيام.' : 'اقتراح جديد؛ لن يُحفظ دون موافقتك.'}</Text><View style={styles.candidateActions}><Pressable onPress={() => rejectCandidate(candidate)} style={styles.rejectButton}><Text style={styles.rejectText}>تجاهل</Text></Pressable><Pressable onPress={() => approveCandidate(candidate)} style={styles.approveButton}><Text style={styles.approveText}>حفظ</Text></Pressable></View></View>)}</View> : null}{showComposer ? <View style={styles.composer}><Text style={styles.composerTitle}>ما الذي تريد أن يتذكره مرشد AI؟</Text><TextInput value={draft} onChangeText={setDraft} placeholder="مثال: أفضل المذاكرة صباحًا" placeholderTextColor={colors.inkFaint} multiline style={styles.memoryInput} /><View style={styles.typeRow}>{types.map((type) => <Pressable key={type} onPress={() => setSelectedType(type)} style={[styles.typeChip, selectedType === type && styles.selectedChip]}><Text style={[styles.typeText, selectedType === type && styles.selectedTypeText]}>{typeLabels[type]}</Text></Pressable>)}</View><Pressable onPress={addMemory} disabled={!draft.trim() || !settings.enabled} style={[styles.saveButton, (!draft.trim() || !settings.enabled) && styles.disabled]}><Text style={styles.saveText}>حفظ بموافقتي</Text></Pressable></View> : null}<FlatList data={visibleItems} keyExtractor={(item) => item.id} refreshing={loading} onRefresh={refresh} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.empty}><Ionicons name="sparkles-outline" size={30} color={colors.inkFaint} /><Text style={styles.emptyTitle}>{query ? 'لا توجد نتائج' : 'لسه مفيش ذاكرة محفوظة'}</Text><Text style={styles.emptyBody}>{query ? 'جرّب كلمة بحث مختلفة.' : 'أضف معلومة مهمة، واحتفظ بها بموافقتك.'}</Text></View>} renderItem={({ item }) => <View style={styles.memoryCard}><View style={styles.memoryTop}><View style={styles.badge}><Text style={styles.badgeText}>{typeLabels[item.type]}</Text></View><Pressable accessibilityLabel="حذف الذاكرة" onPress={() => removeMemory(item.id)}><Ionicons name="ellipsis-horizontal" size={20} color={colors.inkFaint} /></Pressable></View><Text style={styles.memoryContent}>{item.content}</Text><Text style={styles.memoryMeta}>حُفظت بموافقتك · {new Date(item.createdAt).toLocaleDateString('ar-EG')}</Text></View>} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg }, controlCard: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.line }, controlRow: { flexDirection: 'row', alignItems: 'center' }, controlCopy: { flex: 1 }, controlTitle: { ...typography.label, color: colors.ink }, controlDetail: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 3 }, privacyNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line }, privacyText: { ...typography.body, color: colors.inkMuted, fontSize: 12 }, searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.paper, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.sm, marginTop: spacing.md }, searchInput: { flex: 1, color: colors.ink, paddingHorizontal: spacing.sm, minHeight: 44, ...typography.body }, actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }, addButton: { flex: 1, height: 44, borderRadius: radii.md, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }, addText: { ...typography.label, color: colors.paper }, clearButton: { height: 44, borderRadius: radii.md, backgroundColor: colors.coralSoft, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, clearText: { ...typography.label, color: colors.danger }, candidatesCard: { backgroundColor: colors.tealSoft, borderRadius: radii.lg, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.tealSoft }, candidatesHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, candidatesTitle: { ...typography.label, color: colors.tealDark }, candidatesBody: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 4 }, candidateRow: { backgroundColor: colors.paper, borderRadius: radii.md, padding: spacing.sm, marginTop: spacing.sm }, candidateText: { ...typography.body, color: colors.ink }, candidateMeta: { ...typography.body, color: colors.inkMuted, fontSize: 11, marginTop: 3 }, candidateActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs, marginTop: spacing.xs }, rejectButton: { paddingHorizontal: spacing.sm, paddingVertical: 6 }, rejectText: { ...typography.label, color: colors.danger, fontSize: 11 }, approveButton: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.tealDark }, approveText: { ...typography.label, color: colors.paper, fontSize: 11 }, composer: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.line }, composerTitle: { ...typography.label, color: colors.ink, marginBottom: spacing.sm }, memoryInput: { minHeight: 80, color: colors.ink, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.sm, textAlignVertical: 'top', ...typography.body }, typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm }, typeChip: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.surface }, selectedChip: { backgroundColor: colors.tealSoft }, typeText: { ...typography.label, color: colors.inkMuted, fontSize: 11 }, selectedTypeText: { color: colors.tealDark }, saveButton: { height: 44, borderRadius: radii.md, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md }, saveText: { ...typography.label, color: colors.paper }, list: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm }, memoryCard: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.line }, memoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, badge: { backgroundColor: colors.tealSoft, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 }, badgeText: { ...typography.label, color: colors.tealDark, fontSize: 10 }, memoryContent: { ...typography.body, color: colors.ink, marginTop: spacing.sm }, memoryMeta: { ...typography.body, color: colors.inkFaint, fontSize: 11, marginTop: spacing.sm }, empty: { alignItems: 'center', paddingVertical: spacing.xxl }, emptyTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.sm }, emptyBody: { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.xs }, pressed: { opacity: 0.75 }, disabled: { opacity: 0.45 },
});
