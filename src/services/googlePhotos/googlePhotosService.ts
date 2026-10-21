import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import { AuthRequest, makeRedirectUri, ResponseType } from 'expo-auth-session';
import { importToVault, listStoredMedia } from '../storage/mediaVaultService';
import type { MediaType } from '../../types/domain';

WebBrowser.maybeCompleteAuthSession();

const PHOTOS_API = 'https://photospicker.googleapis.com/v1';
const OAUTH_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};
const TOKEN_KEY = 'murshid.google-photos.oauth-token';
const JOB_KEY = '@murshid/google-photos-import-job';
const SCOPES = ['https://www.googleapis.com/auth/photospicker.mediaitems.readonly'];
const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID
  ?? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  ?? '';

export type GooglePhotosProgress = {
  sessionId: string;
  selected: number;
  completed: number;
  failed: number;
  downloadedBytes: number;
  totalBytes?: number;
  paused?: boolean;
};

type OAuthToken = { accessToken: string; refreshToken?: string; expiresAt: number };
type PickedMedia = { id: string; mediaFile?: { baseUrl?: string; mimeType?: string; mediaMetadata?: { creationTime?: string; width?: number; height?: number; duration?: string; status?: string } }; };
type PickerPage = { mediaItems?: PickedMedia[]; nextPageToken?: string };
type GooglePhotosJob = GooglePhotosProgress & { items: PickedMedia[] };

function requireClientId() {
  if (!CLIENT_ID) throw new Error('google_photos_client_id_missing');
  return CLIENT_ID;
}

function redirectUri() {
  return makeRedirectUri({ scheme: 'murshid', path: 'google-photos-oauth' });
}

async function saveToken(token: OAuthToken) {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(token), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

async function readToken(): Promise<OAuthToken | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as OAuthToken; } catch { return null; }
}

async function exchangeCode(code: string, verifier: string): Promise<OAuthToken> {
  const response = await fetch(OAUTH_DISCOVERY.tokenEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: requireClientId(), redirect_uri: redirectUri(), code_verifier: verifier }).toString() });
  if (!response.ok) throw new Error('google_photos_oauth_exchange_failed');
  const body = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error('google_photos_oauth_token_missing');
  return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: Date.now() + Math.max(60, body.expires_in ?? 3600) * 1000 };
}

async function refreshToken(token: OAuthToken): Promise<OAuthToken> {
  if (!token.refreshToken) throw new Error('google_photos_reauthorization_required');
  const response = await fetch(OAUTH_DISCOVERY.tokenEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refreshToken, client_id: requireClientId() }).toString() });
  if (!response.ok) throw new Error('google_photos_refresh_failed');
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error('google_photos_refresh_token_missing');
  const renewed = { ...token, accessToken: body.access_token, expiresAt: Date.now() + Math.max(60, body.expires_in ?? 3600) * 1000 };
  await saveToken(renewed);
  return renewed;
}

export async function getGooglePhotosAccessToken(): Promise<string> {
  requireClientId();
  const saved = await readToken();
  if (saved && saved.expiresAt > Date.now() + 60_000) return saved.accessToken;
  if (saved?.refreshToken) return (await refreshToken(saved)).accessToken;
  const request = new AuthRequest({ clientId: CLIENT_ID, responseType: ResponseType.Code, scopes: SCOPES, usePKCE: true, redirectUri: redirectUri(), extraParams: { access_type: 'offline', prompt: 'consent' } });
  await request.makeAuthUrlAsync(OAUTH_DISCOVERY);
  const result = await request.promptAsync(OAUTH_DISCOVERY);
  if (result.type !== 'success' || !result.params.code || !request.codeVerifier) throw new Error('google_photos_oauth_cancelled');
  const token = await exchangeCode(result.params.code, request.codeVerifier);
  await saveToken(token);
  return token.accessToken;
}

async function photosRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PHOTOS_API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (response.status === 401) throw new Error('google_photos_authorization_expired');
  if (!response.ok) throw new Error(`google_photos_api_${response.status}`);
  return response.json() as Promise<T>;
}

export async function createPickerSession(token: string) {
  return photosRequest<{ id: string; pickerUri: string }>('/sessions', token, { method: 'POST', body: '{}' });
}

async function waitForSelection(sessionId: string, token: string, signal?: AbortSignal) {
  for (;;) {
    if (signal?.aborted) throw new Error('google_photos_import_paused');
    const session = await photosRequest<{ mediaItemsSet?: boolean; pollingConfig?: { pollingInterval?: string; timeoutIn?: string } }>(`/sessions/${encodeURIComponent(sessionId)}`, token);
    if (session.mediaItemsSet) return;
    const delay = Math.max(1500, Math.min(5000, Number.parseFloat(session.pollingConfig?.pollingInterval ?? '2') * 1000));
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(resolve, delay); signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('google_photos_import_paused')); }, { once: true }); });
  }
}

