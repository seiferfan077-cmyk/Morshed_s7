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

CREATE TABLE IF NOT EXISTS channel_admin_sessions (
  token_hash TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES channel_admins(uid) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS channel_admin_sessions_uid_idx ON channel_admin_sessions(uid, expires_at);

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
CREATE INDEX IF NOT EXISTS channel_posts_created_idx ON channel_posts(created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS channel_devices (
  token TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS channel_devices_uid_idx ON channel_devices(uid);

CREATE TABLE IF NOT EXISTS channel_replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES channel_posts(id),
  author_uid TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS channel_replies_post_idx ON channel_replies(post_id, created_at ASC);

CREATE TABLE IF NOT EXISTS channel_reactions (
  post_id TEXT NOT NULL REFERENCES channel_posts(id),
  uid TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, uid, emoji)
);
