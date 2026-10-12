import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { SurfaceCard } from '../components/SurfaceCard';
import { radii, spacing, typography, ThemeColors } from '../theme';

type Reciter = { id: string; name: string; folder: string };
export const RECITERS: Reciter[] = [
  { id: 'alafasy', name: 'مشاري العفاسي', folder: 'Alafasy_128kbps' },
  { id: 'basit', name: 'عبد الباسط', folder: 'Abdul_Basit_Murattal_64kbps' },
  { id: 'husary', name: 'محمود خليل الحصري', folder: 'Husary_64kbps' },
  { id: 'minshawy', name: 'محمد صديق المنشاوي', folder: 'Minshawy_Murattal_128kbps' },
  { id: 'hany', name: 'هاني الرفاعي', folder: 'Hani_Rifai_64kbps' },
  { id: 'fares', name: 'فارس عباد', folder: 'Fares_Abbad_64kbps' },
  { id: 'ghamadi', name: 'سعد الغامدي', folder: 'Ghamadi_40kbps' },
  { id: 'hudhaify', name: 'علي الحذيفي', folder: 'Hudhaify_128kbps' },
  { id: 'maher', name: 'ماهر المعيقلي', folder: 'Maher_AlMuaiqly_64kbps' },
  { id: 'nasser', name: 'ناصر القطامي', folder: 'Nasser_Alqatami_128kbps' },
];

function audioUrl(folder: string, surahIndex: number) {
  return `https://everyayah.com/data/${folder}/${String(surahIndex).padStart(3, '0')}001.mp3`;
}
function time(seconds: number) { if (!Number.isFinite(seconds) || seconds <= 0) return '—'; return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }

export function QuranRecitationPlayer({ colors, surahIndex, surahName }: { colors: ThemeColors; surahIndex: number; surahName: string }) {
  const styles = createStyles(colors);
  const [reciterId, setReciterId] = useState(RECITERS[0].id);
  const reciter = RECITERS.find((item) => item.id === reciterId) ?? RECITERS[0];
  const source = useMemo(() => audioUrl(reciter.folder, surahIndex), [reciter.folder, surahIndex]);
  const player = useAudioPlayer(source, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    player.replace(source);
  }, [player, source]);

  return (
    <SurfaceCard accent={colors.tealDark}>
      <View style={styles.heading}><View style={styles.icon}><Ionicons name="musical-notes-outline" size={20} color={colors.tealDark} /></View><View style={styles.copy}><Text style={styles.title}>استماع إلى التلاوة</Text><Text style={styles.detail}>سورة {surahName} · عشرة قراء</Text></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reciterList} keyboardShouldPersistTaps="handled">
        {RECITERS.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`اختيار القارئ ${item.name}`} onPress={() => setReciterId(item.id)} style={[styles.reciterChip, item.id === reciter.id && styles.selectedChip]}><Text style={[styles.reciterText, item.id === reciter.id && styles.selectedText]}>{item.name}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.playerRow}><Pressable accessibilityRole="button" accessibilityLabel={status.playing ? 'إيقاف التلاوة' : 'تشغيل التلاوة'} onPress={() => status.playing ? player.pause() : player.play()} disabled={!status.isLoaded} style={[styles.playButton, !status.isLoaded && styles.disabled]}><Ionicons name={status.playing ? 'pause' : 'play'} size={20} color={colors.paper} /></Pressable><View style={styles.progressCopy}><Text style={styles.reciterName}>{reciter.name}</Text><Text style={styles.progress}>{time(status.currentTime)} / {time(status.duration)}{status.isBuffering ? ' · جارٍ التحميل' : ''}</Text></View></View>
      <Text style={styles.source}>الصوت يُحمّل عند الطلب من EveryAyah · يحتاج اتصالًا بالإنترنت.</Text>
    </SurfaceCard>
  );
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center' }, icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, marginLeft: spacing.sm }, title: { ...typography.label, color: colors.ink }, detail: { ...typography.body, color: colors.inkMuted, marginTop: 3 }, reciterList: { gap: spacing.xs, paddingVertical: spacing.sm }, reciterChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, backgroundColor: colors.paper, paddingHorizontal: spacing.sm, paddingVertical: 7 }, selectedChip: { backgroundColor: colors.tealDark, borderColor: colors.tealDark }, reciterText: { ...typography.label, color: colors.inkMuted, fontSize: 11 }, selectedText: { color: colors.paper }, playerRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }, playButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.5 }, progressCopy: { flex: 1, marginLeft: spacing.sm }, reciterName: { ...typography.label, color: colors.ink }, progress: { ...typography.body, color: colors.inkMuted, fontSize: 11, marginTop: 3 }, source: { ...typography.body, color: colors.inkFaint, fontSize: 10, marginTop: spacing.sm },
}); }
