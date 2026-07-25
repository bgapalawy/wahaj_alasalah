-- Extends project_settings for 5 logos instead of 1 — each logo's image
-- file still goes through the existing S3 upload system (fixed prefixes
-- branding-logo-1 through branding-logo-5, see uploadPrefixValidation.js),
-- this table just holds each one's caption text plus the shared project
-- name.
--
-- Safe to run even if project_settings already exists from the earlier
-- single-logo version — ADD COLUMN IF NOT EXISTS, and the old
-- logo_caption column (if present) is left alone rather than dropped,
-- in case anything still references it.
--
-- Run once in Neon's SQL Editor, or:
--   psql "$DATABASE_URL" -f db/schema-project-settings-v2.sql

ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS logo_caption_1 TEXT;
ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS logo_caption_2 TEXT;
ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS logo_caption_3 TEXT;
ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS logo_caption_4 TEXT;
ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS logo_caption_5 TEXT;

-- One-time carry-over: if the old single logo_caption had something in
-- it, put it in slot 1 so it isn't silently lost.
UPDATE project_settings
SET logo_caption_1 = logo_caption
WHERE logo_caption IS NOT NULL AND logo_caption_1 IS NULL;
