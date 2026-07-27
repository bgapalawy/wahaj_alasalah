-- Run in Neon's SQL Editor, after migration_ncr_table.sql.
-- Separate from `note` (the OPENING reason) so closing an NCR doesn't
-- overwrite why it was raised in the first place — both are kept and
-- both show up in the status timeline and NCR report.

ALTER TABLE villa_item_ncr
  ADD COLUMN IF NOT EXISTS closing_note TEXT;
