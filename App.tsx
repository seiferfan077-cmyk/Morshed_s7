import { useCallback, useEffect, useState } from 'react';
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

  const finishWelcome = useCallback(() => setShowWelcome(false), []);

  if (!ready) return <><StatusBar style="light" /><WelcomeScreen onComplete={() => undefined} /></>;
  if (showWelcome) return <><StatusBar style="light" /><WelcomeScreen onComplete={finishWelcome} /></>;
  return <><StatusBar style="dark" /><AppNavigator /></>;
}
