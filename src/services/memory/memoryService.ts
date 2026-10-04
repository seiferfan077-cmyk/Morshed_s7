import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultMemorySettings, MemoryItem, MemorySettings } from '../../types/memory';

const ITEMS_KEY = '@murshid/memory-items';
const SETTINGS_KEY = '@murshid/memory-settings';

export interface MemoryProvider {
  list(): Promise<MemoryItem[]>;
  save(item: MemoryItem): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  getSettings(): Promise<MemorySettings>;
  saveSettings(settings: MemorySettings): Promise<void>;
}

export class LocalMemoryProvider implements MemoryProvider {
  async list() {
    const raw = await AsyncStorage.getItem(ITEMS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as MemoryItem[];
    } catch {
      return [];
    }
  }

  async save(item: MemoryItem) {
    const items = await this.list();
    await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify([item, ...items.filter((entry) => entry.id !== item.id)]));
  }

  async remove(id: string) {
    const items = await this.list();
    await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items.filter((item) => item.id !== id)));
  }

  async clear() {
    await AsyncStorage.removeItem(ITEMS_KEY);
  }

  async getSettings() {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultMemorySettings;
    try {
      return { ...defaultMemorySettings, ...JSON.parse(raw) } as MemorySettings;
    } catch {
      return defaultMemorySettings;
    }
  }

  async saveSettings(settings: MemorySettings) {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
}

export const localMemoryProvider = new LocalMemoryProvider();
