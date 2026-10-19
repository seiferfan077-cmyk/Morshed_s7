import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
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
  sourceKey?: string;
  sourceModifiedAt?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface MediaAlbum {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  folderId?: string;
  coverMediaId?: string;
  coverUri?: string;
  itemCount: number;
}

export interface MediaFolder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
  itemCount: number;
}

export type ImportJobState = 'scanning' | 'ready' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
export interface MediaImportJob {
  id: string;
  source: 'device' | 'picker' | 'folder' | 'share';
  targetAlbumId?: string;
  state: ImportJobState;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalBytes: number;
  copiedBytes: number;
  currentBytes: number;
  currentFilename?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportSource {
  uri: string;
  filename: string;
  type: MediaType;
  mimeType?: string;
  size?: number;
  sourceKey?: string;
  sourceModifiedAt?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface MediaPageOptions {
  offset?: number;
  limit?: number;
  type?: MediaType;
  hidden?: boolean;
  albumId?: string;
  search?: string;
  sort?: 'newest' | 'oldest' | 'name' | 'size';
}

export interface MediaStats {
  itemCount: number;
  totalBytes: number;
  imageCount: number;
  videoCount: number;
  fileCount: number;
  imageBytes: number;
  videoBytes: number;
  fileBytes: number;
  freeBytes?: number;
}

const ITEMS_KEY = '@murshid/media-vault-items';
const PIN_KEY = '@murshid/media-vault-pin';
const PIN_LAST_CHAR_KEY = '@murshid/media-vault-pin-last-char';
const RECOVERY_QUESTION_KEY = '@murshid/media-vault-recovery-question';
const RECOVERY_ANSWER_KEY = '@murshid/media-vault-recovery-answer';
const DEVICE_HIDDEN_KEY = '@murshid/media-device-hidden';
const DEVICE_REMOVED_KEY = '@murshid/media-device-removed';
const DB_NAME = 'murshid-gallery.db';
const VAULT_DIR = `${FileSystem.documentDirectory ?? ''}murshid-vault/`;
const SELECT_MEDIA = `SELECT m.id, m.uri, m.filename, m.type, m.mime_type AS mimeType, m.size,
  m.created_at AS createdAt, m.hidden, m.source, m.device_asset_id AS deviceAssetId,
  m.source_key AS sourceKey, m.source_modified_at AS sourceModifiedAt,
  m.width, m.height, m.duration FROM media_items m`;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toMediaItem(row: Record<string, unknown>): StoredMediaItem {
  return {
    id: String(row.id),
    uri: String(row.uri),
    filename: String(row.filename),
    type: row.type === 'video' || row.type === 'file' ? row.type : 'image',
    mimeType: typeof row.mimeType === 'string' ? row.mimeType : undefined,
    size: typeof row.size === 'number' ? row.size : undefined,
    createdAt: String(row.createdAt),
    hidden: Boolean(row.hidden),
    source: 'imported',
    deviceAssetId: typeof row.deviceAssetId === 'string' ? row.deviceAssetId : undefined,
    sourceKey: typeof row.sourceKey === 'string' ? row.sourceKey : undefined,
    sourceModifiedAt: typeof row.sourceModifiedAt === 'number' ? row.sourceModifiedAt : undefined,
    width: typeof row.width === 'number' ? row.width : undefined,
    height: typeof row.height === 'number' ? row.height : undefined,
    duration: typeof row.duration === 'number' ? row.duration : undefined,
  };
}

async function migrateLegacyItems(db: SQLite.SQLiteDatabase) {
  const migrated = await db.getFirstAsync<{ value: string }>("SELECT value FROM gallery_meta WHERE key = 'asyncstorage-items-migrated'");
  if (migrated) return;
  const raw = await AsyncStorage.getItem(ITEMS_KEY);
  if (raw) {
    try {
      const legacy = JSON.parse(raw) as Partial<StoredMediaItem>[];
      if (Array.isArray(legacy)) {
        await db.withTransactionAsync(async () => {
          for (const old of legacy) {
            if (!old || typeof old.id !== 'string' || typeof old.uri !== 'string' || typeof old.filename !== 'string') continue;
            const type: MediaType = old.type === 'video' || old.type === 'file' ? old.type : 'image';
            await db.runAsync(
              `INSERT OR IGNORE INTO media_items (id, uri, filename, type, mime_type, size, created_at, hidden, source, device_asset_id, source_key, source_modified_at, width, height, duration, import_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'imported', ?, ?, ?, ?, ?, ?, 'complete')`,
              old.id, old.uri, old.filename, type, old.mimeType ?? null, old.size ?? null,
              old.createdAt ?? new Date().toISOString(), old.hidden ? 1 : 0, old.deviceAssetId ?? null,
              old.deviceAssetId ? `device:${old.deviceAssetId}` : (old.sourceKey ?? null),
              old.sourceModifiedAt ?? null, old.width ?? null, old.height ?? null, old.duration ?? null,
            );
          }
          await db.runAsync("INSERT OR REPLACE INTO gallery_meta (key, value) VALUES ('asyncstorage-items-migrated', '1')");
        });
      }
    } catch {
      // Keep the legacy value intact if it cannot be parsed; never discard user metadata during migration.
      throw new Error('تعذر ترحيل فهرس الوسائط القديم. لم تُحذف البيانات السابقة.');
    }
  } else {
    await db.runAsync("INSERT OR REPLACE INTO gallery_meta (key, value) VALUES ('asyncstorage-items-migrated', '1')");
  }
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;
        CREATE TABLE IF NOT EXISTS gallery_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS media_items (
          id TEXT PRIMARY KEY NOT NULL,
          uri TEXT NOT NULL,
          filename TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('image','video','file')),
          mime_type TEXT,
          size INTEGER,
          created_at TEXT NOT NULL,
          hidden INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'imported',
          device_asset_id TEXT,
          source_key TEXT,
          source_modified_at INTEGER,
          width INTEGER,
          height INTEGER,
          duration REAL,
          import_status TEXT NOT NULL DEFAULT 'complete'
        );
        CREATE UNIQUE INDEX IF NOT EXISTS media_items_source_key_idx ON media_items(source_key) WHERE source_key IS NOT NULL;
        CREATE INDEX IF NOT EXISTS media_items_created_idx ON media_items(created_at DESC, id);
        CREATE INDEX IF NOT EXISTS media_items_type_hidden_idx ON media_items(type, hidden, import_status);
        CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS albums (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
          cover_media_id TEXT REFERENCES media_items(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS albums_folder_idx ON albums(folder_id, sort_order, name);
        CREATE TABLE IF NOT EXISTS album_media (
          album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
          media_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
          added_at TEXT NOT NULL,
          PRIMARY KEY(album_id, media_id)
        );
        CREATE INDEX IF NOT EXISTS album_media_media_idx ON album_media(media_id);
        CREATE TABLE IF NOT EXISTS import_jobs (
          id TEXT PRIMARY KEY NOT NULL,
          source TEXT NOT NULL,
          target_album_id TEXT REFERENCES albums(id) ON DELETE SET NULL,
          state TEXT NOT NULL,
          total_files INTEGER NOT NULL DEFAULT 0,
          completed_files INTEGER NOT NULL DEFAULT 0,
          failed_files INTEGER NOT NULL DEFAULT 0,
          total_bytes INTEGER NOT NULL DEFAULT 0,
          copied_bytes INTEGER NOT NULL DEFAULT 0,
          current_bytes INTEGER NOT NULL DEFAULT 0,
          current_filename TEXT,
          error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS import_job_items (
          id TEXT PRIMARY KEY NOT NULL,
          job_id TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
          source_uri TEXT NOT NULL,
          filename TEXT NOT NULL,
          type TEXT NOT NULL,
          mime_type TEXT,
          size INTEGER NOT NULL DEFAULT 0,
          source_key TEXT,
          source_modified_at INTEGER,
          width INTEGER,
          height INTEGER,
          duration REAL,
          media_id TEXT NOT NULL,
          target_uri TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          error TEXT,
          position INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS import_job_items_queue_idx ON import_job_items(job_id, status, position);
        CREATE INDEX IF NOT EXISTS import_jobs_state_idx ON import_jobs(state, updated_at DESC);
      `);
      const importJobColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(import_jobs)');
      if (!importJobColumns.some((column) => column.name === 'target_album_id')) {
        await db.execAsync('ALTER TABLE import_jobs ADD COLUMN target_album_id TEXT REFERENCES albums(id) ON DELETE SET NULL');
      }
      await migrateLegacyItems(db);
      return db;
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

async function ensureVault() {
  if (!FileSystem.documentDirectory) throw new Error('مساحة تخزين التطبيق غير متاحة.');
  if (!(await FileSystem.getInfoAsync(VAULT_DIR)).exists) {
    await FileSystem.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
  }
}

function safeFilename(filename: string) {
  return filename.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180) || 'media';
}

function mapJob(row: Record<string, unknown>): MediaImportJob {
  return {
    id: String(row.id), source: row.source as MediaImportJob['source'],
    targetAlbumId: typeof row.targetAlbumId === 'string' ? row.targetAlbumId : undefined,
    state: row.state as ImportJobState,
    totalFiles: Number(row.totalFiles ?? 0), completedFiles: Number(row.completedFiles ?? 0), failedFiles: Number(row.failedFiles ?? 0),
    totalBytes: Number(row.totalBytes ?? 0), copiedBytes: Number(row.copiedBytes ?? 0), currentBytes: Number(row.currentBytes ?? 0),
    currentFilename: typeof row.currentFilename === 'string' ? row.currentFilename : undefined,
    error: typeof row.error === 'string' ? row.error : undefined,
    createdAt: String(row.createdAt), updatedAt: String(row.updatedAt),
  };
}

const JOB_SELECT = `SELECT id, source, state, total_files AS totalFiles, completed_files AS completedFiles,
  failed_files AS failedFiles, total_bytes AS totalBytes, copied_bytes AS copiedBytes, current_bytes AS currentBytes,
  current_filename AS currentFilename, target_album_id AS targetAlbumId, error, created_at AS createdAt, updated_at AS updatedAt FROM import_jobs`;

export async function listStoredMedia(): Promise<StoredMediaItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(`${SELECT_MEDIA} WHERE m.import_status = 'complete' ORDER BY m.created_at DESC`);
  return rows.map(toMediaItem);
}

export async function listStoredMediaPage(options: MediaPageOptions = {}): Promise<StoredMediaItem[]> {
  const db = await getDatabase();
  const where = ["m.import_status = 'complete'"];
  const params: (string | number)[] = [];
  if (options.hidden !== undefined) { where.push('m.hidden = ?'); params.push(options.hidden ? 1 : 0); }
  if (options.type) { where.push('m.type = ?'); params.push(options.type); }
  if (options.search?.trim()) { where.push('m.filename LIKE ?'); params.push(`%${options.search.trim()}%`); }
  if (options.albumId) {
    where.push('EXISTS (SELECT 1 FROM album_media am WHERE am.media_id = m.id AND am.album_id = ?)');
    params.push(options.albumId);
  }
  const limit = Math.max(1, Math.min(options.limit ?? 60, 200));
  const offset = Math.max(0, options.offset ?? 0);
  const orderBy = options.sort === 'oldest' ? 'm.created_at ASC, m.id' : options.sort === 'name' ? 'm.filename COLLATE NOCASE ASC, m.id' : options.sort === 'size' ? 'm.size DESC, m.id' : 'm.created_at DESC, m.id';
  const rows = await db.getAllAsync<Record<string, unknown>>(`${SELECT_MEDIA} WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, ...params, limit, offset);
  return rows.map(toMediaItem);
}

export async function getStoredMediaCount(options: Omit<MediaPageOptions, 'offset' | 'limit'> = {}) {
  const db = await getDatabase();
  const where = ["m.import_status = 'complete'"];
  const params: (string | number)[] = [];
  if (options.hidden !== undefined) { where.push('m.hidden = ?'); params.push(options.hidden ? 1 : 0); }
  if (options.type) { where.push('m.type = ?'); params.push(options.type); }
  if (options.search?.trim()) { where.push('m.filename LIKE ?'); params.push(`%${options.search.trim()}%`); }
  if (options.albumId) { where.push('EXISTS (SELECT 1 FROM album_media am WHERE am.media_id=m.id AND am.album_id=?)'); params.push(options.albumId); }
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM media_items m WHERE ${where.join(' AND ')}`, ...params);
  return Number(row?.count ?? 0);
}

export async function getMediaStats(): Promise<MediaStats> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ itemCount: number; totalBytes: number; imageCount: number; videoCount: number; fileCount: number; imageBytes: number; videoBytes: number; fileBytes: number }>(
    `SELECT COUNT(*) AS itemCount, COALESCE(SUM(COALESCE(size, 0)),0) AS totalBytes,
      SUM(CASE WHEN type='image' THEN 1 ELSE 0 END) AS imageCount,
      SUM(CASE WHEN type='video' THEN 1 ELSE 0 END) AS videoCount,
      SUM(CASE WHEN type='file' THEN 1 ELSE 0 END) AS fileCount,
      COALESCE(SUM(CASE WHEN type='image' THEN COALESCE(size, 0) ELSE 0 END),0) AS imageBytes,
      COALESCE(SUM(CASE WHEN type='video' THEN COALESCE(size, 0) ELSE 0 END),0) AS videoBytes,
      COALESCE(SUM(CASE WHEN type='file' THEN COALESCE(size, 0) ELSE 0 END),0) AS fileBytes FROM media_items WHERE import_status='complete'`,
  );
  let freeBytes: number | undefined;
  try { freeBytes = await FileSystem.getFreeDiskStorageAsync(); } catch { /* platform may not expose capacity */ }
  return { itemCount: Number(row?.itemCount ?? 0), totalBytes: Number(row?.totalBytes ?? 0), imageCount: Number(row?.imageCount ?? 0), videoCount: Number(row?.videoCount ?? 0), fileCount: Number(row?.fileCount ?? 0), imageBytes: Number(row?.imageBytes ?? 0), videoBytes: Number(row?.videoBytes ?? 0), fileBytes: Number(row?.fileBytes ?? 0), freeBytes };
}

export async function importToVault(uri: string, filename: string, type: MediaType, mimeType?: string, size?: number, deviceAssetId?: string, metadata: Partial<ImportSource> = {}) {
  const db = await getDatabase();
  const sourceKey = metadata.sourceKey ?? (deviceAssetId ? `device:${deviceAssetId}` : `uri:${uri}`);
  const existing = await db.getFirstAsync<Record<string, unknown>>(`${SELECT_MEDIA} WHERE m.source_key = ? AND m.import_status='complete' LIMIT 1`, sourceKey);
  if (existing) return toMediaItem(existing);
  await ensureVault();
  const freeBytes = await FileSystem.getFreeDiskStorageAsync().catch(() => undefined);
  if (typeof size === 'number' && typeof freeBytes === 'number' && size > freeBytes) {
    throw new Error(`المساحة غير كافية لنسخ ${filename}. المتاح ${freeBytes} بايت، والمطلوب نحو ${size} بايت.`);
  }
  const id = newId('vault');
  const target = `${VAULT_DIR}${id}-${safeFilename(filename)}`;
  const partial = `${target}.partial`;
  try {
    await FileSystem.deleteAsync(partial, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: partial });
    const copied = await FileSystem.getInfoAsync(partial);
    if (!copied.exists || copied.isDirectory) throw new Error('لم يكتمل نسخ الملف إلى مساحة مُرشد.');
    await FileSystem.moveAsync({ from: partial, to: target });
    const item: StoredMediaItem = {
      id, uri: target, filename, type, mimeType, size: copied.size ?? size,
      createdAt: new Date().toISOString(), hidden: false, source: 'imported',
      deviceAssetId, sourceKey, sourceModifiedAt: metadata.sourceModifiedAt,
      width: metadata.width, height: metadata.height, duration: metadata.duration,
    };
    await db.runAsync(
      `INSERT INTO media_items (id, uri, filename, type, mime_type, size, created_at, hidden, source, device_asset_id, source_key, source_modified_at, width, height, duration, import_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'imported', ?, ?, ?, ?, ?, ?, 'complete')`,
      item.id, item.uri, item.filename, item.type, item.mimeType ?? null, item.size ?? null, item.createdAt,
      item.deviceAssetId ?? null, item.sourceKey ?? null, item.sourceModifiedAt ?? null, item.width ?? null, item.height ?? null, item.duration ?? null,
    );
    return item;
  } catch (error) {
    await FileSystem.deleteAsync(partial, { idempotent: true }).catch(() => undefined);
    throw error;
  }
}

export async function setStoredMediaHidden(id: string, hidden: boolean) {
  const db = await getDatabase();
  await db.runAsync('UPDATE media_items SET hidden = ? WHERE id = ?', hidden ? 1 : 0, id);
}

export async function deleteStoredMedia(id: string) {
  const db = await getDatabase();
  const item = await db.getFirstAsync<{ uri: string }>('SELECT uri FROM media_items WHERE id = ?', id);
  if (!item) return;
  await FileSystem.deleteAsync(item.uri, { idempotent: true });
  await db.runAsync('DELETE FROM media_items WHERE id = ?', id);
}

export async function renameStoredMedia(id: string, filename: string) {
  const db = await getDatabase();
  const current = await db.getFirstAsync<{ uri: string }>('SELECT uri FROM media_items WHERE id=?', id);
  if (!current) throw new Error('العنصر غير موجود.');
  const cleanName = safeFilename(filename);
  const extension = current.uri.includes('.') ? current.uri.slice(current.uri.lastIndexOf('.')) : '';
  const target = `${VAULT_DIR}${id}-${cleanName}${extension && !cleanName.toLowerCase().endsWith(extension.toLowerCase()) ? extension : ''}`;
  if (target !== current.uri) {
    await FileSystem.moveAsync({ from: current.uri, to: target });
    await db.runAsync('UPDATE media_items SET uri=?, filename=? WHERE id=?', target, filename.trim(), id);
  } else {
    await db.runAsync('UPDATE media_items SET filename=? WHERE id=?', filename.trim(), id);
  }
}

export async function listAlbums(folderId?: string | null, search?: string): Promise<MediaAlbum[]> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: string[] = [];
  if (folderId !== undefined) { conditions.push('a.folder_id IS ?'); params.push(folderId ?? null as unknown as string); }
  if (search?.trim()) { conditions.push('a.name LIKE ?'); params.push(`%${search.trim()}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT a.id, a.name, a.created_at AS createdAt, a.updated_at AS updatedAt, a.folder_id AS folderId,
      a.cover_media_id AS coverMediaId, m.uri AS coverUri, COUNT(am.media_id) AS itemCount
     FROM albums a LEFT JOIN album_media am ON am.album_id=a.id
     LEFT JOIN media_items m ON m.id=a.cover_media_id ${where}
     GROUP BY a.id, m.uri ORDER BY a.sort_order, a.name COLLATE NOCASE`, ...params,
  );
  return rows.map((row) => ({
    id: String(row.id), name: String(row.name), createdAt: String(row.createdAt), updatedAt: String(row.updatedAt),
    folderId: typeof row.folderId === 'string' ? row.folderId : undefined,
    coverMediaId: typeof row.coverMediaId === 'string' ? row.coverMediaId : undefined,
    coverUri: typeof row.coverUri === 'string' ? row.coverUri : undefined,
    itemCount: Number(row.itemCount ?? 0),
  }));
}

export async function createAlbum(name: string, folderId?: string) {
  const db = await getDatabase();
  const id = newId('album');
  const now = new Date().toISOString();
  await db.runAsync('INSERT INTO albums (id, name, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', id, name.trim(), folderId ?? null, now, now);
  return id;
}

export async function renameAlbum(id: string, name: string) {
  const db = await getDatabase();
  await db.runAsync('UPDATE albums SET name=?, updated_at=? WHERE id=?', name.trim(), new Date().toISOString(), id);
}

export async function deleteAlbum(id: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM albums WHERE id=?', id);
}

export async function setAlbumFolder(id: string, folderId?: string) {
  const db = await getDatabase();
  await db.runAsync('UPDATE albums SET folder_id=?, updated_at=? WHERE id=?', folderId ?? null, new Date().toISOString(), id);
}

export async function addMediaToAlbum(albumId: string, mediaIds: string[]) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const mediaId of mediaIds) await db.runAsync('INSERT OR IGNORE INTO album_media (album_id, media_id, added_at) VALUES (?, ?, ?)', albumId, mediaId, now);
    await db.runAsync('UPDATE albums SET updated_at=? WHERE id=?', now, albumId);
  });
}

export async function removeMediaFromAlbum(albumId: string, mediaIds: string[]) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const mediaId of mediaIds) await db.runAsync('DELETE FROM album_media WHERE album_id=? AND media_id=?', albumId, mediaId);
  });
}

export async function setAlbumCover(albumId: string, mediaId?: string) {
  const db = await getDatabase();
  await db.runAsync('UPDATE albums SET cover_media_id=?, updated_at=? WHERE id=?', mediaId ?? null, new Date().toISOString(), albumId);
}

export async function listFolders(parentId?: string | null): Promise<MediaFolder[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT f.id, f.name, f.parent_id AS parentId, f.created_at AS createdAt,
      (SELECT COUNT(*) FROM albums a WHERE a.folder_id=f.id) AS itemCount
     FROM folders f WHERE f.parent_id IS ? ORDER BY f.sort_order, f.name COLLATE NOCASE`, parentId ?? null,
  );
  return rows.map((row) => ({ id: String(row.id), name: String(row.name), parentId: typeof row.parentId === 'string' ? row.parentId : undefined, createdAt: String(row.createdAt), itemCount: Number(row.itemCount ?? 0) }));
}

export async function createFolder(name: string, parentId?: string) {
  const db = await getDatabase();
  const id = newId('folder');
  await db.runAsync('INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)', id, name.trim(), parentId ?? null, new Date().toISOString());
  return id;
}

export async function renameFolder(id: string, name: string) {
  const db = await getDatabase();
  await db.runAsync('UPDATE folders SET name=? WHERE id=?', name.trim(), id);
}

export async function deleteFolder(id: string) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE albums SET folder_id=NULL WHERE folder_id=?', id);
    await db.runAsync('UPDATE folders SET parent_id=NULL WHERE parent_id=?', id);
    await db.runAsync('DELETE FROM folders WHERE id=?', id);
  });
}

