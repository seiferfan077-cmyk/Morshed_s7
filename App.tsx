import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';
import { hasSeenWelcome, WelcomeScreen } from './src/screens/WelcomeScreen';

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
  return <><StatusBar style="dark" /><AppNavigator /></>;
}
