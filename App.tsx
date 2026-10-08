import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';
import { hasSeenWelcome, WelcomeScreen } from './src/screens/WelcomeScreen';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeProvider';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'ArefRuqaa-Regular': require('./assets/fonts/ArefRuqaa-Regular.ttf'),
    'ArefRuqaa-Bold': require('./assets/fonts/ArefRuqaa-Bold.ttf'),
  });
  const [ready, setReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    hasSeenWelcome().then((seen) => {
      setShowWelcome(!seen);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if ((!fontsLoaded && !fontError) || !ready || showWelcome || Platform.OS !== 'android') return;
    // The native transparent activity records that the one-time system prompt was shown.
    // Declining the role never blocks the rest of the app.
    void IntentLauncher.startActivityAsync('com.murshid.s7.REQUEST_DEFAULT_ROLES').catch(() => undefined);
  }, [fontsLoaded, fontError, ready, showWelcome]);

  const finishWelcome = useCallback(() => setShowWelcome(false), []);

  if (!fontsLoaded && !fontError) return null;
  if (!ready) return <><StatusBar style="light" /><WelcomeScreen onComplete={() => undefined} /></>;
  if (showWelcome) return <><StatusBar style="light" /><WelcomeScreen onComplete={finishWelcome} /></>;
  return <ThemeProvider><ThemedApp /></ThemeProvider>;
}

function ThemedApp() {
  const { colors, mode, ready } = useAppTheme();
  useEffect(() => { void SystemUI.setBackgroundColorAsync(colors.surface).catch(() => undefined); }, [colors.surface]);
  if (!ready) return null;
  return <View style={{ flex: 1, backgroundColor: colors.surface }}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><AppNavigator /></View>;
}
