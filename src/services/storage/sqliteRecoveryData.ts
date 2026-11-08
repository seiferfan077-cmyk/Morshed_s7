export const GALLERY_RECOVERY_COLUMNS = {
  gallery_meta: ['key', 'value'],
  private_folders: ['id', 'name', 'created_at'],
  media_items: ['id', 'uri', 'filename', 'type', 'mime_type', 'size', 'created_at', 'hidden', 'source', 'device_asset_id', 'source_key', 'source_modified_at', 'private_folder_id', 'width', 'height', 'duration', 'import_status'],
  folders: ['id', 'name', 'parent_id', 'created_at', 'sort_order'],
  albums: ['id', 'name', 'folder_id', 'cover_media_id', 'created_at', 'updated_at', 'sort_order'],
  album_media: ['album_id', 'media_id', 'added_at'],
  import_jobs: ['id', 'source', 'target_album_id', 'state', 'total_files', 'completed_files', 'failed_files', 'total_bytes', 'copied_bytes', 'current_bytes', 'current_filename', 'error', 'created_at', 'updated_at'],
  import_job_items: ['id', 'job_id', 'source_uri', 'filename', 'type', 'mime_type', 'size', 'source_key', 'source_modified_at', 'width', 'height', 'duration', 'media_id', 'target_uri', 'status', 'error', 'position'],
} as const;

export type GalleryRecoveryTable = keyof typeof GALLERY_RECOVERY_COLUMNS;
export type GalleryRecoveryRow = Record<string, unknown>;
export interface GalleryRecoverySnapshot {
  version: 1;
  snapshotId: string;
  rows: Partial<Record<GalleryRecoveryTable, GalleryRecoveryRow[]>>;
  skippedTables: GalleryRecoveryTable[];
}

export const GALLERY_RECOVERY_TABLES = Object.keys(GALLERY_RECOVERY_COLUMNS) as GalleryRecoveryTable[];
export const GALLERY_RECOVERY_CORE_TABLES: GalleryRecoveryTable[] = [
  'gallery_meta', 'private_folders', 'media_items', 'folders', 'albums', 'album_media',
];

export function getUnrecoverableCoreTables(snapshot: GalleryRecoverySnapshot): GalleryRecoveryTable[] {
  return GALLERY_RECOVERY_CORE_TABLES.filter((table) => snapshot.skippedTables.includes(table));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeGalleryRecoverySnapshot(value: unknown): GalleryRecoverySnapshot | null {
  if (!isRecord(value) || value.version !== 1 || typeof value.snapshotId !== 'string' || !isRecord(value.rows)) return null;
  const rows: Partial<Record<GalleryRecoveryTable, GalleryRecoveryRow[]>> = {};
  for (const table of GALLERY_RECOVERY_TABLES) {
    const tableRows = value.rows[table];
    rows[table] = Array.isArray(tableRows) ? tableRows.filter(isRecord) : [];
  }
  const skippedTables = Array.isArray(value.skippedTables)
    ? value.skippedTables.filter((table): table is GalleryRecoveryTable => GALLERY_RECOVERY_TABLES.includes(table as GalleryRecoveryTable))
    : [];
  return { version: 1, snapshotId: value.snapshotId, rows, skippedTables };
}

export function prepareGalleryRecoveryRows(snapshot: GalleryRecoverySnapshot): Record<GalleryRecoveryTable, GalleryRecoveryRow[]> {
  const rows = Object.fromEntries(GALLERY_RECOVERY_TABLES.map((table) => [table, [...(snapshot.rows[table] ?? [])]])) as Record<GalleryRecoveryTable, GalleryRecoveryRow[]>;

  const privateFolderIds = new Set(rows.private_folders.map((row) => row.id).filter((id): id is string => typeof id === 'string'));
  for (const media of rows.media_items) {
    const folderId = media.private_folder_id;
    if (typeof folderId === 'string' && !privateFolderIds.has(folderId)) {
      rows.private_folders.push({ id: folderId, name: 'مجلد خاص مستعاد', created_at: typeof media.created_at === 'string' ? media.created_at : new Date(0).toISOString() });
      privateFolderIds.add(folderId);
    }
  }

  const folderIds = new Set(rows.folders.map((row) => row.id).filter((id): id is string => typeof id === 'string'));
  const parentById = new Map<string, string>();
  for (const folder of rows.folders) {
    if (typeof folder.id === 'string' && typeof folder.parent_id === 'string') parentById.set(folder.id, folder.parent_id);
  }
  for (const folder of rows.folders) {
    if (typeof folder.id !== 'string' || typeof folder.parent_id !== 'string') continue;
    if (!folderIds.has(folder.parent_id) || folder.parent_id === folder.id) {
      folder.parent_id = null;
      continue;
    }
    const visited = new Set([folder.id]);
    let parentId: string | undefined = folder.parent_id;
    while (parentId) {
      if (visited.has(parentId)) {
        folder.parent_id = null;
        break;
      }
      visited.add(parentId);
      parentId = parentById.get(parentId);
    }
  }

  const mediaById = new Map(rows.media_items.filter((row) => typeof row.id === 'string').map((row) => [row.id as string, row]));
  const albumIds = new Set(rows.albums.map((row) => row.id).filter((id): id is string => typeof id === 'string'));
  const publicMediaIds = new Set([...mediaById.entries()].filter(([, row]) => row.private_folder_id == null).map(([id]) => id));
  for (const album of rows.albums) {
    if (typeof album.folder_id === 'string' && !folderIds.has(album.folder_id)) album.folder_id = null;
    if (typeof album.cover_media_id === 'string' && !publicMediaIds.has(album.cover_media_id)) album.cover_media_id = null;
  }
  rows.album_media = rows.album_media.filter((row) => typeof row.album_id === 'string' && albumIds.has(row.album_id)
    && typeof row.media_id === 'string' && publicMediaIds.has(row.media_id));

  for (const job of rows.import_jobs) {
    if (typeof job.target_album_id === 'string' && !albumIds.has(job.target_album_id)) job.target_album_id = null;
  }
  const jobIds = new Set(rows.import_jobs.map((row) => row.id).filter((id): id is string => typeof id === 'string'));
  rows.import_job_items = rows.import_job_items.filter((row) => typeof row.job_id === 'string' && jobIds.has(row.job_id));

  return rows;
}
