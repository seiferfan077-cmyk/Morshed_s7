import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { MediaType } from '../../types/domain';

export interface StoredMediaItem {
  id: string;
  uri: string;
  filename: string;
  type: MediaType;
  mimeType?: string;
  size?: number;
  createdAt: string;
  hidden: boolean;
  source: 'imported';
  deviceAssetId?: string;
}

const ITEMS_KEY = '@murshid/media-vault-items';
const PIN_KEY = '@murshid/media-vault-pin';
const PIN_LAST_CHAR_KEY = '@murshid/media-vault-pin-last-char';
const RECOVERY_QUESTION_KEY = '@murshid/media-vault-recovery-question';
const RECOVERY_ANSWER_KEY = '@murshid/media-vault-recovery-answer';
const DEVICE_HIDDEN_KEY = '@murshid/media-device-hidden';
const DEVICE_REMOVED_KEY = '@murshid/media-device-removed';
const VAULT_DIR = `${FileSystem.documentDirectory ?? ''}murshid-vault/`;

async function ensureVault() {
  if (!(await FileSystem.getInfoAsync(VAULT_DIR)).exists) await FileSystem.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
}

export async function listStoredMedia(): Promise<StoredMediaItem[]> {
  const raw = await AsyncStorage.getItem(ITEMS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as StoredMediaItem[]; } catch { return []; }
}

async function writeItems(items: StoredMediaItem[]) {
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

function safeFilename(filename: string) {
  return filename.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'media';
}

export async function importToVault(uri: string, filename: string, type: MediaType, mimeType?: string, size?: number, deviceAssetId?: string) {
  const existing = deviceAssetId ? (await listStoredMedia()).find((item) => item.deviceAssetId === deviceAssetId) : undefined;
  if (existing) return existing;
  await ensureVault();
  const id = `vault-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const target = `${VAULT_DIR}${id}-${safeFilename(filename)}`;
  await FileSystem.copyAsync({ from: uri, to: target });
  const item: StoredMediaItem = { id, uri: target, filename, type, mimeType, size, createdAt: new Date().toISOString(), hidden: false, source: 'imported', deviceAssetId };
  await writeItems([item, ...(await listStoredMedia())]);
  return item;
}

export async function setStoredMediaHidden(id: string, hidden: boolean) {
  const items = await listStoredMedia();
  await writeItems(items.map((item) => item.id === id ? { ...item, hidden } : item));
}

export async function deleteStoredMedia(id: string) {
  const items = await listStoredMedia();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  await FileSystem.deleteAsync(item.uri, { idempotent: true });
  await writeItems(items.filter((entry) => entry.id !== id));
}

export async function hasPrivacyPin() {
  return Boolean(await SecureStore.getItemAsync(PIN_KEY));
}

export async function savePrivacyPin(pin: string) {
  await SecureStore.setItemAsync(PIN_KEY, pin, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  await SecureStore.setItemAsync(PIN_LAST_CHAR_KEY, pin.slice(-1), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function verifyPrivacyPin(pin: string) {
  const saved = await SecureStore.getItemAsync(PIN_KEY);
  return Boolean(saved && saved === pin);
}

function normalizeRecoveryAnswer(answer: string) {
  return answer.trim().normalize('NFKC').toLocaleLowerCase();
}

export async function savePrivacyCredentials(pin: string, question: string, answer: string) {
  await savePrivacyPin(pin);
  await SecureStore.setItemAsync(RECOVERY_QUESTION_KEY, question.trim(), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  await SecureStore.setItemAsync(RECOVERY_ANSWER_KEY, normalizeRecoveryAnswer(answer), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function updatePrivacyPin(pin: string) {
  await savePrivacyPin(pin);
}

export async function getPrivacyRecoveryQuestion() {
  return SecureStore.getItemAsync(RECOVERY_QUESTION_KEY);
}

export async function verifyPrivacyRecoveryAnswer(answer: string) {
  const saved = await SecureStore.getItemAsync(RECOVERY_ANSWER_KEY);
  return Boolean(saved && saved === normalizeRecoveryAnswer(answer));
}

export async function getPrivacyPinLastCharacter() {
  return SecureStore.getItemAsync(PIN_LAST_CHAR_KEY);
}

export async function getDeviceAssetVisibility() {
  const [hiddenRaw, removedRaw] = await Promise.all([AsyncStorage.getItem(DEVICE_HIDDEN_KEY), AsyncStorage.getItem(DEVICE_REMOVED_KEY)]);
  const parseIds = (raw: string | null) => { try { return raw ? JSON.parse(raw) as string[] : []; } catch { return []; } };
  return { hidden: new Set<string>(parseIds(hiddenRaw)), removed: new Set<string>(parseIds(removedRaw)) };
}

export async function setDeviceAssetHidden(id: string, hidden: boolean) {
  const visibility = await getDeviceAssetVisibility();
  hidden ? visibility.hidden.add(id) : visibility.hidden.delete(id);
  await AsyncStorage.setItem(DEVICE_HIDDEN_KEY, JSON.stringify([...visibility.hidden]));
}

export async function setDeviceAssetRemoved(id: string) {
  const visibility = await getDeviceAssetVisibility();
  visibility.removed.add(id);
  await AsyncStorage.setItem(DEVICE_REMOVED_KEY, JSON.stringify([...visibility.removed]));
}
