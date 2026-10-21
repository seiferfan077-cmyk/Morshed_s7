import { useCallback, useEffect, useState } from 'react';
import { AppState, NativeModules, Platform, View } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as SystemUI from 'expo-system-ui';
import * as Updates from 'expo-updates';
import './src/services/channel/channelNotifications';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppDialogProvider } from './src/components/AppDialogProvider';
import { showDailyUpdateNotificationIfDue } from './src/services/notifications/dailyUpdateNotification';
import { hasSeenWelcome, WelcomeScreen } from './src/screens/WelcomeScreen';
import { hasOpenedRequiredWebsite, WebsiteLaunchGate } from './src/screens/WebsiteLaunchGate';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeProvider';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'ArefRuqaa-Regular': require('./assets/fonts/ArefRuqaa-Regular.ttf'),
    'ArefRuqaa-Bold': require('./assets/fonts/ArefRuqaa-Bold.ttf'),
  });
  const [ready, setReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showWebsiteGate, setShowWebsiteGate] = useState(false);

  useEffect(() => {
    Promise.all([hasSeenWelcome().catch(() => false), hasOpenedRequiredWebsite()]).then(([seenWelcome, websiteOpened]) => {
      setShowWelcome(!seenWelcome);
      setShowWebsiteGate(!websiteOpened);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if ((!fontsLoaded && !fontError) || !ready || showWelcome || showWebsiteGate) return;
    let active = true;
    let startupFlowDone = false;
    let previousAppState = AppState.currentState;
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      const returnedToApp = previousAppState !== 'active' && nextAppState === 'active';
      previousAppState = nextAppState;
      if (active && startupFlowDone && returnedToApp) {
        void showDailyUpdateNotificationIfDue();
      }
    });

    void (async () => {
      if (Platform.OS === 'android') {
        // The native transparent activity records that the one-time system prompt was shown.
        // Declining the role never blocks the rest of the app.
        await IntentLauncher.startActivityAsync('com.murshid.s7.REQUEST_DEFAULT_ROLES').catch(() => undefined);
        if (!active) return;
      }

      await showDailyUpdateNotificationIfDue();
      startupFlowDone = true;
      if (!active || Platform.OS !== 'android') return;

      try {
        await NativeModules.MurshidShortcutModule?.requestPinShortcut?.();
      } catch {
        // Pinned shortcuts are optional and unsupported launchers must not block startup.
      }
    })();
    return () => {
      active = false;
      appStateSubscription.remove();
    };
  }, [fontsLoaded, fontError, ready, showWelcome, showWebsiteGate]);

  useEffect(() => {
    if (__DEV__ || !ready || showWelcome || showWebsiteGate || !Updates.isEnabled) return;
    let active = true;
    const checkForUpdate = async () => {
      try {
        const available = await Updates.checkForUpdateAsync();
        if (!active || !available.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (!active) return;
        await Updates.reloadAsync();
      } catch {
        // OTA must never prevent the existing embedded bundle from starting.
      }
    };
    let previousAppState = AppState.currentState;
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      const returnedToApp = previousAppState !== 'active' && nextAppState === 'active';
      previousAppState = nextAppState;
      if (active && returnedToApp) void checkForUpdate();
    });
    void checkForUpdate();
    return () => { active = false; appStateSubscription.remove(); };
  }, [ready, showWelcome, showWebsiteGate]);

  const finishWelcome = useCallback(() => setShowWelcome(false), []);
  const finishWebsiteGate = useCallback(() => setShowWebsiteGate(false), []);

  if (!fontsLoaded && !fontError) return null;
  if (!ready) return <ThemeProvider><AppDialogProvider><><StatusBar style="light" /><WelcomeScreen onComplete={() => undefined} /></></AppDialogProvider></ThemeProvider>;
  if (showWelcome) return <ThemeProvider><AppDialogProvider><><StatusBar style="light" /><WelcomeScreen onComplete={finishWelcome} /></></AppDialogProvider></ThemeProvider>;
  return <ThemeProvider><AppDialogProvider><ThemedApp websiteGateRequired={showWebsiteGate} onWebsiteGateComplete={finishWebsiteGate} /></AppDialogProvider></ThemeProvider>;
}

function ThemedApp({ websiteGateRequired, onWebsiteGateComplete }: { websiteGateRequired: boolean; onWebsiteGateComplete: () => void }) {
  const { colors, mode, ready } = useAppTheme();
  useEffect(() => { void SystemUI.setBackgroundColorAsync(colors.surface).catch(() => undefined); }, [colors.surface]);
  if (!ready) return null;
  return <View style={{ flex: 1, backgroundColor: colors.surface }}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} />{websiteGateRequired ? <WebsiteLaunchGate onComplete={onWebsiteGateComplete} /> : <AppNavigator />}</View>;
}
