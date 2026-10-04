import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultMemorySettings, MemoryCandidate, MemoryItem, MemorySettings } from '../../types/memory';
import { retrieveRelevantMemories } from './memoryRetrieval';

const ITEMS_KEY = '@murshid/memory-items';
const CANDIDATES_KEY = '@murshid/memory-candidates';
const SETTINGS_KEY = '@murshid/memory-settings';

export interface MemoryProvider {
  list(): Promise<MemoryItem[]>;
  save(item: MemoryItem): Promise<void>;
  update(id: string, patch: Partial<MemoryItem>): Promise<MemoryItem | null>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  retrieve(query: string, limit?: number): Promise<MemoryItem[]>;
  listCandidates(): Promise<MemoryCandidate[]>;
  saveCandidate(candidate: MemoryCandidate): Promise<void>;
  approveCandidate(id: string, content?: string): Promise<MemoryItem | null>;
  rejectCandidate(id: string): Promise<void>;
  getSettings(): Promise<MemorySettings>;
  saveSettings(settings: MemorySettings): Promise<void>;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function words(value: string) {
  return new Set(value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2));
}

function findConflictIds(candidate: MemoryCandidate, items: MemoryItem[]) {
  const candidateWords = words(candidate.content);
  if (!candidateWords.size) return [];
  return items.filter((item) => {
    if (item.type !== candidate.type || item.sensitivity !== 'normal') return false;
    const shared = [...candidateWords].filter((word) => words(item.content).has(word)).length;
    return shared > 0 && shared / Math.max(candidateWords.size, words(item.content).size) >= 0.4;
  }).map((item) => item.id);
}

export class LocalMemoryProvider implements MemoryProvider {
  async list() {
    const settings = await this.getSettings();
    const items = await readJson<MemoryItem[]>(ITEMS_KEY, []);
    const now = Date.now();
    const valid = items.filter((item) => !item.expiration || new Date(item.expiration).getTime() > now).filter((item) => !settings.disabledTypes.includes(item.type));
    if (valid.length !== items.length) await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(valid));
    return valid;
  }

  async save(item: MemoryItem) {
    if (item.consent !== 'accepted') return;
    const items = await this.list();
    const existing = items.find((entry) => entry.id === item.id);
    const next = existing ? items.map((entry) => entry.id === item.id ? { ...entry, ...item, updatedAt: new Date().toISOString() } : entry) : [item, ...items];
    await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(next));
  }

  async update(id: string, patch: Partial<MemoryItem>) {
    const items = await this.list();
    const current = items.find((item) => item.id === id);
    if (!current) return null;
    const updated = { ...current, ...patch, id: current.id, consent: 'accepted' as const, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items.map((item) => item.id === id ? updated : item)));
    return updated;
  }

  async remove(id: string) {
    const items = await this.list();
    await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items.filter((item) => item.id !== id)));
  }

  async clear() {
    await Promise.all([AsyncStorage.removeItem(ITEMS_KEY), AsyncStorage.removeItem(CANDIDATES_KEY)]);
  }

  async retrieve(query: string, limit = 5) {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.retrievalEnabled) return [];
    return retrieveRelevantMemories(query, await this.list(), limit);
  }

  async listCandidates() {
    const settings = await this.getSettings();
    if (!settings.enabled) return [];
    return readJson<MemoryCandidate[]>(CANDIDATES_KEY, []).then((items) => items.filter((item) => item.status === 'pending'));
  }

  async saveCandidate(candidate: MemoryCandidate) {
    const settings = await this.getSettings();
    if (!settings.enabled || settings.disabledTypes.includes(candidate.type)) return;
    const conflicts = findConflictIds(candidate, await this.list());
    const enriched = { ...candidate, conflictIds: conflicts, suggestedAction: conflicts.length ? 'update' as const : 'save' as const };
    const candidates = await this.listCandidates();
    await AsyncStorage.setItem(CANDIDATES_KEY, JSON.stringify([enriched, ...candidates.filter((item) => item.id !== candidate.id)]));
  }

  async approveCandidate(id: string, content?: string) {
    const candidates = await readJson<MemoryCandidate[]>(CANDIDATES_KEY, []);
    const candidate = candidates.find((item) => item.id === id);
    if (!candidate) return null;
    const now = new Date();
    const settings = await this.getSettings();
    if (!settings.enabled) return null;
    const expiration = candidate.suggestedExpiration ?? (settings.retentionDays ? new Date(now.getTime() + settings.retentionDays * 86_400_000).toISOString() : undefined);
    const replacementId = candidate.conflictIds?.[0];
    const exact = (await this.list()).find((item) => item.type === candidate.type && item.content.toLowerCase() === (content ?? candidate.content).toLowerCase());
    const existing = replacementId ? (await this.list()).find((item) => item.id === replacementId) : exact;
    const item: MemoryItem = existing ? (await this.update(existing.id, { content: content ?? candidate.content, confidence: candidate.confidence, importance: candidate.importance, sensitivity: candidate.sensitivity, expiration, tags: candidate.tags }))! : { id: `memory-${now.getTime()}`, userId: 'local-user', type: candidate.type, content: content ?? candidate.content, source: 'user', createdAt: now.toISOString(), updatedAt: now.toISOString(), confidence: candidate.confidence, importance: candidate.importance, sensitivity: candidate.sensitivity, expiration, consent: 'accepted', tags: candidate.tags };
    if (!existing) await this.save(item);
    await AsyncStorage.setItem(CANDIDATES_KEY, JSON.stringify(candidates.filter((entry) => entry.id !== id)));
    return item;
  }

  async rejectCandidate(id: string) {
    const candidates = await readJson<MemoryCandidate[]>(CANDIDATES_KEY, []);
    await AsyncStorage.setItem(CANDIDATES_KEY, JSON.stringify(candidates.filter((item) => item.id !== id)));
  }

  async getSettings() { return readJson<MemorySettings>(SETTINGS_KEY, defaultMemorySettings).then((settings) => ({ ...defaultMemorySettings, ...settings })); }
  async saveSettings(settings: MemorySettings) { await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
}

export const localMemoryProvider = new LocalMemoryProvider();
