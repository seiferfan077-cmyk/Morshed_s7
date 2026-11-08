const assert = require('node:assert/strict');
const { hasSQLiteIntegrityFailure, isSQLiteDatabaseCorruption } = require('../.tmp-sqlite-recovery-test/sqliteRecoveryPolicy.js');
const { getUnrecoverableCoreTables, normalizeGalleryRecoverySnapshot, prepareGalleryRecoveryRows } = require('../.tmp-sqlite-recovery-test/sqliteRecoveryData.js');

assert.equal(isSQLiteDatabaseCorruption(new Error('database disk image is malformed')), true);
assert.equal(isSQLiteDatabaseCorruption({ code: 'SQLITE_CORRUPT', message: 'statement failed' }), true);
assert.equal(isSQLiteDatabaseCorruption({ code: 'SQLITE_NOTADB', message: 'file is not a database' }), true);
assert.equal(isSQLiteDatabaseCorruption(new Error('database is locked')), false);
assert.equal(isSQLiteDatabaseCorruption(new Error('no such table: media_items')), false);
assert.equal(hasSQLiteIntegrityFailure('ok'), false);
assert.equal(hasSQLiteIntegrityFailure('row 14 missing from index media_items_created_idx'), true);
assert.equal(hasSQLiteIntegrityFailure(undefined), true);

const snapshot = normalizeGalleryRecoverySnapshot({
  version: 1,
  snapshotId: 'snapshot-1',
  skippedTables: [],
  rows: {
    gallery_meta: [{ key: 'asyncstorage-items-migrated', value: '1' }],
    private_folders: [],
    media_items: [
      { id: 'public-item', uri: 'file:///vault/public.jpg', filename: 'public.jpg', type: 'image', private_folder_id: null },
      { id: 'private-item', uri: 'file:///vault/private.jpg', filename: 'private.jpg', type: 'image', private_folder_id: 'private-1' },
    ],
    folders: [
      { id: 'parent-folder', name: 'الأصل', parent_id: null },
      { id: 'child-folder', name: 'الفرعي', parent_id: 'parent-folder' },
      { id: 'orphan-folder', name: 'يتيم', parent_id: 'missing-folder' },
    ],
    albums: [
      { id: 'album', name: 'ألبومي', folder_id: 'child-folder', cover_media_id: 'public-item' },
      { id: 'orphan-album', name: 'ألبوم قديم', folder_id: 'missing-folder', cover_media_id: 'missing-media' },
      { id: 'private-cover-album', name: 'غلاف خاص', folder_id: null, cover_media_id: 'private-item' },
    ],
    album_media: [
      { album_id: 'album', media_id: 'public-item', added_at: '2026-01-01' },
      { album_id: 'album', media_id: 'private-item', added_at: '2026-01-01' },
      { album_id: 'missing-album', media_id: 'public-item', added_at: '2026-01-01' },
    ],
    import_jobs: [{ id: 'job-1', source: 'picker', target_album_id: 'missing-album' }],
    import_job_items: [
      { id: 'queue-item', job_id: 'job-1', filename: 'pending.jpg' },
      { id: 'orphan-queue-item', job_id: 'missing-job', filename: 'orphan.jpg' },
    ],
  },
});
assert.ok(snapshot);
const rows = prepareGalleryRecoveryRows(snapshot);
assert.equal(rows.media_items.length, 2);
assert.equal(rows.private_folders[0].id, 'private-1');
assert.equal(rows.albums.find((row) => row.id === 'album').folder_id, 'child-folder');
assert.equal(rows.albums.find((row) => row.id === 'orphan-album').folder_id, null);
assert.equal(rows.albums.find((row) => row.id === 'orphan-album').cover_media_id, null);
assert.equal(rows.albums.find((row) => row.id === 'private-cover-album').cover_media_id, null);
assert.equal(rows.album_media.length, 1);
assert.equal(rows.folders.find((row) => row.id === 'orphan-folder').parent_id, null);
assert.equal(rows.import_jobs[0].target_album_id, null);
assert.equal(rows.import_job_items.length, 1);
assert.equal(normalizeGalleryRecoverySnapshot({ version: 2 }), null);
assert.deepEqual(getUnrecoverableCoreTables({ ...snapshot, skippedTables: ['media_items'] }), ['media_items']);
assert.deepEqual(getUnrecoverableCoreTables({ ...snapshot, skippedTables: ['import_jobs'] }), []);
console.log('SQLite recovery policy and data-preservation tests passed.');
