import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import { NativeModules } from 'react-native';
import { MediaType } from '../../types/domain';
import {
  createImportJob,
  enqueueImportSources,
  getImportNativeConfig,
  getImportQueueCount,
  getNextImportSource,
  getImportJob,
  ImportSource,
  listResumableImportJobs,
  markImportSource,
  MediaImportJob,
  updateImportJob,
  importToVault,
} from './mediaVaultService';

const BATCH_SIZE = 50;

export interface ScanProgress {
  scannedFiles: number;
  expectedFiles?: number;
  estimatedBytes: number;
  currentName?: string;
}

export interface NativeGalleryImportModule {
  startImport(jobId: string, databasePath: string, vaultDirectory: string): Promise<string>;
  pauseImport(jobId: string): Promise<boolean>;
  cancelImport(jobId: string): Promise<boolean>;
}

function getNativeImportModule() {
  return NativeModules.MurshidGallery as NativeGalleryImportModule | undefined;
}

function inferMediaType(name: string, mimeType?: string): MediaType {
  const candidate = `${mimeType ?? ''} ${name}`.toLowerCase();
  if (candidate.includes('video') || /\.(mp4|m4v|mov|mkv|webm|3gp|avi)$/i.test(name)) return 'video';
  if (candidate.includes('image') || /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tif|tiff|dng|raw)$/i.test(name)) return 'image';
  return 'file';
}

async function localSize(uri: string, hint?: number): Promise<number> {
  if (typeof hint === 'number' && Number.isFinite(hint) && hint >= 0) return hint;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && !info.isDirectory && typeof info.size === 'number' ? info.size : 0;
  } catch {
    return 0;
  }
}

async function queueBatches(jobId: string, batch: ImportSource[], progress: ScanProgress, onProgress?: (value: ScanProgress) => void) {
  if (!batch.length) return;
  await enqueueImportSources(jobId, batch);
  batch.length = 0;
  onProgress?.({ ...progress });
}

export async function scanDeviceLibrary(
  jobId: string,
  onProgress?: (value: ScanProgress) => void,
  shouldStop?: () => boolean,
  kinds: readonly ('photo' | 'video')[] = ['photo', 'video'],
) {
  const totals = await Promise.all(kinds.map(async (mediaType) => {
    try { return (await MediaLibrary.getAssetsAsync({ first: 1, mediaType })).totalCount; } catch { return 0; }
  }));
  const progress: ScanProgress = { scannedFiles: 0, expectedFiles: totals.reduce((sum, value) => sum + value, 0), estimatedBytes: 0 };
  const batch: ImportSource[] = [];

  for (const mediaType of kinds) {
    let after: string | undefined;
    do {
      if (shouldStop?.()) throw new Error('تم إلغاء الفحص.');
      const page = await MediaLibrary.getAssetsAsync({ first: 100, after, mediaType, sortBy: [MediaLibrary.SortBy.creationTime] });
      for (const asset of page.assets) {
        if (shouldStop?.()) throw new Error('تم إلغاء الفحص.');
        const type: MediaType = mediaType === 'video' ? 'video' : 'image';
        const size = await localSize(asset.uri);
        batch.push({
          uri: asset.uri,
          filename: asset.filename || `media-${asset.id}`,
          type,
          size,
          sourceKey: `device:${asset.id}`,
          sourceModifiedAt: asset.modificationTime,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
        });
        progress.scannedFiles += 1;
        progress.estimatedBytes += size;
        progress.currentName = asset.filename;
        if (batch.length >= BATCH_SIZE) await queueBatches(jobId, batch, progress, onProgress);
        else if (progress.scannedFiles % 10 === 0) onProgress?.({ ...progress });
      }
      await queueBatches(jobId, batch, progress, onProgress);
      after = page.hasNextPage ? page.endCursor : undefined;
    } while (after);
  }

  const actual = await getImportJob(jobId);
  await updateImportJob(jobId, {
    state: 'ready',
    totalFiles: actual?.totalFiles ?? progress.scannedFiles,
    totalBytes: actual?.totalBytes ?? progress.estimatedBytes,
    error: undefined,
  });
  return { ...progress, scannedFiles: actual?.totalFiles ?? progress.scannedFiles, estimatedBytes: actual?.totalBytes ?? progress.estimatedBytes };
}

export async function createPickerImportJob(assets: DocumentPicker.DocumentPickerAsset[], targetAlbumId?: string) {
  const jobId = await createImportJob('picker', targetAlbumId);
  const sources: ImportSource[] = assets.map((asset) => ({
    uri: asset.uri,
    filename: asset.name,
    type: inferMediaType(asset.name, asset.mimeType),
    mimeType: asset.mimeType,
    size: asset.size ?? 0,
    sourceKey: `picker:${asset.uri}:${asset.size ?? 0}`,
    sourceModifiedAt: asset.lastModified,
  }));
  await enqueueImportSources(jobId, sources);
  const job = await getImportJob(jobId);
  await updateImportJob(jobId, { state: 'ready', totalFiles: job?.totalFiles ?? sources.length, totalBytes: job?.totalBytes ?? 0 });
  return jobId;
}

