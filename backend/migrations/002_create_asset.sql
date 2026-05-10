CREATE TABLE IF NOT EXISTS asset (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  original_url TEXT,
  storage_path TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  size_bytes   BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
