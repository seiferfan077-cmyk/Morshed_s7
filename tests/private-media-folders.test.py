import sqlite3
import unittest


class PrivateMediaFolderMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys = ON')
        self.db.executescript('''
            CREATE TABLE media_items (
              id TEXT PRIMARY KEY NOT NULL,
              uri TEXT NOT NULL,
              filename TEXT NOT NULL,
              type TEXT NOT NULL,
              size INTEGER,
              created_at TEXT NOT NULL,
              import_status TEXT NOT NULL DEFAULT 'complete'
            );
            CREATE TABLE albums (
              id TEXT PRIMARY KEY NOT NULL,
              name TEXT NOT NULL,
              cover_media_id TEXT REFERENCES media_items(id)
            );
            CREATE TABLE album_media (
              album_id TEXT NOT NULL REFERENCES albums(id),
              media_id TEXT NOT NULL REFERENCES media_items(id),
              PRIMARY KEY(album_id, media_id)
            );
            INSERT INTO media_items VALUES ('regular', '/vault/regular.jpg', 'regular.jpg', 'image', 10, '2026-01-01', 'complete');
            INSERT INTO albums VALUES ('album', 'Ordinary album', NULL);
            INSERT INTO album_media VALUES ('album', 'regular');
        ''')

    def tearDown(self):
        self.db.close()

    def migrate(self):
        self.db.execute('''CREATE TABLE IF NOT EXISTS private_folders (
          id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL
        )''')
        cols = {row[1] for row in self.db.execute('PRAGMA table_info(media_items)')}
        if 'private_folder_id' not in cols:
            self.db.execute('ALTER TABLE media_items ADD COLUMN private_folder_id TEXT REFERENCES private_folders(id)')
        self.db.execute('CREATE INDEX IF NOT EXISTS media_items_private_folder_idx ON media_items(private_folder_id, created_at DESC)')

    def test_migration_is_idempotent_and_preserves_existing_media(self):
        self.migrate()
        self.migrate()
        row = self.db.execute('SELECT id, filename, private_folder_id FROM media_items WHERE id="regular"').fetchone()
        self.assertEqual(row, ('regular', 'regular.jpg', None))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM media_items').fetchone()[0], 1)

    def test_private_items_are_excluded_from_general_library_and_stats(self):
        self.migrate()
        self.db.execute('INSERT INTO private_folders VALUES (?, ?, ?)', ('locked', 'Private', '2026-01-02'))
        self.db.execute('INSERT INTO media_items (id, uri, filename, type, size, created_at, import_status, private_folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        ('secret', '/vault/secret.jpg', 'secret.jpg', 'image', 99, '2026-01-02', 'complete', 'locked'))
        regular = self.db.execute("SELECT id FROM media_items WHERE import_status='complete' AND private_folder_id IS NULL").fetchall()
        stats = self.db.execute("SELECT COUNT(*), COALESCE(SUM(size), 0) FROM media_items WHERE import_status='complete' AND private_folder_id IS NULL").fetchone()
        self.assertEqual(regular, [('regular',)])
        self.assertEqual(stats, (1, 10))

    def test_open_folder_query_returns_only_its_items(self):
        self.migrate()
        self.db.executemany('INSERT INTO private_folders VALUES (?, ?, ?)', [
            ('locked-a', 'A', '2026-01-02'), ('locked-b', 'B', '2026-01-03')
        ])
        self.db.executemany('INSERT INTO media_items (id, uri, filename, type, size, created_at, import_status, private_folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
            ('secret-a', '/a.jpg', 'a.jpg', 'image', 5, '2026-01-02', 'complete', 'locked-a'),
            ('secret-b', '/b.jpg', 'b.jpg', 'image', 6, '2026-01-03', 'complete', 'locked-b'),
        ])
        rows = self.db.execute("SELECT id FROM media_items WHERE import_status='complete' AND private_folder_id=?", ('locked-a',)).fetchall()
        self.assertEqual(rows, [('secret-a',)])

    def test_private_cover_and_count_do_not_leak_to_normal_albums(self):
        self.migrate()
        self.db.execute('INSERT INTO private_folders VALUES (?, ?, ?)', ('locked', 'Private', '2026-01-02'))
        self.db.execute('INSERT INTO media_items (id, uri, filename, type, size, created_at, import_status, private_folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        ('secret', '/vault/secret.jpg', 'secret.jpg', 'image', 99, '2026-01-02', 'complete', 'locked'))
        self.db.execute('INSERT INTO album_media VALUES (?, ?)', ('album', 'secret'))
        self.db.execute('UPDATE albums SET cover_media_id=? WHERE id=?', ('secret', 'album'))
        result = self.db.execute('''
          SELECT
            (SELECT cm.uri FROM media_items cm WHERE cm.id=a.cover_media_id AND cm.private_folder_id IS NULL) AS coverUri,
            (SELECT COUNT(*) FROM album_media am JOIN media_items im ON im.id=am.media_id
             WHERE am.album_id=a.id AND im.private_folder_id IS NULL) AS itemCount
          FROM albums a WHERE a.id='album'
        ''').fetchone()
        self.assertEqual(result, (None, 1))


if __name__ == '__main__':
    unittest.main(verbosity=2)
