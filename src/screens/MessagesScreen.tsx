import { useCallback, useState } from 'react';
import { RuqaaText as Text } from '../components/RuqaaText';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as IntentLauncher from 'expo-intent-launcher';
import { AppState, NativeModules, PermissionsAndroid, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { SurfaceCard } from '../components/SurfaceCard';
import { colors, radii, spacing, typography } from '../theme';

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
  markAllMessagesRead: () => Promise<number>;
};

type ScreenState = 'loading' | 'ready' | 'not-default' | 'permission' | 'unavailable' | 'unsupported' | 'error';
const smsBridge = NativeModules.MurshidSms as SmsBridge | undefined;

export function MessagesScreen() {
  const isFocused = useIsFocused();
  const [state, setState] = useState<ScreenState>('loading');
  const [messages, setMessages] = useState<SmsMessage[]>([]);
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
      const isDefault = await smsBridge.isDefaultSmsApp();
      if (!isDefault) {
        setState('not-default');
        return;
      }
      const hasReadPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
      if (!hasReadPermission) {
        setState('permission');
        return;
      }
      const received = await smsBridge.getMessages();
      setMessages(received);
      setState('ready');
      try {
        await smsBridge.markAllMessagesRead();
        setMessages(received.map((message) => ({ ...message, read: true })));
      } catch {
        // Displaying the inbox remains useful if Android does not allow updating read state.
      }
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
  }, [refresh]));

  const requestSmsRole = useCallback(async () => {
    try {
      await IntentLauncher.startActivityAsync('com.murshid.s7.REQUEST_SMS_ROLE');
      await refresh();
    } catch {
      setErrorMessage('تعذر فتح طلب تطبيق الرسائل الافتراضي. حاول مرة أخرى.');
      setState('error');
    }
  }, [refresh]);

  const requestReadPermission = useCallback(async () => {
    try {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
        title: 'السماح بقراءة الرسائل',
        message: 'يحتاج مُرشد إلى إذن SMS لعرض الرسائل الواردة في هذا القسم.',
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

  const onAppStateChange = useCallback((nextState: string) => {
    if (nextState === 'active' && isFocused) void refresh();
  }, [isFocused, refresh]);

  useFocusEffect(useCallback(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, [onAppStateChange]));

  const header = <View style={styles.header}>
    <View style={styles.headerIcon}><Ionicons name="chatbubbles" size={24} color={colors.tealDark} /></View>
    <Text style={styles.kicker}>MURSHID MESSAGES</Text>
    <Text style={styles.title}>الرسائل</Text>
    <Text style={styles.subtitle}>صندوق رسائل SMS الواردة على هذا الهاتف.</Text>
  </View>;

  let gate = null;
  if (state === 'not-default') {
    gate = <SurfaceCard accent={colors.amber}>
      <Text style={styles.cardTitle}>فعّل مُرشد لتلقي الرسائل</Text>
      <Text style={styles.cardBody}>حتى يسلّم Android رسائل SMS الواردة إلى مُرشد، يجب اختياره تطبيق الرسائل الافتراضي. موافقتك تتم من نافذة النظام، ويمكنك الرفض ومتابعة بقية التطبيق.</Text>
      <ActionButton onPress={() => void requestSmsRole()}>تعيين مُرشد كتطبيق الرسائل الافتراضي</ActionButton>
    </SurfaceCard>;
  } else if (state === 'permission') {
    gate = <SurfaceCard accent={colors.blue}>
      <Text style={styles.cardTitle}>اسمح بعرض صندوق الرسائل</Text>
      <Text style={styles.cardBody}>لا يستطيع مُرشد قراءة صندوق SMS حتى تمنحه إذن القراءة على Android.</Text>
      <ActionButton onPress={() => void requestReadPermission()}>السماح بقراءة SMS</ActionButton>
    </SurfaceCard>;
  } else if (state === 'unavailable') {
    gate = <SurfaceCard accent={colors.coral}>
      <Text style={styles.cardTitle}>يلزم تثبيت نسخة Android كاملة</Text>
      <Text style={styles.cardBody}>قراءة SMS تعتمد على كود Android أصلي، لذلك لن تعمل في Expo Go أو على iPhone. ابنِ APK جديدًا يتضمن هذه المرحلة.</Text>
    </SurfaceCard>;
  } else if (state === 'unsupported') {
    gate = <SurfaceCard><Text style={styles.cardTitle}>قسم الرسائل متاح على Android</Text><Text style={styles.cardBody}>قراءة SMS وإدارة تطبيق الرسائل الافتراضي غير متاحتين في نسخة iOS.</Text></SurfaceCard>;
  } else if (state === 'error') {
    gate = <SurfaceCard accent={colors.coral}>
      <Text style={styles.cardTitle}>تعذر تحميل الرسائل</Text>
      <Text style={styles.cardBody}>{errorMessage || 'تحقق من صلاحية الرسائل وتعيين مُرشد تطبيقًا افتراضيًا.'}</Text>
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
    {state === 'ready' && messages.length === 0 && <SurfaceCard>
      <View style={styles.emptyIcon}><Ionicons name="mail-open-outline" size={28} color={colors.tealDark} /></View>
      <Text style={styles.emptyTitle}>لا توجد رسائل SMS بعد</Text>
      <Text style={styles.cardBody}>ستظهر هنا الرسائل النصية الواردة بعد أن يسلّمها Android إلى مُرشد.</Text>
    </SurfaceCard>}
    {state === 'ready' && messages.map((message) => <SurfaceCard key={message.id}>
      <View style={styles.messageHeader}>
        <View style={styles.senderIcon}><Ionicons name="person-outline" size={19} color={colors.tealDark} /></View>
        <View style={styles.senderDetails}>
          <Text style={styles.sender} numberOfLines={1}>{message.address || 'رقم غير معروف'}</Text>
          <Text style={styles.date}>{formatDate(message.date)}</Text>
        </View>
        {!message.read ? <View style={styles.unreadDot} /> : null}
      </View>
      <Text style={styles.messageBody}>{message.body}</Text>
    </SurfaceCard>)}
    {state === 'ready' && messages.length > 0 && <Text style={styles.footer}>آخر {messages.length} رسالة واردة محفوظة على الجهاز.</Text>}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  header: { alignItems: 'flex-start', marginBottom: spacing.sm },
  headerIcon: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  kicker: { ...typography.label, color: colors.tealDark, letterSpacing: 1.1 },
  title: { ...typography.display, color: colors.ink, marginTop: 3 },
  subtitle: { ...typography.body, color: colors.inkMuted, marginTop: spacing.xs },
  cardTitle: { ...typography.h2, color: colors.ink, marginBottom: spacing.xs },
  cardBody: { ...typography.body, color: colors.inkMuted, marginBottom: spacing.md },
  loading: { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.xl },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.md },
  emptyTitle: { ...typography.h2, color: colors.ink, textAlign: 'center', marginBottom: spacing.xs },
  messageHeader: { flexDirection: 'row', alignItems: 'center' },
  senderIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  senderDetails: { flex: 1 },
  sender: { ...typography.label, color: colors.ink, fontSize: 14 },
  date: { ...typography.body, color: colors.inkFaint, fontSize: 12, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal, marginLeft: spacing.sm },
  messageBody: { ...typography.body, color: colors.inkMuted, marginTop: spacing.md },
  footer: { ...typography.body, color: colors.inkFaint, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
});
