import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';
import { hasSeenWelcome, WelcomeScreen } from './src/screens/WelcomeScreen';

export default function App() {
  const [ready, setReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    hasSeenWelcome().then((seen) => {
      setShowWelcome(!seen);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready || showWelcome || Platform.OS !== 'android') return;
    // The native transparent activity records that the one-time system prompt was shown.
    // Declining the role never blocks the rest of the app.
    void IntentLauncher.startActivityAsync('com.murshid.s7.REQUEST_DEFAULT_ROLES').catch(() => undefined);
  }, [ready, showWelcome]);

  const finishWelcome = useCallback(() => setShowWelcome(false), []);

  if (!ready) return <><StatusBar style="light" /><WelcomeScreen onComplete={() => undefined} /></>;
  if (showWelcome) return <><StatusBar style="light" /><WelcomeScreen onComplete={finishWelcome} /></>;
  return <><StatusBar style="dark" /><AppNavigator /></>;
}
