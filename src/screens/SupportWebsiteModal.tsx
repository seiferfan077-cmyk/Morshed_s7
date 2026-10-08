import { useAppTheme } from '../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { RuqaaText as Text } from '../components/RuqaaText';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { radii, spacing, typography, ThemeColors } from '../theme';

const SUPPORT_URL = 'https://setr-seif-ai.vercel.app/';

type SupportWebsiteModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function SupportWebsiteModal({ visible, onClose }: SupportWebsiteModalProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleShow = () => {
    setLoading(true);
    setHasError(false);
    webViewRef.current?.reload();
  };

  const retry = () => {
    setHasError(false);
    setLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      onShow={handleShow}
    >
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="العودة إلى تطبيق مُرشد"
            hitSlop={10}
            onPress={onClose}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>MURSHID SUPPORT</Text>
            <Text style={styles.title}>الدعم عبر الموقع الإلكتروني</Text>
          </View>
        </View>

        <View style={styles.webViewContainer}>
          <WebView
            ref={webViewRef}
            source={{ uri: SUPPORT_URL }}
            style={styles.webView}
            originWhitelist={['http://*', 'https://*']}
            onShouldStartLoadWithRequest={(request) => /^https?:\/\//i.test(request.url)}
            onLoadStart={() => {
              setLoading(true);
              setHasError(false);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setHasError(true);
            }}
            onHttpError={(event) => {
              if (event.nativeEvent.statusCode >= 400) {
                setLoading(false);
                setHasError(true);
              }
            }}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures={false}
            startInLoadingState={false}
          />

          {loading || hasError ? (
            <View style={styles.statusBanner}>
              <View style={styles.statusIndicator}>
                {hasError ? (
                  <Ionicons name="cloud-offline-outline" size={22} color={colors.danger} />
                ) : (
                  <ActivityIndicator size="small" color={colors.tealDark} />
                )}
              </View>
              <View style={styles.statusCopy}>
                <Text style={[styles.statusTitle, hasError && styles.errorTitle]}>
                  {hasError ? 'تعذّر فتح صفحة الدعم' : 'لحظات من فضلك'}
                </Text>
                <Text style={styles.statusBody}>
                  {hasError
                    ? 'تحقق من اتصال الإنترنت وحاول مرة أخرى.'
                    : 'ستُفتح صفحة الدعم خلال ثوانٍ معدودة، يُرجى الانتظار بهدوء.'}
                </Text>
              </View>
              {hasError ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="إعادة تحميل صفحة الدعم"
                  onPress={retry}
                  hitSlop={8}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                >
                  <Ionicons name="refresh" size={19} color={colors.tealDark} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    minHeight: 66,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.paper,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  headerCopy: { flex: 1, marginRight: spacing.sm, alignItems: 'flex-end' },
  eyebrow: { ...typography.label, color: colors.tealDark, fontSize: 9, letterSpacing: 1.1 },
  title: { ...typography.h2, color: colors.ink, marginTop: 2, textAlign: 'right' },
  webViewContainer: { flex: 1, backgroundColor: colors.paper },
  webView: { flex: 1, backgroundColor: colors.paper },
  statusBanner: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    minHeight: 68,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  statusIndicator: { width: 28, alignItems: 'center', justifyContent: 'center' },
  statusCopy: { flex: 1, alignItems: 'flex-end' },
  statusTitle: { ...typography.label, color: colors.ink, textAlign: 'right' },
  errorTitle: { color: colors.danger },
  statusBody: { ...typography.body, color: colors.inkMuted, fontSize: 12, lineHeight: 17, marginTop: 3, textAlign: 'right' },
  retryButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealSoft,
  },
  pressed: { opacity: 0.72 },
}); }
