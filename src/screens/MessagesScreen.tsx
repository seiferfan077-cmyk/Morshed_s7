import { useAppTheme } from '../theme/ThemeProvider';
import { useCallback, useState } from 'react';
import { RuqaaText as Text, RuqaaTextInput } from '../components/RuqaaText';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, AppState, NativeModules, PermissionsAndroid, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { SurfaceCard } from '../components/SurfaceCard';
import { radii, spacing, typography, ThemeColors } from '../theme';

type SmsMessage = { id: string; address: string; body: string; date: number; read: boolean; threadId: string };
type SmsBridge = {
  isDefaultSmsApp: () => Promise<boolean>;
  getMessages: () => Promise<SmsMessage[]>;
  markAllMessagesRead: () => Promise<number>;
  deleteMessage?: (messageId: string) => Promise<number>;
};
type ScreenState = 'loading' | 'ready' | 'permission' | 'unavailable' | 'unsupported' | 'error';
const smsBridge = NativeModules.MurshidSms as SmsBridge | undefined;

export function MessagesScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isFocused = useIsFocused();
  const [state, setState] = useState<ScreenState>('loading');
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'android') { setState('unsupported'); return; }
    if (!smsBridge) { setState('unavailable'); return; }
    setRefreshing(true);
    try {
      const defaultStatus = await smsBridge.isDefaultSmsApp();
      setIsDefault(defaultStatus);
      const hasReadPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
      if (!hasReadPermission) { setState('permission'); return; }
      const received = await smsBridge.getMessages();
      setMessages(received);
      setDrafts((current) => Object.fromEntries(received.map((message) => [message.id, current[message.id] ?? message.body])));
      setState('ready');
      try {
        await smsBridge.markAllMessagesRead();
        setMessages(received.map((message) => ({ ...message, read: true })));
      } catch { /* Some Android versions permit reading without updating the provider. */ }
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'تعذر تحميل الرسائل من Android.');
      setState('error');
    } finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useFocusEffect(useCallback(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isFocused) void refresh();
    });
    return () => subscription.remove();
  }, [isFocused, refresh]));

  const requestSmsRole = useCallback(async () => {
    try { await IntentLauncher.startActivityAsync('com.murshid.s7.REQUEST_SMS_ROLE'); await refresh(); }
    catch { setErrorMessage('تعذر فتح إعداد تطبيق الرسائل الافتراضي.'); setState('error'); }
  }, [refresh]);

  const requestReadPermission = useCallback(async () => {
    try {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
        title: 'السماح بقراءة الرسائل',
        message: 'يحتاج مُرشد إلى إذن SMS لعرض الرسائل الواردة على الجهاز.',
        buttonPositive: 'السماح', buttonNegative: 'رفض', buttonNeutral: 'لاحقًا',
      });
      if (result === PermissionsAndroid.RESULTS.GRANTED) await refresh(); else setState('permission');
    } catch { setState('permission'); }
  }, [refresh]);

  const copyMessage = useCallback(async (message: SmsMessage) => {
    await Clipboard.setStringAsync(drafts[message.id] ?? message.body);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId((current) => current === message.id ? null : current), 1600);
  }, [drafts]);

  const deleteMessage = useCallback((message: SmsMessage) => {
    if (!isDefault || !smsBridge?.deleteMessage) {
      Alert.alert('الحذف يحتاج صلاحية إضافية', 'يمكنك قراءة ونسخ الرسائل دون جعل مُرشد التطبيق الافتراضي. حذف رسالة من صندوق Android يتطلب أولًا اختيار مُرشد كتطبيق الرسائل الافتراضي.');
      return;
    }
    Alert.alert('حذف الرسالة؟', 'سيتم حذفها من صندوق الرسائل على الجهاز.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try {
          await smsBridge.deleteMessage?.(message.id);
          setMessages((current) => current.filter((item) => item.id !== message.id));
          setDrafts((current) => { const next = { ...current }; delete next[message.id]; return next; });
        } catch { Alert.alert('تعذر الحذف', 'لم يسمح Android بحذف هذه الرسالة.'); }
      } },
    ]);
  }, [isDefault]);

  let gate = null;
  if (state === 'permission') gate = <SurfaceCard accent={colors.blue}><Text style={styles.cardTitle}>اسمح بقراءة صندوق الرسائل</Text><Text style={styles.cardBody}>قراءة SMS اختيارية وتعمل دون جعل مُرشد تطبيق الرسائل الافتراضي.</Text><ActionButton onPress={() => void requestReadPermission()}>السماح بقراءة SMS</ActionButton></SurfaceCard>;
  else if (state === 'unavailable') gate = <SurfaceCard accent={colors.coral}><Text style={styles.cardTitle}>يلزم تثبيت نسخة Android كاملة</Text><Text style={styles.cardBody}>قراءة SMS تعتمد على كود Android أصلي، لذلك لا تعمل في Expo Go أو iPhone.</Text></SurfaceCard>;
  else if (state === 'unsupported') gate = <SurfaceCard><Text style={styles.cardTitle}>قسم الرسائل متاح على Android</Text><Text style={styles.cardBody}>قراءة SMS وإدارة صندوق الرسائل غير متاحتين في نسخة iOS.</Text></SurfaceCard>;
  else if (state === 'error') gate = <SurfaceCard accent={colors.coral}><Text style={styles.cardTitle}>تعذر تحميل الرسائل</Text><Text style={styles.cardBody}>{errorMessage || 'تحقق من إذن SMS ثم أعد المحاولة.'}</Text><ActionButton tone="quiet" onPress={() => void refresh()}>إعادة المحاولة</ActionButton></SurfaceCard>;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.tealDark} />}>
    <View style={styles.header}><View style={styles.headerIcon}><Ionicons name="chatbubbles" size={24} color={colors.tealDark} /></View><Text style={styles.kicker}>MURSHID MESSAGES</Text><Text style={styles.title}>الرسائل</Text><Text style={styles.subtitle}>كل الرسائل الواردة مرتبة من الأحدث إلى الأقدم.</Text></View>
    {gate}
    {state === 'ready' && <SurfaceCard accent={isDefault ? colors.teal : colors.amber}><View style={styles.statusRow}><Ionicons name={isDefault ? 'shield-checkmark-outline' : 'information-circle-outline'} size={20} color={isDefault ? colors.tealDark : colors.amber} /><Text style={styles.statusText}>{isDefault ? 'مُرشد هو تطبيق الرسائل الافتراضي ويمكنك الحذف.' : 'وضع القراءة فقط: يمكنك فتح ونسخ كل الرسائل دون تغيير التطبيق الافتراضي.'}</Text></View>{!isDefault && <Pressable onPress={() => void requestSmsRole()}><Text style={styles.link}>اختياري: تفعيل الحذف والرد من مُرشد</Text></Pressable>}</SurfaceCard>}
    {state === 'loading' && <Text style={styles.loading}>جارٍ تحميل صندوق الرسائل…</Text>}
    {state === 'ready' && messages.length === 0 && <SurfaceCard><View style={styles.emptyIcon}><Ionicons name="mail-open-outline" size={28} color={colors.tealDark} /></View><Text style={styles.emptyTitle}>لا توجد رسائل واردة</Text><Text style={styles.cardBody}>ستظهر هنا الرسائل الموجودة في صندوق SMS على الجهاز.</Text></SurfaceCard>}
    {state === 'ready' && messages.map((message) => <SurfaceCard key={message.id}><View style={styles.messageHeader}><View style={styles.senderIcon}><Ionicons name="person-outline" size={19} color={colors.tealDark} /></View><View style={styles.senderDetails}><Text style={styles.sender} numberOfLines={1}>{message.address || 'رقم غير معروف'}</Text><Text style={styles.date}>{formatDate(message.date)}</Text></View>{!message.read && <View style={styles.unreadDot} />}</View><RuqaaTextInput multiline textAlignVertical="top" selectTextOnFocus={false} value={drafts[message.id] ?? message.body} onChangeText={(text) => setDrafts((current) => ({ ...current, [message.id]: text }))} style={styles.messageEditor} placeholder="نص الرسالة" placeholderTextColor={colors.inkFaint} /><View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => void copyMessage(message)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Ionicons name={copiedId === message.id ? 'checkmark-circle-outline' : 'copy-outline'} size={17} color={colors.tealDark} /><Text style={styles.actionText}>{copiedId === message.id ? 'تم النسخ' : 'نسخ النص'}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => deleteMessage(message)} style={({ pressed }) => [styles.action, styles.deleteAction, pressed && styles.pressed]}><Ionicons name="trash-outline" size={17} color={colors.coral} /><Text style={[styles.actionText, styles.deleteText]}>حذف</Text></Pressable></View></SurfaceCard>)}
    {state === 'ready' && messages.length > 0 && <Text style={styles.footer}>يمكن تحديد أي جزء من النص بالضغط المطوّل، أو نسخ الرسالة كاملة من الزر.</Text>}
  </ScrollView>;
}
function formatDate(timestamp: number) { if (!timestamp) return ''; try { return new Date(timestamp).toLocaleString('ar'); } catch { return ''; } }
function createStyles(colors: ThemeColors) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }, header: { alignItems: 'flex-start', marginBottom: spacing.sm }, headerIcon: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }, kicker: { ...typography.label, color: colors.tealDark, letterSpacing: 1.1 }, title: { ...typography.display, color: colors.ink, marginTop: 3 }, subtitle: { ...typography.body, color: colors.inkMuted, marginTop: spacing.xs }, cardTitle: { ...typography.h2, color: colors.ink, marginBottom: spacing.xs }, cardBody: { ...typography.body, color: colors.inkMuted, marginBottom: spacing.md }, loading: { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.xl }, statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, statusText: { ...typography.body, color: colors.inkMuted, flex: 1 }, link: { ...typography.label, color: colors.tealDark, marginTop: spacing.sm }, emptyIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.md }, emptyTitle: { ...typography.h2, color: colors.ink, textAlign: 'center', marginBottom: spacing.xs }, messageHeader: { flexDirection: 'row', alignItems: 'center' }, senderIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }, senderDetails: { flex: 1 }, sender: { ...typography.label, color: colors.ink, fontSize: 14 }, date: { ...typography.body, color: colors.inkFaint, fontSize: 12, marginTop: 2 }, unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal, marginLeft: spacing.sm }, messageEditor: { ...typography.body, color: colors.ink, marginTop: spacing.md, lineHeight: 27, minHeight: 60, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, textAlign: 'right', writingDirection: 'rtl' }, actions: { flexDirection: 'row', justifyContent: 'flex-start', gap: spacing.sm, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm }, action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 7, paddingHorizontal: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.tealSoft }, deleteAction: { backgroundColor: `${colors.coral}18` }, actionText: { ...typography.label, color: colors.tealDark, fontSize: 12 }, deleteText: { color: colors.coral }, pressed: { opacity: 0.68 }, footer: { ...typography.body, color: colors.inkFaint, fontSize: 12, textAlign: 'center', marginTop: spacing.sm }, }); }
