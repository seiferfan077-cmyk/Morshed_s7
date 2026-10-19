import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as IntentLauncher from 'expo-intent-launcher';
import { ActionButton } from '../components/ActionButton';
import { RuqaaText as Text } from '../components/RuqaaText';
import { SurfaceCard } from '../components/SurfaceCard';
import { useAppTheme } from '../theme/ThemeProvider';
import { radii, spacing, ThemeColors, typography } from '../theme';
import { AppState, Alert, NativeModules, PermissionsAndroid, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

type SmsMessage = {
  id: string;
  address: string;
  body: string;
  date: number;
  read: boolean;
  threadId: string;
};

type SmsBridge = {
  isDefaultSmsApp: () => Promise<boolean>;
  getMessages: () => Promise<SmsMessage[]>;
  deleteMessage: (messageId: string) => Promise<number>;
};

type ScreenState = 'loading' | 'ready' | 'permission' | 'unavailable' | 'unsupported' | 'error';
const smsBridge = NativeModules.MurshidSms as SmsBridge | undefined;

export function MessagesScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [state, setState] = useState<ScreenState>('loading');
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [isDefaultSmsApp, setIsDefaultSmsApp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setState('unsupported');
      return;
    }
    if (!smsBridge) {
      setState('unavailable');
      return;
    }
    setRefreshing(true);
    try {
      const defaultRole = await smsBridge.isDefaultSmsApp().catch(() => false);
      setIsDefaultSmsApp(defaultRole);
      const hasReadPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
      if (!hasReadPermission) {
        setMessages([]);
        setState('permission');
        return;
      }
      const received = await smsBridge.getMessages();
      setMessages([...received].sort((left, right) => right.date - left.date));
      setState('ready');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'تعذر تحميل الرسائل من Android.');
      setState('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]));

  const requestSmsRole = useCallback(async () => {
    try {
      await IntentLauncher.startActivityAsync('com.murshid.s7.REQUEST_SMS_ROLE');
      await refresh();
    } catch {
      setErrorMessage('تعذر فتح إعداد تطبيق الرسائل الافتراضي. يمكنك متابعة استخدام التطبيق بدونه.');
      setState('error');
    }
  }, [refresh]);

  const requestReadPermission = useCallback(async () => {
    try {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
        title: 'السماح بقراءة الرسائل',
        message: 'يستخدم مُرشد هذا الإذن لعرض صندوق SMS على جهازك. لن نطلب جعله التطبيق الافتراضي لمجرد القراءة، وقد تقيّد بعض الأجهزة أو سياسات المتجر هذا الإذن.',
        buttonPositive: 'السماح',
        buttonNegative: 'رفض',
        buttonNeutral: 'لاحقًا',
      });
      if (result === PermissionsAndroid.RESULTS.GRANTED) await refresh();
      else setState('permission');
    } catch {
      setState('permission');
    }
  }, [refresh]);

  const copyMessage = useCallback(async (body: string) => {
    try {
      await Clipboard.setStringAsync(body);
      Alert.alert('تم النسخ', 'أصبح نص الرسالة في الحافظة، ويمكنك لصقه في تطبيق الرسائل.');
    } catch {
      Alert.alert('تعذر النسخ', 'حاول تحديد نص الرسالة بالضغط المطوّل ثم اختر نسخ.');
    }
  }, []);

  const deleteMessage = useCallback((message: SmsMessage) => {
    if (!isDefaultSmsApp) {
      Alert.alert(
        'الحذف غير متاح الآن',
        'يسمح Android للتطبيق الافتراضي بإدارة رسائل صندوق SMS. يمكنك قراءة الرسالة ونسخها الآن، أو جعل مُرشد التطبيق الافتراضي اختياريًا لتفعيل الحذف.',
      );
      return;
    }
    Alert.alert('حذف الرسالة؟', 'سيحذفها مُرشد من صندوق الرسائل على هذا الجهاز.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await smsBridge?.deleteMessage(message.id);
              setMessages((current) => current.filter((item) => item.id !== message.id));
            } catch {
              Alert.alert('تعذر حذف الرسالة', 'تحقق من أن مُرشد ما زال تطبيق الرسائل الافتراضي ثم أعد المحاولة.');
              await refresh();
            }
          })();
        },
      },
    ]);
  }, [isDefaultSmsApp, refresh]);

  const unreadCount = useMemo(() => messages.filter((message) => !message.read).length, [messages]);

  const header = <View style={styles.header}>
    <View style={styles.headerTop}>
      <View style={styles.headerIcon}><Ionicons name="chatbubbles" size={24} color={colors.tealDark} /></View>
      <View style={styles.headerCopy}>
        <Text style={styles.kicker}>صندوق الوارد</Text>
        <Text style={styles.title}>رسائلك في مكان واحد</Text>
        <Text style={styles.subtitle}>الرسائل النصية المحفوظة على هذا الهاتف.</Text>
      </View>
    </View>
    {state === 'ready' && <View style={styles.statsRow}>
      <Text style={styles.statsText}>{messages.length} رسالة ظاهرة</Text>
      <Text style={styles.statsText}>{unreadCount} غير مقروءة</Text>
    </View>}
  </View>;

  let gate = null;
  if (state === 'permission') {
    gate = <SurfaceCard accent={colors.blue}>
      <Text style={styles.cardTitle}>اسمح بعرض صندوق الرسائل</Text>
      <Text style={styles.cardBody}>يمكنك محاولة منح إذن القراءة دون تعيين مُرشد تطبيقًا افتراضيًا. قد تقيّد بعض إصدارات Android أو سياسات Google Play هذا الإذن للتطبيقات غير الافتراضية؛ لا يتجاوز مُرشد هذه القيود.</Text>
      <ActionButton onPress={() => void requestReadPermission()}>طلب إذن قراءة SMS</ActionButton>
    </SurfaceCard>;
  } else if (state === 'unavailable') {
    gate = <SurfaceCard accent={colors.coral}>
      <Text style={styles.cardTitle}>يلزم تثبيت نسخة Android كاملة</Text>
      <Text style={styles.cardBody}>قراءة SMS تعتمد على كود Android أصلي، لذلك لن تعمل في Expo Go أو على iPhone. يلزم تثبيت APK مبنيّ بهذه التعديلات.</Text>
    </SurfaceCard>;
  } else if (state === 'unsupported') {
    gate = <SurfaceCard><Text style={styles.cardTitle}>قسم الرسائل متاح على Android</Text><Text style={styles.cardBody}>قراءة SMS وإدارتها غير متاحتين في نسخة iOS.</Text></SurfaceCard>;
  } else if (state === 'error') {
    gate = <SurfaceCard accent={colors.coral}>
      <Text style={styles.cardTitle}>تعذر تحميل الرسائل</Text>
      <Text style={styles.cardBody}>{errorMessage || 'تحقق من إذن قراءة SMS ثم أعد المحاولة.'}</Text>
      <ActionButton tone="quiet" onPress={() => void refresh()}>إعادة المحاولة</ActionButton>
    </SurfaceCard>;
  }

  return <ScrollView
    style={styles.screen}
    contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.tealDark} />}
  >
    {header}
    {gate}
    {state === 'loading' && <Text style={styles.loading}>جارٍ التحقق من صندوق الرسائل…</Text>}
    {state === 'ready' && !isDefaultSmsApp && <SurfaceCard accent={colors.amber}>
      <Text style={styles.optionalTitle}>القراءة لا تتطلب الدور الافتراضي في هذه الواجهة</Text>
      <Text style={styles.cardBody}>يمكنك عرض الرسائل ونسخها. استقبال SMS مباشرة داخل مُرشد وحذفها من صندوق الجهاز يتطلبان تعيينه تطبيقًا افتراضيًا، وهذا اختيارك وليس شرطًا للمتابعة هنا.</Text>
      <ActionButton tone="quiet" onPress={() => void requestSmsRole()}>تعيين مُرشد تطبيق الرسائل الافتراضي (اختياري)</ActionButton>
    </SurfaceCard>}
    {state === 'ready' && messages.length === 0 && <SurfaceCard>
      <View style={styles.emptyIcon}><Ionicons name="mail-open-outline" size={28} color={colors.tealDark} /></View>
      <Text style={styles.emptyTitle}>لا توجد رسائل SMS</Text>
      <Text style={styles.cardBody}>اسحب الشاشة للتحديث. سيعرض مُرشد أحدث 250 رسالة واردة يستطيع Android إتاحتها.</Text>
    </SurfaceCard>}
    {state === 'ready' && messages.length > 0 && <Text style={styles.selectionHint}>اضغط مطولًا على نص الرسالة لتحديد أي جزء ونسخه، أو استخدم زر «نسخ الرسالة» لنسخها كاملة.</Text>}
    {state === 'ready' && messages.map((message, index) => <View key={message.id || `${message.date}-${index}`} style={styles.messageCard}>
      <View style={styles.messageHeader}>
        <View style={styles.senderIcon}><Ionicons name="person-outline" size={18} color={colors.tealDark} /></View>
        <View style={styles.senderDetails}>
          <Text style={styles.sender} numberOfLines={1}>{message.address || 'رقم غير معروف'}</Text>
          <Text style={styles.date}>{formatDate(message.date)}</Text>
        </View>
        {!message.read && <View style={styles.unreadBadge}><Text style={styles.unreadText}>جديدة</Text></View>}
      </View>
      <Text selectable selectionColor={colors.tealSoft} style={styles.messageBody}>{message.body || 'رسالة بدون نص.'}</Text>
      <View style={styles.actionsRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="نسخ الرسالة كاملة" onPress={() => void copyMessage(message.body)} style={({ pressed }) => [styles.actionButton, styles.copyAction, pressed && styles.pressed]}>
          <Ionicons name="copy-outline" size={17} color={colors.tealDark} />
          <Text style={styles.copyActionText}>نسخ الرسالة</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={isDefaultSmsApp ? 'حذف الرسالة' : 'حذف الرسالة، يتطلب جعل مُرشد التطبيق الافتراضي'} onPress={() => deleteMessage(message)} style={({ pressed }) => [styles.actionButton, styles.deleteAction, !isDefaultSmsApp && styles.actionUnavailable, pressed && styles.pressed]}>
          <Ionicons name="trash-outline" size={17} color={isDefaultSmsApp ? colors.danger : colors.inkFaint} />
          <Text style={[styles.deleteActionText, !isDefaultSmsApp && styles.unavailableText]}>حذف</Text>
        </Pressable>
      </View>
    </View>)}
    {state === 'ready' && messages.length > 0 && <Text style={styles.footer}>تُعرض أحدث {messages.length} رسالة متاحة على الجهاز. لا يغيّر فتح هذا القسم حالة الرسائل المقروءة.</Text>}
  </ScrollView>;
}

