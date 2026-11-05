import * as FileSystem from 'expo-file-system/legacy';
import { CHANNEL_API_BASE } from '../channel/channelService';
import { getFirebaseSignedInIdToken } from '../firebase/firebaseAuthService';
import { importToVault, StoredMediaItem } from './mediaVaultService';

export const MAX_CLOUD_MEDIA_BYTES = 95_000_000;
const RESTORE_SPACE_RESERVE = 5_000_000;
const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff', 'image/x-adobe-dng',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v', 'video/x-matroska', 'video/x-msvideo',
]);

export interface CloudMediaItem {
  id: string;
  clientMediaId: string;
  filename: string;
  type: 'image' | 'video';
  contentType: string;
  size: number;
  createdAt: number;
  contentPath: string;
}

interface ApiErrorBody { error?: { code?: string } }

function contentTypeFor(item: StoredMediaItem) {
  const suppliedType = item.mimeType?.split(';', 1)[0].trim().toLowerCase();
  if (suppliedType?.startsWith(item.type === 'video' ? 'video/' : 'image/')) return suppliedType;
  const extension = item.filename.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    heic: 'image/heic', heif: 'image/heif', avif: 'image/avif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', dng: 'image/x-adobe-dng',
    mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm', '3gp': 'video/3gpp', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  };
  return types[extension ?? ''] ?? '';
}

function parseResponse(body: string): Record<string, unknown> {
  try { return JSON.parse(body) as Record<string, unknown>; } catch { return {}; }
}

export async function uploadMediaToCloud(item: StoredMediaItem, onProgress?: (sent: number, total: number) => void): Promise<CloudMediaItem> {
  if (item.type !== 'image' && item.type !== 'video') throw new Error('unsupported_media_type');
  const fileInfo = await FileSystem.getInfoAsync(item.uri);
  if (!fileInfo.exists || fileInfo.isDirectory) throw new Error('local_media_not_found');
  const size = fileInfo.size ?? item.size ?? 0;
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error('media_size_unavailable');
  if (size > MAX_CLOUD_MEDIA_BYTES) throw new Error('media_too_large');
  const token = await getFirebaseSignedInIdToken();
  const contentType = contentTypeFor(item);
  if (!ALLOWED_MEDIA_TYPES.has(contentType)) throw new Error('unsupported_media_type');

  const task = FileSystem.createUploadTask(`${CHANNEL_API_BASE}/api/media`, item.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'X-Client-Media-Id': item.id,
      'X-Media-Filename': encodeURIComponent(item.filename),
      'X-Media-Type': contentType,
    },
  }, (progress) => onProgress?.(progress.totalBytesSent, progress.totalBytesExpectedToSend));

  const result = await task.uploadAsync();
  if (!result) throw new Error('media_upload_cancelled');
  const response = parseResponse(result.body);
  if (result.status < 200 || result.status >= 300) {
    const code = (response.error as ApiErrorBody['error'])?.code;
    throw new Error(code ?? `media_upload_failed_${result.status}`);
  }
  const media = response.media as CloudMediaItem | undefined;
  if (!media?.id || media.clientMediaId !== item.id) throw new Error('media_upload_invalid_response');
  return media;
}

export async function listCloudMedia(offset = 0): Promise<{ media: CloudMediaItem[]; nextOffset: number | null }> {
  const token = await getFirebaseSignedInIdToken();
  const query = new URLSearchParams({ limit: '50', offset: String(Math.max(0, offset)) });
  const response = await fetch(`${CHANNEL_API_BASE}/api/media?${query}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({})) as ApiErrorBody & { media?: CloudMediaItem[]; nextOffset?: number | null };
  if (!response.ok) throw new Error(body.error?.code ?? `media_list_failed_${response.status}`);
  return { media: Array.isArray(body.media) ? body.media : [], nextOffset: typeof body.nextOffset === 'number' ? body.nextOffset : null };
}

export async function downloadCloudMedia(media: CloudMediaItem): Promise<StoredMediaItem> {
  if (!media || !Number.isSafeInteger(media.size) || media.size <= 0 || media.size > MAX_CLOUD_MEDIA_BYTES) throw new Error('invalid_cloud_media_size');
  if (media.contentPath !== `/api/media/${encodeURIComponent(media.id)}/content`) throw new Error('invalid_cloud_media_path');
  const token = await getFirebaseSignedInIdToken();
  if (!FileSystem.cacheDirectory) throw new Error('media_cache_unavailable');

  let freeBytes: number | undefined;
  try { freeBytes = await FileSystem.getFreeDiskStorageAsync(); } catch { /* some devices do not expose free space */ }
  const estimatedRequired = media.size * 2 + RESTORE_SPACE_RESERVE;
  if (typeof freeBytes === 'number' && freeBytes < estimatedRequired) throw new Error('insufficient_storage');

  const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const target = `${FileSystem.cacheDirectory}murshid-cloud-${localId}.part`;
  try {
    const response = await FileSystem.downloadAsync(`${CHANNEL_API_BASE}${media.contentPath}`, target, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status < 200 || response.status >= 300) throw new Error(`media_download_failed_${response.status}`);
    const actual = await FileSystem.getInfoAsync(response.uri);
    if (!actual.exists || actual.isDirectory || !Number.isSafeInteger(actual.size) || actual.size <= 0) throw new Error('media_download_incomplete');
    if (actual.size > MAX_CLOUD_MEDIA_BYTES) throw new Error('media_too_large');
    if (actual.size !== media.size) throw new Error('media_download_size_mismatch');
    return await importToVault(response.uri, media.filename, media.type, media.contentType, actual.size, undefined, {
      sourceKey: `cloud:${media.id}`,
      sourceModifiedAt: media.createdAt,
    });
  } finally {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
  }
}
