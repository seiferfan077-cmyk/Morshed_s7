import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, View } from 'react-native';
import { RuqaaText as Text } from '../components/RuqaaText';
import { useAppTheme } from '../theme/ThemeProvider';
import { radii, spacing, ThemeColors, typography } from '../theme';

type QuranVerse = {
  index: number;
  text: string;
  bismillah?: string;
};

type QuranSurah = {
  index: number;
  name: string;
  verses: QuranVerse[];
};

type QuranDataset = {
  source: {
    title: string;
    copyright: string;
    license: string;
    url: string;
    downloadUrl: string;
    updatesUrl: string;
    notice: string;
  };
  surahs: QuranSurah[];
};

const TANZIL_URL = 'https://tanzil.net/updates/';
const TANZIL_LICENSE_URL = 'https://tanzil.net/docs/text_license';

export function QuranReader({ onClose }: { onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const quranData = useMemo(() => require('../data/quran-uthmani.json') as QuranDataset, []);
  const [query, setQuery] = useState('');
  const [selectedSurahIndex, setSelectedSurahIndex] = useState<number | null>(null);
  const [fontSize, setFontSize] = useState(28);

  const filteredSurahs = useMemo(() => {
    const normalizedQuery = normalizeArabic(query.trim());
    if (!normalizedQuery) return quranData.surahs;
    return quranData.surahs.filter((surah) => (
      normalizeArabic(surah.name).includes(normalizedQuery)
      || String(surah.index).includes(normalizedQuery)
    ));
  }, [query, quranData.surahs]);

  const selectedSurah = selectedSurahIndex === null
    ? null
    : quranData.surahs[selectedSurahIndex - 1] ?? null;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedSurahIndex !== null) {
        setSelectedSurahIndex(null);
        return true;
      }
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, selectedSurahIndex]);

  if (selectedSurah) {
    const bismillah = selectedSurah.verses[0]?.bismillah;
    return (
      <View style={styles.screen}>
        <View style={styles.readerHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="العودة إلى قائمة السور"
            onPress={() => setSelectedSurahIndex(null)}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back-outline" size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.readerTitleCopy}>
            <Text style={styles.readerTitle}>سورة {selectedSurah.name}</Text>
            <Text style={styles.readerSubtitle}>
              {toArabicDigits(selectedSurah.verses.length)} آية · نص متاح دون اتصال
            </Text>
          </View>
          <View style={styles.fontControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="تصغير خط الآيات"
              accessibilityState={{ disabled: fontSize <= 22 }}
              disabled={fontSize <= 22}
              onPress={() => setFontSize((value) => Math.max(22, value - 2))}
              style={({ pressed }) => [styles.fontButton, pressed && styles.pressed]}
            >
              <Ionicons name="remove-outline" size={19} color={fontSize <= 22 ? colors.inkFaint : colors.tealDark} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="تكبير خط الآيات"
              accessibilityState={{ disabled: fontSize >= 38 }}
              disabled={fontSize >= 38}
              onPress={() => setFontSize((value) => Math.min(38, value + 2))}
              style={({ pressed }) => [styles.fontButton, pressed && styles.pressed]}
            >
              <Ionicons name="add-outline" size={19} color={fontSize >= 38 ? colors.inkFaint : colors.tealDark} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          key={selectedSurah.index}
          style={styles.readerScroll}
          contentContainerStyle={styles.readerContent}
          showsVerticalScrollIndicator={false}
        >
          {bismillah && (
            <View style={styles.basmalaCard}>
              <NativeText style={styles.basmalaText}>{bismillah}</NativeText>
            </View>
          )}

          <View style={styles.versesCard}>
            {selectedSurah.verses.map((verse) => (
              <View key={`${selectedSurah.index}:${verse.index}`} style={styles.verseRow}>
                <NativeText
                  selectable
                  style={[styles.verseText, { fontSize, lineHeight: Math.round(fontSize * 1.95) }]}
                >
                  {verse.text}
                </NativeText>
                <View style={styles.ayahNumber}>
                  <Text style={styles.ayahNumberText}>{toArabicDigits(verse.index)}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.surahNavigation}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="السورة السابقة"
              disabled={selectedSurah.index <= 1}
              onPress={() => setSelectedSurahIndex(selectedSurah.index - 1)}
              style={({ pressed }) => [styles.surahNavButton, selectedSurah.index <= 1 && styles.disabledButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back-outline" size={18} color={selectedSurah.index <= 1 ? colors.inkFaint : colors.tealDark} />
              <Text style={styles.surahNavText}>السابقة</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="السورة التالية"
              disabled={selectedSurah.index >= 114}
              onPress={() => setSelectedSurahIndex(selectedSurah.index + 1)}
              style={({ pressed }) => [styles.surahNavButton, selectedSurah.index >= 114 && styles.disabledButton, pressed && styles.pressed]}
            >
              <Text style={styles.surahNavText}>التالية</Text>
              <Ionicons name="chevron-forward-outline" size={18} color={selectedSurah.index >= 114 ? colors.inkFaint : colors.tealDark} />
            </Pressable>
          </View>
          <SourceAttribution styles={styles} colors={colors} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="العودة إلى المميزات"
          onPress={onClose}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back-outline" size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>مُرشد · مكتبة القراءة</Text>
          <Text style={styles.title}>القرآن الكريم</Text>
          <Text style={styles.subtitle}>تصفّح السور واقرأ النص كاملًا دون اتصال بالإنترنت.</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="book-outline" size={25} color={colors.tealDark} />
        </View>
      </View>

      <View style={styles.sourceCard}>
        <View style={styles.sourceIcon}>
          <Ionicons name="cloud-offline-outline" size={19} color={colors.tealDark} />
        </View>
        <View style={styles.sourceCopy}>
          <Text style={styles.sourceTitle}>مصحف نصّي يعمل دون اتصال</Text>
          <Text style={styles.sourceDetail}>النص العثماني من مشروع Tanzil، محفوظ دون تعديل.</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="زيارة مشروع Tanzil ومتابعة تحديثات النص"
            onPress={() => { void Linking.openURL(TANZIL_LICENSE_URL).catch(() => undefined); }}
          >
            <Text style={styles.sourceLink}>المصدر والترخيص · Tanzil</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color={colors.inkFaint} />
        <TextInput
          accessibilityLabel="البحث عن سورة"
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث باسم السورة أو رقمها"
          placeholderTextColor={colors.inkFaint}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="مسح البحث"
            onPress={() => setQuery('')}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={19} color={colors.inkFaint} />
          </Pressable>
        )}
      </View>

      <View style={styles.listHeading}>
        <Text style={styles.listTitle}>السور</Text>
        <Text style={styles.listCount}>{toArabicDigits(filteredSurahs.length)} من ١١٤</Text>
      </View>

      <ScrollView
        style={styles.surahList}
        contentContainerStyle={styles.surahListContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {filteredSurahs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={25} color={colors.inkFaint} />
            <Text style={styles.emptyTitle}>لا توجد سورة بهذا الاسم</Text>
            <Text style={styles.emptyDetail}>جرّب البحث باسم أقصر أو برقم السورة.</Text>
          </View>
        ) : filteredSurahs.map((surah) => (
          <Pressable
            key={surah.index}
            accessibilityRole="button"
            accessibilityLabel={`فتح سورة ${surah.name}، ${surah.verses.length} آية`}
            onPress={() => setSelectedSurahIndex(surah.index)}
            style={({ pressed }) => [styles.surahCard, pressed && styles.pressed]}
          >
            <View style={styles.surahNumber}>
              <Text style={styles.surahNumberText}>{toArabicDigits(surah.index)}</Text>
            </View>
            <View style={styles.surahCopy}>
              <Text style={styles.surahName}>سورة {surah.name}</Text>
              <Text style={styles.surahDetail}>{toArabicDigits(surah.verses.length)} آية</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={19} color={colors.inkFaint} />
          </Pressable>
        ))}
        <SourceAttribution styles={styles} colors={colors} />
      </ScrollView>
    </View>
  );
}

function SourceAttribution({ styles, colors }: { styles: ReturnType<typeof createStyles>; colors: ThemeColors }) {
  return (
    <View style={styles.readerAttribution}>
      <Text style={styles.readerAttributionText}>نص القرآن: مشروع Tanzil · الإصدار العثماني 1.1 · CC BY 3.0</Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="زيارة موقع Tanzil لمتابعة تغييرات النص"
        onPress={() => { void Linking.openURL(TANZIL_URL).catch(() => undefined); }}
      >
        <Text style={[styles.sourceLink, { color: colors.tealDark }]}>زيارة Tanzil ومتابعة التحديثات</Text>
      </Pressable>
    </View>
  );
}

function normalizeArabic(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .toLowerCase();
}

function toArabicDigits(value: number) {
  const digits = '٠١٢٣٤٥٦٧٨٩';
  return String(value).replace(/\d/g, (digit) => digits[Number(digit)]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
    headerButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    headerCopy: { flex: 1 },
    eyebrow: { ...typography.label, color: colors.tealDark, fontSize: 11 },
    title: { ...typography.display, color: colors.ink, fontSize: 27, lineHeight: 34, marginTop: 1 },
    subtitle: { ...typography.body, color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 2 },
    headerIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
    sourceCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.tealSoft, marginBottom: spacing.md },
    sourceIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
    sourceCopy: { flex: 1, marginHorizontal: spacing.sm },
    sourceTitle: { ...typography.label, color: colors.ink },
    sourceDetail: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 2 },
    sourceLink: { ...typography.label, color: colors.tealDark, fontSize: 11, marginTop: 5, textDecorationLine: 'underline' },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.paper, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, minHeight: 48, gap: spacing.sm },
    searchInput: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 22, textAlign: 'right', writingDirection: 'rtl', paddingVertical: 8 },
    listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.xs },
    listTitle: { ...typography.h2, color: colors.ink },
    listCount: { ...typography.label, color: colors.inkMuted },
    surahList: { flex: 1 },
    surahListContent: { paddingBottom: spacing.xl },
    surahCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
    surahNumber: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
    surahNumberText: { ...typography.label, color: colors.tealDark, fontSize: 14 },
    surahCopy: { flex: 1, marginHorizontal: spacing.md },
    surahName: { ...typography.h2, color: colors.ink, fontSize: 17, textAlign: 'right' },
    surahDetail: { ...typography.body, color: colors.inkMuted, fontSize: 11, marginTop: 1, textAlign: 'right' },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.md, backgroundColor: colors.paper, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line },
    emptyTitle: { ...typography.h2, color: colors.ink, marginTop: spacing.sm },
    emptyDetail: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 4, textAlign: 'center' },
    readerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.md, paddingBottom: spacing.sm },
    readerTitleCopy: { flex: 1, marginHorizontal: spacing.xs },
    readerTitle: { ...typography.h2, color: colors.ink, fontSize: 18 },
    readerSubtitle: { ...typography.body, color: colors.inkMuted, fontSize: 11, marginTop: 2 },
    fontControls: { flexDirection: 'row', gap: 5 },
    fontButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    readerScroll: { flex: 1 },
    readerContent: { paddingBottom: spacing.xl },
    basmalaCard: { alignItems: 'center', padding: spacing.md, marginBottom: spacing.md, borderRadius: radii.lg, backgroundColor: colors.tealSoft, borderWidth: 1, borderColor: colors.line },
    basmalaText: { color: colors.ink, fontSize: 26, lineHeight: 46, textAlign: 'center', writingDirection: 'rtl' },
    versesCard: { backgroundColor: colors.paper, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    verseRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
    verseText: { color: colors.ink, textAlign: 'right', writingDirection: 'rtl' },
    ayahNumber: { alignSelf: 'flex-start', minWidth: 27, height: 27, borderRadius: 10, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
    ayahNumberText: { ...typography.label, color: colors.tealDark, fontSize: 11 },
    surahNavigation: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.md },
    surahNavButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md },
    surahNavText: { ...typography.label, color: colors.ink },
    disabledButton: { opacity: 0.45 },
    readerAttribution: { alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
    readerAttributionText: { ...typography.body, color: colors.inkMuted, fontSize: 10, textAlign: 'center' },
    pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  });
}