async function listPickedMedia(sessionId: string, token: string) {
  const items: PickedMedia[] = [];
  let pageToken = '';
  do {
    const suffix = `?sessionId=${encodeURIComponent(sessionId)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const page = await photosRequest<PickerPage>(`/mediaItems${suffix}`, token);
    items.push(...(page.mediaItems ?? []));
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return items;
}

function typeFor(mimeType?: string): MediaType { return mimeType?.startsWith('video/') ? 'video' : 'image'; }
function contentUrl(item: PickedMedia) { const base = item.mediaFile?.baseUrl; if (!base) throw new Error('google_photos_media_url_missing'); return `${base}${base.endsWith('=') ? '' : '='}${typeFor(item.mediaFile?.mimeType) === 'video' ? 'dv' : 'd'}`; }
function filenameFor(item: PickedMedia) { const extension = item.mediaFile?.mimeType?.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin'; return `google-photos-${item.id}.${extension}`; }

export async function disconnectGooglePhotos() { await SecureStore.deleteItemAsync(TOKEN_KEY); await SecureStore.deleteItemAsync(JOB_KEY); }

export async function importSelectedGooglePhotos(onProgress: (progress: GooglePhotosProgress) => void, signal?: AbortSignal) {
  const token = await getGooglePhotosAccessToken();
  const savedJob = await getGooglePhotosJob();
  let sessionId = savedJob?.sessionId;
  let selected = savedJob?.items ?? [];
  if (!selected.length) {
    const session = await createPickerSession(token);
    sessionId = session.id;
    await WebBrowser.openBrowserAsync(session.pickerUri);
    await waitForSelection(session.id, token, signal);
    selected = await listPickedMedia(session.id, token);
  }
  if (!sessionId) throw new Error('google_photos_session_missing');
  const existing = await listStoredMedia();
  const existingIds = new Set(existing.map((item) => item.sourceKey).filter((sourceKey): sourceKey is string => Boolean(sourceKey)));
  const progress: GooglePhotosProgress = savedJob ?? { sessionId, selected: selected.length, completed: 0, failed: 0, downloadedBytes: 0 };
  await SecureStore.setItemAsync(JOB_KEY, JSON.stringify({ ...progress, items: selected } satisfies GooglePhotosJob));
  onProgress(progress);
  for (const item of selected) {
    const sourceKey = `google-photos:${item.id}`;
    if (existingIds.has(sourceKey)) { progress.completed += 1; onProgress({ ...progress }); continue; }
    if (signal?.aborted) { progress.paused = true; await SecureStore.setItemAsync(JOB_KEY, JSON.stringify({ ...progress, items: selected } satisfies GooglePhotosJob)); throw new Error('google_photos_import_paused'); }
    try {
      const temp = `${FileSystem.cacheDirectory ?? ''}google-photos-${item.id}`;
      const download = await FileSystem.downloadAsync(contentUrl(item), temp, { headers: { Authorization: `Bearer ${token}` } });
      const info = await FileSystem.getInfoAsync(download.uri);
      const size = 'size' in info && typeof info.size === 'number' ? info.size : undefined;
      const sourceModifiedAt = item.mediaFile?.mediaMetadata?.creationTime ? Date.parse(item.mediaFile.mediaMetadata.creationTime) : undefined;
      await importToVault(download.uri, filenameFor(item), typeFor(item.mediaFile?.mimeType), item.mediaFile?.mimeType, size, undefined, { sourceKey, sourceModifiedAt: Number.isFinite(sourceModifiedAt) ? sourceModifiedAt : undefined });
      await FileSystem.deleteAsync(download.uri, { idempotent: true });
      progress.completed += 1; progress.downloadedBytes += size ?? 0;
    } catch { progress.failed += 1; }
    await SecureStore.setItemAsync(JOB_KEY, JSON.stringify({ ...progress, items: selected } satisfies GooglePhotosJob));
    onProgress({ ...progress });
  }
  await SecureStore.deleteItemAsync(JOB_KEY);
  return progress;
}

export async function getGooglePhotosJob(): Promise<GooglePhotosJob | null> { const raw = await SecureStore.getItemAsync(JOB_KEY); if (!raw) return null; try { return JSON.parse(raw) as GooglePhotosJob; } catch { return null; } }