function formatDate(timestamp: number) {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleString('ar');
  } catch {
    return '';
  }
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  header: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, gap: spacing.md },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { width: 50, height: 50, borderRadius: radii.md, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  headerCopy: { flex: 1 },
  kicker: { ...typography.label, color: colors.tealDark },
  title: { ...typography.h1, color: colors.ink, marginTop: 2 },
  subtitle: { ...typography.body, color: colors.inkMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  statsText: { ...typography.label, color: colors.inkMuted, fontSize: 11 },
  cardTitle: { ...typography.h2, color: colors.ink, marginBottom: spacing.xs },
  optionalTitle: { ...typography.h2, color: colors.ink, marginBottom: spacing.xs },
  cardBody: { ...typography.body, color: colors.inkMuted, marginBottom: spacing.md },
  loading: { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.xl },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.md },
  emptyTitle: { ...typography.h2, color: colors.ink, textAlign: 'center', marginBottom: spacing.xs },
  selectionHint: { ...typography.body, color: colors.inkMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: spacing.sm },
  messageCard: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: radii.lg, padding: spacing.md },
  messageHeader: { flexDirection: 'row', alignItems: 'center' },
  senderIcon: { width: 40, height: 40, borderRadius: 15, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  senderDetails: { flex: 1 },
  sender: { ...typography.label, color: colors.ink, fontSize: 14 },
  date: { ...typography.body, color: colors.inkFaint, fontSize: 11, marginTop: 2 },
  unreadBadge: { borderRadius: radii.pill, backgroundColor: colors.tealSoft, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  unreadText: { ...typography.label, color: colors.tealDark, fontSize: 10 },
  messageBody: { ...typography.body, color: colors.ink, marginTop: spacing.md, writingDirection: 'rtl', textAlign: 'right' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, marginTop: spacing.md, paddingTop: spacing.sm },
  actionButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radii.sm, paddingHorizontal: spacing.sm },
  copyAction: { backgroundColor: colors.tealSoft },
  copyActionText: { ...typography.label, color: colors.tealDark, fontSize: 11 },
  deleteAction: { borderWidth: 1, borderColor: colors.line },
  deleteActionText: { ...typography.label, color: colors.danger, fontSize: 11 },
  actionUnavailable: { opacity: 0.65 },
  unavailableText: { color: colors.inkFaint },
  pressed: { opacity: 0.7 },
  footer: { ...typography.body, color: colors.inkFaint, fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
}); }
