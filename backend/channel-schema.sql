CREATE TABLE IF NOT EXISTS channel_admins (
  uid TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin')),
  password_hash TEXT,
  password_salt TEXT,
  bootstrap_used INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS channel_posts (
  id TEXT PRIMARY KEY,
  author_uid TEXT NOT NULL,
  body TEXT NOT NULL,
  audio_key TEXT,
  file_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS channel_replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES channel_posts(id),
  author_uid TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS channel_reactions (
  post_id TEXT NOT NULL REFERENCES channel_posts(id),
  uid TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, uid, emoji)
);
CREATE INDEX IF NOT EXISTS channel_posts_created_idx ON channel_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS channel_replies_post_idx ON channel_replies(post_id, created_at ASC);
