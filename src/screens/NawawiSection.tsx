import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { SurfaceCard } from '../components/SurfaceCard';
import { radii, spacing, typography, ThemeColors } from '../theme';

type Hadith = { index: number; title: string; hadith: string; explanation: string };
type HadithData = { source: { title: string; url: string; notice: string }; hadiths: Hadith[] };
const DATA = require('../data/nawawi-forty.json') as HadithData;

function normalize(value: string) {
  return value.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').toLowerCase();
}
function digits(value: number) { return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]); }

export function NawawiSection({ colors }: { colors: ThemeColors }) {
  const styles = createStyles(colors);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(1);
  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return DATA.hadiths;
    return DATA.hadiths.filter((item) => normalize(`${item.index} ${item.title} ${item.hadith} ${item.explanation}`).includes(term));
  }, [query]);
  const selected = filtered.find((item) => item.index === selectedIndex) ?? filtered[0] ?? DATA.hadiths[0];

  return (
    <>
      <Text style={styles.sectionTitle}>الأربعون النووية</Text>
      <SurfaceCard accent={colors.amber}>
        <View style={styles.heading}><View style={styles.icon}><Ionicons name="book-outline" size={21} color={colors.amber} /></View><View style={styles.headingCopy}><Text style={styles.title}>أحاديث مع الشرح</Text><Text style={styles.detail}>ابحث في ٤٢ حديثًا، ثم افتح الحديث لقراءة متنه وشرح فوائده.</Text></View></View>
      </SurfaceCard>
      <View style={styles.searchBox}><Ionicons name="search-outline" size={19} color={colors.inkFaint} /><TextInput accessibilityLabel="البحث في الأربعين النووية" value={query} onChangeText={setQuery} placeholder="ابحث برقم الحديث أو عنوانه أو نصه" placeholderTextColor={colors.inkFaint} style={styles.searchInput} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {filtered.map((item) => <Pressable key={item.index} accessibilityRole="button" accessibilityLabel={`فتح الحديث ${item.index} ${item.title}`} onPress={() => setSelectedIndex(item.index)} style={[styles.chip, selected.index === item.index && styles.selectedChip]}><Text style={[styles.chipText, selected.index === item.index && styles.selectedChipText]}>{digits(item.index)} · {item.title}</Text></Pressable>)}
      </ScrollView>
      {filtered.length === 0 ? <Text style={styles.empty}>لا توجد نتائج. جرّب كلمة أخرى.</Text> : <SurfaceCard>
        <Text style={styles.hadithNumber}>الحديث {digits(selected.index)}</Text>
        <Text style={styles.hadithTitle}>{selected.title}</Text>
        <Text style={styles.hadithText}>{selected.hadith.replace(/^الحديث[^\n]*\n\n?/, '')}</Text>
        <View style={styles.divider} />
        <Text style={styles.explanationHeading}>شرح وفوائد</Text>
        <Text style={styles.explanation}>{selected.explanation}</Text>
      </SurfaceCard>}
      <Text style={styles.source}>المصدر المحلي: {DATA.source.title} · النص والشرح محفوظان للبحث دون اتصال.</Text>
    </>
  );
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  sectionTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'center' }, icon: { width: 45, height: 45, borderRadius: 15, backgroundColor: colors.amberSoft, alignItems: 'center', justifyContent: 'center' }, headingCopy: { flex: 1, marginLeft: spacing.sm }, title: { ...typography.label, color: colors.ink }, detail: { ...typography.body, color: colors.inkMuted, marginTop: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.paper, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, minHeight: 46, marginTop: spacing.sm }, searchInput: { flex: 1, color: colors.ink, textAlign: 'right', writingDirection: 'rtl', paddingVertical: 8 }, list: { gap: spacing.xs, paddingVertical: spacing.sm }, chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 7 }, selectedChip: { backgroundColor: colors.tealDark, borderColor: colors.tealDark }, chipText: { ...typography.label, color: colors.inkMuted, fontSize: 11 }, selectedChipText: { color: colors.paper },
  empty: { ...typography.body, color: colors.inkMuted, paddingVertical: spacing.md, textAlign: 'center' }, hadithNumber: { ...typography.label, color: colors.tealDark }, hadithTitle: { ...typography.h2, color: colors.ink, marginTop: 3 }, hadithText: { ...typography.body, color: colors.ink, textAlign: 'right', lineHeight: 27, marginTop: spacing.md }, divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.md }, explanationHeading: { ...typography.label, color: colors.tealDark }, explanation: { ...typography.body, color: colors.inkMuted, textAlign: 'right', lineHeight: 25, marginTop: spacing.xs }, source: { ...typography.body, color: colors.inkFaint, fontSize: 10, marginTop: spacing.sm },
}); }
