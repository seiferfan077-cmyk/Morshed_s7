import { useEffect, useState, type PropsWithChildren } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActionButton } from './ActionButton';
import { RuqaaText as Text } from './RuqaaText';
import { radii, shadows, spacing, typography, type ThemeColors } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

type ErrorOptions = { retryLabel?: string; onRetry?: () => void };
type ErrorDialogState = { title: string; message: string; options?: ErrorOptions } | null;
type ErrorPresenter = (dialog: ErrorDialogState) => void;

let presentError: ErrorPresenter | null = null;
let queuedError: ErrorDialogState = null;

export function showAppError(title: string, message: string, options?: ErrorOptions) {
  const dialog = { title, message, options };
  if (presentError) presentError(dialog);
  else queuedError = dialog;
}

export function AppDialogProvider({ children }: PropsWithChildren) {
  const [dialog, setDialog] = useState<ErrorDialogState>(null);
  useEffect(() => {
    const present = (next: ErrorDialogState) => {
      queuedError = null;
      setDialog(next);
    };
    presentError = present;
    let queuedTimer: ReturnType<typeof setTimeout> | undefined;
    const pending = queuedError;
    if (pending) queuedTimer = setTimeout(() => {
      if (queuedError === pending) {
        queuedError = null;
        setDialog(pending);
      }
    }, 0);
    return () => {
      if (queuedTimer) clearTimeout(queuedTimer);
      if (presentError === present) presentError = null;
    };
  }, []);

  return <>
    {children}
    <AppErrorDialog dialog={dialog} onClose={() => setDialog(null)} />
  </>;
}

function AppErrorDialog({ dialog, onClose }: { dialog: ErrorDialogState; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [typing, setTyping] = useState({ key: '', count: 0 });
  const [entrance] = useState(() => new Animated.Value(0));
  const typingKey = dialog ? `${dialog.title}\u0000${dialog.message}` : '';
  const typedCount = typing.key === typingKey ? typing.count : 0;
  const characters = Array.from(dialog?.message ?? '');

  useEffect(() => {
    if (!dialog) return undefined;
    const messageCharacters = Array.from(dialog.message);
    entrance.setValue(0);
    Animated.spring(entrance, { toValue: 1, speed: 17, bounciness: 5, useNativeDriver: true }).start();

    let index = 0;
    const ticks = Math.max(20, Math.min(100, Math.ceil(messageCharacters.length / 2)));
    const step = Math.max(1, Math.ceil(messageCharacters.length / ticks));
    const timer = setInterval(() => {
      index = Math.min(messageCharacters.length, index + step);
      setTyping({ key: typingKey, count: index });
      if (index >= messageCharacters.length) clearInterval(timer);
    }, 28);
    return () => clearInterval(timer);
  }, [dialog, entrance, typingKey]);

  const onRetry = dialog?.options?.onRetry;
  const isTyping = typedCount < characters.length;
  const closeAndRetry = () => {
    onClose();
    onRetry?.();
  };

  return (
    <Modal visible={Boolean(dialog)} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="إغلاق رسالة الخطأ" />
        <Animated.View style={[styles.dialog, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }]}>
          <View style={styles.topRow}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>م</Text></View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="إغلاق">
              <Ionicons name="close" size={19} color={colors.inkMuted} />
            </Pressable>
          </View>
          <View style={styles.iconHalo}>
            <View style={styles.iconDisc}><Ionicons name="alert-circle" size={31} color={colors.danger} /></View>
          </View>
          <Text style={styles.eyebrow}>تنبيه من مُرشد</Text>
          <Text style={styles.title}>{dialog?.title ?? 'حدث خطأ'}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.message}>
            {characters.slice(0, typedCount).join('')}{isTyping ? <Text style={styles.cursor}>✎</Text> : null}
          </Text>
          <View style={styles.actions}>
            {onRetry ? (
              <>
                <ActionButton tone="quiet" onPress={closeAndRetry} buttonStyle={styles.actionButton}>
                  {dialog?.options?.retryLabel ?? 'حاول مرة تانية'}
                </ActionButton>
                <ActionButton onPress={onClose} buttonStyle={styles.actionButton}>إغلاق</ActionButton>
              </>
            ) : (
              <ActionButton onPress={onClose} buttonStyle={styles.singleAction}>حسنًا</ActionButton>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg, backgroundColor: 'rgba(4, 13, 17, 0.68)' },
    dialog: { width: '100%', maxWidth: 420, borderRadius: radii.lg + 6, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, ...shadows.card },
    topRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    brandMark: { width: 32, height: 32, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    brandMarkText: { color: colors.paper, fontFamily: typography.label.fontFamily, fontSize: 16, fontWeight: '800' },
    closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    iconHalo: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.coralSoft, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
    iconDisc: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    eyebrow: { ...typography.label, color: colors.danger, textAlign: 'center', marginTop: spacing.md, letterSpacing: 0.4 },
    title: { ...typography.h1, color: colors.ink, textAlign: 'center', marginTop: spacing.xs, fontSize: 22 },
    message: { ...typography.body, color: colors.inkMuted, textAlign: 'center', writingDirection: 'rtl', lineHeight: 26, minHeight: 52, marginTop: spacing.sm, marginBottom: spacing.md },
    cursor: { color: colors.tealDark },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    actionButton: { flex: 1 },
    singleAction: { width: '100%' },
  });
}