function nameFromSafUri(uri: string) {
  try {
    const decoded = decodeURIComponent(uri);
    const documentPart = decoded.split('/document/').pop() ?? decoded;
    return documentPart.split(':').pop()?.split('/').pop() || 'media';
  } catch {
    return uri.split('/').pop() || 'media';
  }
}

export async function scanSafFolder(jobId: string, directoryUri: string, onProgress?: (value: ScanProgress) => void, shouldStop?: () => boolean) {
  const stack = [directoryUri];
  const visited = new Set<string>();
  const batch: ImportSource[] = [];
  const progress: ScanProgress = { scannedFiles: 0, estimatedBytes: 0 };
  while (stack.length) {
    if (shouldStop?.()) throw new Error('تم إلغاء فحص المجلد.');
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const children = await FileSystem.StorageAccessFramework.readDirectoryAsync(current);
    for (const child of children) {
      if (shouldStop?.()) throw new Error('تم إلغاء فحص المجلد.');
      const info = await FileSystem.getInfoAsync(child).catch(() => null);
      if (info?.exists && info.isDirectory) {
        stack.push(child);
        continue;
      }
      const filename = nameFromSafUri(child);
      const type = inferMediaType(filename);
      if (!info?.exists || type === 'file') continue;
      const size = typeof info.size === 'number' ? info.size : 0;
      batch.push({ uri: child, filename, type, size, sourceKey: `saf:${child}:${size}` });
      progress.scannedFiles += 1;
      progress.estimatedBytes += size;
      progress.currentName = filename;
      if (batch.length >= BATCH_SIZE) await queueBatches(jobId, batch, progress, onProgress);
      else if (progress.scannedFiles % 10 === 0) onProgress?.({ ...progress });
    }
  }
  await queueBatches(jobId, batch, progress, onProgress);
  const actual = await getImportJob(jobId);
  await updateImportJob(jobId, { state: 'ready', totalFiles: actual?.totalFiles ?? progress.scannedFiles, totalBytes: actual?.totalBytes ?? progress.estimatedBytes });
  return { ...progress, scannedFiles: actual?.totalFiles ?? progress.scannedFiles, estimatedBytes: actual?.totalBytes ?? progress.estimatedBytes };
}

export async function startNativeImport(jobId: string) {
  const nativeModule = getNativeImportModule();
  if (!nativeModule) throw new Error('ميزة الاستيراد الخلفي تحتاج إصدار Android جديدًا من التطبيق.');
  const { databasePath, vaultDirectory } = await getImportNativeConfig();
  await updateImportJob(jobId, { state: 'running', error: undefined });
  return nativeModule.startImport(jobId, databasePath, vaultDirectory);
}

export async function pauseNativeImport(jobId: string) {
  await updateImportJob(jobId, { state: 'paused' });
  return getNativeImportModule()?.pauseImport(jobId) ?? false;
}

export async function cancelNativeImport(jobId: string) {
  await updateImportJob(jobId, { state: 'cancelled', currentFilename: undefined });
  return getNativeImportModule()?.cancelImport(jobId) ?? false;
}

export async function runForegroundFallback(jobId: string, shouldStop: () => boolean, onProgress?: (job: MediaImportJob) => void) {
  await updateImportJob(jobId, { state: 'running', error: undefined });
  while (!shouldStop()) {
    const job = await getImportJob(jobId);
    if (!job || job.state !== 'running') return;
    const next = await getNextImportSource(jobId);
    if (!next) break;
    await updateImportJob(jobId, { currentFilename: next.filename });
    try {
      const item = await importToVault(next.uri, next.filename, next.type, next.mimeType, next.size, undefined, next);
      await markImportSource(jobId, next.id, 'completed');
      await updateImportJob(jobId, { completedFiles: job.completedFiles + 1, copiedBytes: job.copiedBytes + (item.size ?? next.size ?? 0), currentFilename: undefined });
    } catch (error) {
      await markImportSource(jobId, next.id, 'failed', error instanceof Error ? error.message : 'تعذر نسخ الملف.');
      await updateImportJob(jobId, { failedFiles: job.failedFiles + 1, currentFilename: undefined });
    }
    const updated = await getImportJob(jobId);
    if (updated) onProgress?.(updated);
  }
  const remaining = await getImportQueueCount(jobId);
  if (remaining === 0) await updateImportJob(jobId, { state: 'completed', currentFilename: undefined });
}

export async function listPendingJobs() {
  return listResumableImportJobs();
}
