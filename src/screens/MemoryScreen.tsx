import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radii, spacing, typography } from '../theme';
import { defaultMemorySettings, MemoryItem, MemorySettings, MemoryType } from '../types/memory';
import { localMemoryProvider } from '../services/memory/memoryService';

const typeLabels: Record<MemoryType, string> = { fact: 'معلومة', context: 'سياق', situation: 'موقف', habit: 'عادة', goal: 'هدف', preference: 'تفضيل' };
const types: MemoryType[] = ['fact', 'preference', 'context', 'habit', 'goal', 'situation'];

export function MemoryScreen() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [settings, setSettings] = useState<MemorySettings>(defaultMemorySettings);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [selectedType, setSelectedType] = useState<MemoryType>('fact');
  const [showComposer, setShowComposer] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [nextItems, nextSettings] = await Promise.all([localMemoryProvider.list(), localMemoryProvider.getSettings()]);
    setItems(nextItems);
    setSettings(nextSettings);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const removeMemory = (id: string) => Alert.alert('حذف الذاكرة؟', 'سيتم حذف هذه المعلومة من جهازك ولا يمكن التراجع عن ذلك.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: async () => { await localMemoryProvider.remove(id); await load(); } }]);
  const clearMemory = () => Alert.alert('حذف الذاكرة بالكامل؟', 'سيتم حذف كل العناصر المحفوظة محليًا.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف الكل', style: 'destructive', onPress: async () => { await localMemoryProvider.clear(); await load(); } }]);
  const toggleMemory = async (enabled: boolean) => { const next = { ...settings, enabled }; setSettings(next); await localMemoryProvider.saveSettings(next); };

  return <View style={styles.screen}><ScreenHeader eyebrow="LIVING MEMORY" title="ذاكرتي مع مرشد" detail="أنت من يقرر ما يتذكره مرشد عنك." /><View style={styles.controlCard}><View style={styles.controlRow}><View style={styles.controlCopy}><Text style={styles.controlTitle}>الذاكرة مفعّلة</Text><Text style={styles.controlDetail}>لن تُحفظ معلومة جديدة عند إيقافها.</Text></View><Switch value={settings.enabled} onValueChange={toggleMemory} trackColor={{ false: colors.line, true: colors.tealSoft }} thumbColor={settings.enabled ? colors.tealDark : colors.inkFaint} /></View><View style={styles.privacyNote}><Ionicons name="shield-checkmark-outline" size={17} color={colors.tealDark} /><Text style={styles.privacyText}>البيانات محفوظة محليًا على هذا الجهاز حاليًا.</Text></View></View><View style={styles.searchRow}><Ionicons name="search-outline" size={19} color={colors.inkMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="ابحث في ذاكرتك..." placeholderTextColor={colors.inkFaint} style={styles.searchInput} /></View><View style={styles.actionsRow}><Pressable onPress={() => setShowComposer((value) => !value)} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><Ionicons name="add" size={19} color={colors.paper} /><Text style={styles.addText}>إضافة معلومة</Text></Pressable><Pressable onPress={clearMemory} disabled={!items.length} style={({ pressed }) => [styles.clearButton, !items.length && styles.disabled, pressed && styles.pressed]}><Ionicons name="trash-outline" size={17} color={colors.danger} /><Text style={styles.clearText}>حذف الكل</Text></Pressable></View>{showComposer ? <View style={styles.composer}><Text style={styles.composerTitle}>ما الذي تريد أن يتذكره مرشد؟</Text><TextInput value={draft} onChangeText={setDraft} placeholder="مثال: أفضل المذاكرة صباحًا" placeholderTextColor={colors.inkFaint} multiline style={styles.memoryInput} /><View style={styles.typeRow}>{types.map((type) => <Pressable key={type} onPress={() => setSelectedType(type)} style={[styles.typeChip, selectedType === type && styles.selectedChip]}><Text style={[styles.typeText, selectedType === type && styles.selectedTypeText]}>{typeLabels[type]}</Text></Pressable>)}</View><Pressable onPress={addMemory} disabled={!draft.trim() || !settings.enabled} style={[styles.saveButton, (!draft.trim() || !settings.enabled) && styles.disabled]}><Text style={styles.saveText}>حفظ بموافقتي</Text></Pressable></View> : null}<FlatList data={visibleItems} keyExtractor={(item) => item.id} refreshing={loading} onRefresh={load} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.empty}><Ionicons name="sparkles-outline" size={30} color={colors.inkFaint} /><Text style={styles.emptyTitle}>{query ? 'لا توجد نتائج' : 'لسه مفيش ذاكرة محفوظة'}</Text><Text style={styles.emptyBody}>{query ? 'جرّب كلمة بحث مختلفة.' : 'أضف معلومة مهمة، واحتفظ بها بموافقتك.'}</Text></View>} renderItem={({ item }) => <View style={styles.memoryCard}><View style={styles.memoryTop}><View style={styles.badge}><Text style={styles.badgeText}>{typeLabels[item.type]}</Text></View><Pressable accessibilityLabel="حذف الذاكرة" onPress={() => removeMemory(item.id)}><Ionicons name="ellipsis-horizontal" size={20} color={colors.inkFaint} /></Pressable></View><Text style={styles.memoryContent}>{item.content}</Text><Text style={styles.memoryMeta}>حُفظت بموافقتك · {new Date(item.createdAt).toLocaleDateString('ar-EG')}</Text></View>} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg }, controlCard: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.line }, controlRow: { flexDirection: 'row', alignItems: 'center' }, controlCopy: { flex: 1 }, controlTitle: { ...typography.label, color: colors.ink }, controlDetail: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 3 }, privacyNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line }, privacyText: { ...typography.body, color: colors.inkMuted, fontSize: 12 }, searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.paper, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.sm, marginTop: spacing.md }, searchInput: { flex: 1, color: colors.ink, paddingHorizontal: spacing.sm, minHeight: 44, ...typography.body }, actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }, addButton: { flex: 1, height: 44, borderRadius: radii.md, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }, addText: { ...typography.label, color: colors.paper }, clearButton: { height: 44, borderRadius: radii.md, backgroundColor: colors.coralSoft, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, clearText: { ...typography.label, color: colors.danger }, composer: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.line }, composerTitle: { ...typography.label, color: colors.ink, marginBottom: spacing.sm }, memoryInput: { minHeight: 80, color: colors.ink, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.sm, textAlignVertical: 'top', ...typography.body }, typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm }, typeChip: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.surface }, selectedChip: { backgroundColor: colors.tealSoft }, typeText: { ...typography.label, color: colors.inkMuted, fontSize: 11 }, selectedTypeText: { color: colors.tealDark }, saveButton: { height: 44, borderRadius: radii.md, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md }, saveText: { ...typography.label, color: colors.paper }, list: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm }, memoryCard: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.line }, memoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, badge: { backgroundColor: colors.tealSoft, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 }, badgeText: { ...typography.label, color: colors.tealDark, fontSize: 10 }, memoryContent: { ...typography.body, color: colors.ink, marginTop: spacing.sm }, memoryMeta: { ...typography.body, color: colors.inkFaint, fontSize: 11, marginTop: spacing.sm }, empty: { alignItems: 'center', paddingVertical: spacing.xxl }, emptyTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.sm }, emptyBody: { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.xs }, pressed: { opacity: 0.75 }, disabled: { opacity: 0.45 },
});
