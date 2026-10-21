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
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS channel_posts_cache_created_idx
          ON channel_posts_cache(created_at DESC, id DESC);
      `);
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
    'SELECT id, body, audio_key, file_key, created_at, updated_at FROM channel_posts_cache ORDER BY created_at DESC, id DESC',
  );
}

export async function cacheChannelPosts(posts: ChannelPost[]) {
  if (!posts.length) return;
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    for (const post of posts) {
      await database.runAsync(
        `INSERT INTO channel_posts_cache (id, body, audio_key, file_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET body=excluded.body, audio_key=excluded.audio_key,
           file_key=excluded.file_key, created_at=excluded.created_at, updated_at=excluded.updated_at`,
        post.id,
        post.body,
        post.audio_key ?? null,
        post.file_key ?? null,
        Number(post.created_at),
        Number(post.updated_at),
      );
    }
  });
}
