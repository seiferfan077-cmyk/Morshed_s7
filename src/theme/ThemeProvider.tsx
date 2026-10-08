import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, NativeModules, Platform } from 'react-native';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { darkColors, lightColors, ThemeColors } from './index';

export type ThemeMode = 'light' | 'dark';
type ThemeContextValue = { mode: ThemeMode; colors: ThemeColors; ready: boolean; setMode: (mode: ThemeMode) => void };
const THEME_KEY = '@murshid/theme-mode';
type NativeThemeBridge = { setThemeMode?: (mode: ThemeMode) => void };
const nativeTheme = NativeModules.MurshidTheme as NativeThemeBridge | undefined;
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (active && (saved === 'light' || saved === 'dark')) setModeState(saved);
    }).catch(() => undefined).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    Appearance.setColorScheme(mode);
    if (Platform.OS === 'android') {
      try { nativeTheme?.setThemeMode?.(mode); } catch { /* The native bridge may be absent in Expo Go. */ }
    }
  }, [mode, ready]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(THEME_KEY, next).catch(() => undefined);
  }, []);
  const value = useMemo(() => ({ mode, colors: mode === 'dark' ? darkColors : lightColors, ready, setMode }), [mode, ready, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme must be used inside ThemeProvider');
  return value;
}
