CREATE TABLE IF NOT EXISTS project (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  canvas      JSONB NOT NULL DEFAULT '{"elements":[]}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_canvas_gin ON project USING gin(canvas);
