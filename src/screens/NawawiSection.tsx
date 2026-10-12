import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { SurfaceCard } from '../components/SurfaceCard';
import { radii, spacing, typography, ThemeColors } from '../theme';

type Hadith = { index: number; title: string; hadith: string; explanation: string };
type HadithData = { source: { title: string; url: string; notice: string }; hadiths: Hadith[] };
type Collection = { id: string; title: string; tradition: string; availability: string; url: string; note: string };
type LibraryData = { sourcePolicy: string; officialSite: string; collections: Collection[] };
const DATA = require('../data/nawawi-forty.json') as HadithData;
const LIBRARY = require('../data/hadith-library.json') as LibraryData;

type StatusFilter = 'all' | 'sound' | 'disputed' | 'followed';
function normalize(value: string) {
  return value.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06EDـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').toLowerCase();
}
function digits(value: number) { return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]); }
function hadithBody(item: Hadith) { return item.hadith.replace(/^الحديث[^\n]*\n\n?/, '').trim(); }
function escapeXml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function createSvg(item: Hadith) {
  const lines = `${item.title}\n\n${hadithBody(item)}\n\nفريق مطورين مُرشد\n${LIBRARY.officialSite}`.split('\n');
  const text = lines.map((line, index) => `<text x="900" y="${125 + index * 42}" text-anchor="end" direction="rtl">${escapeXml(line || ' ')}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${Math.max(620, 170 + lines.length * 42)}" viewBox="0 0 1000 ${Math.max(620, 170 + lines.length * 42)}"><rect width="100%" height="100%" fill="#fbf8f1"/><rect x="28" y="28" width="944" height="calc(100% - 56px)" rx="28" fill="#ffffff" stroke="#147d78" stroke-width="4"/><text x="900" y="82" text-anchor="end" direction="rtl" font-family="sans-serif" font-size="30" font-weight="700" fill="#147d78">مُرشد · حديث</text><g font-family="sans-serif" font-size="25" fill="#10212b">${text}</g></svg>`;
}

export function NawawiSection({ colors }: { colors: ThemeColors }) {
  const styles = createStyles(colors);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(1);
  const [selectedCollection, setSelectedCollection] = useState('nawawi');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const localCollection = LIBRARY.collections.find((item) => item.id === selectedCollection) ?? LIBRARY.collections[10];
  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    if (selectedCollection !== 'nawawi') return [];
    if (status === 'sound' || status === 'disputed') return [];
    if (!term) return DATA.hadiths;
    return DATA.hadiths.filter((item) => normalize(`${item.index} ${item.title} ${item.hadith} ${item.explanation}`).includes(term));
  }, [query, selectedCollection, status]);
  const selected = filtered.find((item) => item.index === selectedIndex) ?? filtered[0] ?? DATA.hadiths[0];
  const showNotice = (message: string) => { setNotice(message); setTimeout(() => setNotice(null), 3500); };
  const shareText = async () => { await Share.share({ message: `${selected.title}\n\n${hadithBody(selected)}\n\nالمصدر: ${DATA.source.title}\nفريق مطورين مُرشد\n${LIBRARY.officialSite}` }); };
  const readAloud = () => { Speech.stop(); Speech.speak(`${selected.title}. ${hadithBody(selected)}`, { language: 'ar-SA', rate: 0.85 }); };
  const shareImage = async () => {
    const directory = FileSystem.cacheDirectory;
    if (!directory) { showNotice('تعذر إنشاء ملف الصورة على هذا الجهاز.'); return; }
    const uri = `${directory}murshid-hadith-${selected.index}.svg`;
    await FileSystem.writeAsStringAsync(uri, createSvg(selected), { encoding: FileSystem.EncodingType.UTF8 });
    await Share.share({ url: uri, message: 'حديث من مُرشد — ملف صورة SVG قابل للمشاركة' });
  };
  const openCollection = async () => { await Linking.openURL(localCollection.url); };

  return (
    <>
      <Text style={styles.sectionTitle}>مكتبة الأحاديث النبوية</Text>
      <SurfaceCard accent={colors.amber}>
        <View style={styles.heading}><View style={styles.icon}><Ionicons name="library-outline" size={21} color={colors.amber} /></View><View style={styles.headingCopy}><Text style={styles.title}>مصادر الحديث مع توثيق الحكم</Text><Text style={styles.detail}>كتالوج للمجموعات، ونص محلي موثق للأربعين النووية، دون ادعاء اكتمال ما لم يثبت مصدره وترخيصه.</Text></View></View>
      </SurfaceCard>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {LIBRARY.collections.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => { setSelectedCollection(item.id); setSelectedIndex(1); }} style={[styles.collectionChip, selectedCollection === item.id && styles.selectedCollection]}><Text style={[styles.chipText, selectedCollection === item.id && styles.selectedChipText]}>{item.title}</Text></Pressable>)}
      </ScrollView>
      <SurfaceCard>
        <View style={styles.collectionHeader}><View style={styles.collectionCopy}><Text style={styles.collectionTitle}>{localCollection.title}</Text><Text style={styles.detail}>{localCollection.availability} · {localCollection.tradition}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="فتح المصدر الخارجي" onPress={openCollection} style={styles.sourceButton}><Ionicons name="open-outline" size={17} color={colors.tealDark} /><Text style={styles.sourceButtonText}>المصدر</Text></Pressable></View>
        <Text style={styles.source}>{localCollection.note}</Text>
      </SurfaceCard>
      <View style={styles.searchBox}><Ionicons name="search-outline" size={19} color={colors.inkFaint} /><TextInput accessibilityLabel="البحث في الأحاديث" value={query} onChangeText={setQuery} placeholder="ابحث برقم الحديث أو عنوانه أو نصه" placeholderTextColor={colors.inkFaint} style={styles.searchInput} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {([['all', 'الكل'], ['sound', 'صحيح'], ['disputed', 'مختلف في تصحيحه'], ['followed', 'مختارات متبعة']] as [StatusFilter, string][]).map(([key, label]) => <Pressable key={key} onPress={() => setStatus(key)} style={[styles.filterChip, status === key && styles.selectedChip]}><Text style={[styles.chipText, status === key && styles.selectedChipText]}>{label}</Text></Pressable>)}
      </ScrollView>
      {selectedCollection !== 'nawawi' ? <SurfaceCard><Ionicons name="information-circle-outline" size={22} color={colors.tealDark} /><Text style={styles.empty}>هذه المجموعة متاحة كمصدر خارجي حاليًا. افتح المصدر لقراءة نسخته، ولا ننسب حكمًا موحدًا لكل رواياتها.</Text></SurfaceCard> : filtered.length === 0 ? <Text style={styles.empty}>لا توجد نتائج في هذا التصنيف المحلي. اختر «الكل» أو مجموعة أخرى.</Text> : <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {filtered.map((item) => <Pressable key={item.index} onPress={() => setSelectedIndex(item.index)} style={[styles.chip, selected.index === item.index && styles.selectedChip]}><Text style={[styles.chipText, selected.index === item.index && styles.selectedChipText]}>{digits(item.index)} · {item.title}</Text></Pressable>)}
        </ScrollView>
        <SurfaceCard>
          <Text style={styles.hadithNumber}>مختارات متبعة · الحديث {digits(selected.index)}</Text>
          <Text style={styles.hadithTitle}>{selected.title}</Text>
          <Text selectable style={styles.hadithText}>{hadithBody(selected)}</Text>
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" onPress={shareText} style={styles.actionButton}><Ionicons name="copy-outline" size={17} color={colors.tealDark} /><Text style={styles.actionText}>نسخ/مشاركة</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={readAloud} style={styles.actionButton}><Ionicons name="volume-high-outline" size={17} color={colors.tealDark} /><Text style={styles.actionText}>قراءة</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { void shareImage(); }} style={styles.actionButton}><Ionicons name="image-outline" size={17} color={colors.tealDark} /><Text style={styles.actionText}>صورة</Text></Pressable>
          </View>
          <View style={styles.divider} /><Text style={styles.explanationHeading}>شرح وفوائد</Text><Text style={styles.explanation}>{selected.explanation}</Text>
          <Text style={styles.footer}>فريق مطورين مُرشد · {LIBRARY.officialSite}</Text>
        </SurfaceCard>
      </>}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Text style={styles.source}>{DATA.source.notice} المصدر المحلي: {DATA.source.title}. {LIBRARY.sourcePolicy}</Text>
    </>
  );
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  sectionTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.sm }, heading: { flexDirection: 'row', alignItems: 'center' }, icon: { width: 45, height: 45, borderRadius: 15, backgroundColor: colors.amberSoft, alignItems: 'center', justifyContent: 'center' }, headingCopy: { flex: 1, marginLeft: spacing.sm }, title: { ...typography.label, color: colors.ink }, detail: { ...typography.body, color: colors.inkMuted, marginTop: 4 }, list: { gap: spacing.xs, paddingVertical: spacing.sm }, collectionChip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 8 }, chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 7 }, filterChip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 7 }, selectedChip: { backgroundColor: colors.tealDark, borderColor: colors.tealDark }, selectedCollection: { backgroundColor: colors.tealSoft, borderColor: colors.tealDark }, chipText: { ...typography.label, color: colors.inkMuted, fontSize: 11 }, selectedChipText: { color: colors.paper }, collectionHeader: { flexDirection: 'row', alignItems: 'center' }, collectionCopy: { flex: 1 }, collectionTitle: { ...typography.h2, color: colors.ink, fontSize: 18 }, sourceButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, borderRadius: radii.md, backgroundColor: colors.tealSoft }, sourceButtonText: { ...typography.label, color: colors.tealDark, fontSize: 11 }, source: { ...typography.body, color: colors.inkFaint, fontSize: 10, marginTop: spacing.sm, lineHeight: 16 }, searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.paper, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, minHeight: 46, marginTop: spacing.sm }, searchInput: { flex: 1, color: colors.ink, textAlign: 'right', writingDirection: 'rtl', paddingVertical: 8 }, empty: { ...typography.body, color: colors.inkMuted, paddingVertical: spacing.md, textAlign: 'center', lineHeight: 24 }, hadithNumber: { ...typography.label, color: colors.tealDark }, hadithTitle: { ...typography.h2, color: colors.ink, marginTop: 3 }, hadithText: { ...typography.body, color: colors.ink, textAlign: 'right', lineHeight: 27, marginTop: spacing.md }, actionRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md }, actionButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing.sm, paddingVertical: 8 }, actionText: { ...typography.label, color: colors.tealDark, fontSize: 11 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.md }, explanationHeading: { ...typography.label, color: colors.tealDark }, explanation: { ...typography.body, color: colors.inkMuted, textAlign: 'right', lineHeight: 25, marginTop: spacing.xs }, footer: { ...typography.body, color: colors.inkFaint, fontSize: 10, marginTop: spacing.md, textAlign: 'right' }, notice: { ...typography.label, color: colors.tealDark, backgroundColor: colors.tealSoft, padding: spacing.sm, borderRadius: radii.md, marginTop: spacing.sm, textAlign: 'center' },
}); }
