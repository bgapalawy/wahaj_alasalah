-- One shared set of branding info for the whole project (not per-user,
-- not per-villa) — project name and a caption shown under the logo.
-- The logo image itself isn't stored here — it reuses the existing S3
-- upload system under the fixed prefix "branding-logo" (see
-- uploadPrefixValidation.js), so there's no separate upload path to
-- build or maintain.
--
-- Always exactly one row (id = 1) — this is a singleton settings table,
-- not a list.
--
-- Run once in Neon's SQL Editor, or:
--   psql "$DATABASE_URL" -f db/schema-project-settings.sql

CREATE TABLE IF NOT EXISTS project_settings (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  project_name  TEXT,
  logo_caption  TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO project_settings (id, project_name, logo_caption)
VALUES (1, 'Sahms ElGhroub', NULL)
ON CONFLICT (id) DO NOTHING;