export async function createImportJob(source: MediaImportJob['source'], targetAlbumId?: string): Promise<string> {
  const db = await getDatabase();
  const id = newId('import');
  const now = new Date().toISOString();
  await db.runAsync('INSERT INTO import_jobs (id, source, target_album_id, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', id, source, targetAlbumId ?? null, 'scanning', now, now);
  return id;
}

export async function enqueueImportSources(jobId: string, sources: ImportSource[]) {
  if (!sources.length) return;
  const db = await getDatabase();
  await ensureVault();
  await db.withTransactionAsync(async () => {
    const base = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM import_job_items WHERE job_id=?', jobId);
    let position = Number(base?.count ?? 0);
    for (const source of sources) {
      const sourceId = newId('source');
      const mediaId = newId('vault');
      const targetUri = `${VAULT_DIR}${mediaId}-${safeFilename(source.filename)}`;
      await db.runAsync(
        `INSERT OR IGNORE INTO import_job_items (id, job_id, source_uri, filename, type, mime_type, size, source_key, source_modified_at, width, height, duration, media_id, target_uri, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        sourceId, jobId, source.uri, source.filename, source.type, source.mimeType ?? null,
        Math.max(0, source.size ?? 0), source.sourceKey ?? null, source.sourceModifiedAt ?? null,
        source.width ?? null, source.height ?? null, source.duration ?? null, mediaId, targetUri, position++,
      );
    }
    await db.runAsync(
      `UPDATE import_jobs SET total_files=(SELECT COUNT(*) FROM import_job_items WHERE job_id=?),
       total_bytes=(SELECT COALESCE(SUM(size),0) FROM import_job_items WHERE job_id=?), updated_at=? WHERE id=?`,
      jobId, jobId, new Date().toISOString(), jobId,
    );
  });
}

export async function updateImportJob(jobId: string, update: Partial<Pick<MediaImportJob, 'state' | 'totalFiles' | 'completedFiles' | 'failedFiles' | 'totalBytes' | 'copiedBytes' | 'currentBytes' | 'currentFilename' | 'error'>>) {
  const db = await getDatabase();
  const fields: string[] = [];
  const params: (string | number | null)[] = [];
  const map: Record<string, string> = { state: 'state', totalFiles: 'total_files', completedFiles: 'completed_files', failedFiles: 'failed_files', totalBytes: 'total_bytes', copiedBytes: 'copied_bytes', currentBytes: 'current_bytes', currentFilename: 'current_filename', error: 'error' };
  for (const [key, column] of Object.entries(map)) {
    if (key in update) { fields.push(`${column}=?`); params.push((update as Record<string, unknown>)[key] as string | number | null ?? null); }
  }
  if (!fields.length) return;
  fields.push('updated_at=?');
  params.push(new Date().toISOString(), jobId);
  await db.runAsync(`UPDATE import_jobs SET ${fields.join(', ')} WHERE id=?`, ...params);
}

export async function getImportJob(jobId: string): Promise<MediaImportJob | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(`${JOB_SELECT} WHERE id=?`, jobId);
  return row ? mapJob(row) : null;
}

export async function listResumableImportJobs(): Promise<MediaImportJob[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(`${JOB_SELECT} WHERE state IN ('scanning','ready','running','paused','failed') ORDER BY updated_at DESC`);
  return rows.map(mapJob);
}

export async function getNextImportSource(jobId: string): Promise<ImportSource & { id: string } | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT id, source_uri AS uri, filename, type, mime_type AS mimeType, size, source_key AS sourceKey,
      source_modified_at AS sourceModifiedAt, width, height, duration FROM import_job_items
     WHERE job_id=? AND status='pending' ORDER BY position LIMIT 1`, jobId,
  );
  if (!row) return null;
  return { id: String(row.id), uri: String(row.uri), filename: String(row.filename), type: row.type as MediaType,
    mimeType: typeof row.mimeType === 'string' ? row.mimeType : undefined, size: Number(row.size ?? 0),
    sourceKey: typeof row.sourceKey === 'string' ? row.sourceKey : undefined,
    sourceModifiedAt: typeof row.sourceModifiedAt === 'number' ? row.sourceModifiedAt : undefined,
    width: typeof row.width === 'number' ? row.width : undefined, height: typeof row.height === 'number' ? row.height : undefined,
    duration: typeof row.duration === 'number' ? row.duration : undefined };
}

export async function markImportSource(jobId: string, sourceId: string, status: 'completed' | 'failed' | 'pending', error?: string) {
  const db = await getDatabase();
  await db.runAsync('UPDATE import_job_items SET status=?, error=? WHERE job_id=? AND id=?', status, error ?? null, jobId, sourceId);
}

export async function getImportNativeConfig() {
  const db = await getDatabase();
  await ensureVault();
  return { databasePath: db.databasePath, vaultDirectory: VAULT_DIR };
}

export async function isSourceAlreadyImported(sourceKey?: string) {
  if (!sourceKey) return false;
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string }>("SELECT id FROM media_items WHERE source_key=? AND import_status='complete' LIMIT 1", sourceKey);
  return Boolean(row);
}

export async function removeImportJob(jobId: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM import_jobs WHERE id=?', jobId);
}

export async function getImportQueueCount(jobId: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM import_job_items WHERE job_id=? AND status='pending'", jobId);
  return Number(row?.count ?? 0);
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
  if (hidden) visibility.hidden.add(id);
  else visibility.hidden.delete(id);
  await AsyncStorage.setItem(DEVICE_HIDDEN_KEY, JSON.stringify([...visibility.hidden]));
}

export async function setDeviceAssetRemoved(id: string) {
  const visibility = await getDeviceAssetVisibility();
  visibility.removed.add(id);
  await AsyncStorage.setItem(DEVICE_REMOVED_KEY, JSON.stringify([...visibility.removed]));
}
