import * as SQLite from 'expo-sqlite';
import type { ChannelPost } from './channelService';

const DATABASE_NAME = 'murshid-channel-cache.db';
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS channel_posts_cache (
          id TEXT PRIMARY KEY NOT NULL,
          body TEXT NOT NULL,
          audio_key TEXT,
          file_key TEXT,
          pinned_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS channel_posts_cache_created_idx
          ON channel_posts_cache(created_at DESC, id DESC);
      `);
      const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(channel_posts_cache)');
      if (!columns.some((column) => column.name === 'pinned_at')) {
        await database.execAsync('ALTER TABLE channel_posts_cache ADD COLUMN pinned_at INTEGER;');
      }
      return database;
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export async function getCachedChannelPosts(): Promise<ChannelPost[]> {
  const database = await getDatabase();
  return database.getAllAsync<ChannelPost>(
    'SELECT id, body, audio_key, file_key, pinned_at, created_at, updated_at FROM channel_posts_cache ORDER BY (pinned_at IS NOT NULL) DESC, pinned_at DESC, created_at DESC, id DESC',
  );
}

export async function cacheChannelPosts(posts: ChannelPost[], deletedIds: string[] = []) {
  if (!posts.length && !deletedIds.length) return;
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    for (const post of posts) {
      await database.runAsync(
        `INSERT INTO channel_posts_cache (id, body, audio_key, file_key, pinned_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET body=excluded.body, audio_key=excluded.audio_key,
           file_key=excluded.file_key, pinned_at=excluded.pinned_at,
           created_at=excluded.created_at, updated_at=excluded.updated_at`,
        post.id,
        post.body,
        post.audio_key ?? null,
        post.file_key ?? null,
        post.pinned_at ?? null,
        Number(post.created_at),
        Number(post.updated_at),
      );
    }
    for (const id of deletedIds) {
      await database.runAsync('DELETE FROM channel_posts_cache WHERE id = ?', id);
    }
  });
}

export async function removeCachedChannelPosts(ids: string[]) {
  if (!ids.length) return;
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    for (const id of ids) await database.runAsync('DELETE FROM channel_posts_cache WHERE id = ?', id);
  });
}
