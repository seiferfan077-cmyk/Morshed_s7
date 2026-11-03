import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

export const TAB_NAMES = [
  'الرئيسية',
  'مُرشد AI',
  'القناة الرسمية',
  'الرسائل',
  'المتصفح',
  'المعرض',
  'الذاكرة',
  'المميزات',
  'الإعدادات',
] as const;

export type AppTabName = (typeof TAB_NAMES)[number];
export const DEFAULT_TAB_ORDER: AppTabName[] = [...TAB_NAMES];
const STORAGE_KEY = '@murshid/navigation-tab-order-v1';

function normalizeTabOrder(candidate: unknown): AppTabName[] {
  const requested = Array.isArray(candidate) ? candidate : [];
  const available = new Set<AppTabName>(TAB_NAMES);
  const rest = requested.filter((name): name is AppTabName => typeof name === 'string' && available.has(name as AppTabName) && name !== 'الرئيسية');
  const unique = [...new Set(rest)];
  return ['الرئيسية', ...unique, ...TAB_NAMES.filter((name) => name !== 'الرئيسية' && !unique.includes(name))];
}

type TabPreferencesValue = {
  tabOrder: AppTabName[];
  setTabOrder: (order: AppTabName[]) => void;
  moveTab: (tab: AppTabName, targetIndex: number) => void;
  ready: boolean;
};

const TabPreferencesContext = createContext<TabPreferencesValue | null>(null);

export function TabPreferencesProvider({ children }: PropsWithChildren) {
  const [tabOrder, setTabOrderState] = useState<AppTabName[]>(DEFAULT_TAB_ORDER);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        try {
          setTabOrderState(normalizeTabOrder(JSON.parse(stored)));
        } catch {
          setTabOrderState(DEFAULT_TAB_ORDER);
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const setTabOrder = useCallback((next: AppTabName[]) => {
    const normalized = normalizeTabOrder(next);
    setTabOrderState(normalized);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)).catch(() => undefined);
  }, []);

  const moveTab = useCallback((tab: AppTabName, targetIndex: number) => {
    if (tab === 'الرئيسية') return;
    setTabOrderState((current) => {
      const fromIndex = current.indexOf(tab);
      const boundedIndex = Math.max(1, Math.min(current.length - 1, targetIndex));
      if (fromIndex < 1 || fromIndex === boundedIndex) return current;
      const next = [...current];
      next.splice(fromIndex, 1);
      next.splice(boundedIndex, 0, tab);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ tabOrder, setTabOrder, moveTab, ready }), [tabOrder, setTabOrder, moveTab, ready]);
  return <TabPreferencesContext.Provider value={value}>{children}</TabPreferencesContext.Provider>;
}

export function useTabPreferences() {
  const value = useContext(TabPreferencesContext);
  if (!value) throw new Error('TabPreferencesProvider is missing');
  return value;
}
