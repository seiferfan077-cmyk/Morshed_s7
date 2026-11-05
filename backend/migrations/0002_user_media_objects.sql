CREATE TABLE IF NOT EXISTS user_media_objects (
  id TEXT PRIMARY KEY NOT NULL,
  owner_uid TEXT NOT NULL,
  client_media_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0),
  created_at INTEGER NOT NULL,
  UNIQUE (owner_uid, client_media_id)
);

CREATE INDEX IF NOT EXISTS user_media_objects_owner_created_idx
  ON user_media_objects (owner_uid, created_at DESC, id DESC);
