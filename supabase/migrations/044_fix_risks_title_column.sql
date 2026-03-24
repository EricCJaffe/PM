-- ═══════════════════════════════════════════════════════════════════════════
-- 044: Ensure pm_risks has the title column
-- ═══════════════════════════════════════════════════════════════════════════
-- The title column was defined in 001_pm_schema.sql but may be missing
-- from the live database if the table was created before that column was
-- added to the CREATE TABLE statement. The 002_add_missing_columns.sql
-- migration patched other columns but omitted title.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE pm_risks ADD COLUMN IF NOT EXISTS title TEXT;

-- Backfill any rows that somehow have NULL title (shouldn't happen, but safe)
UPDATE pm_risks SET title = slug WHERE title IS NULL;

-- Now make it NOT NULL (safe after backfill)
DO $$ BEGIN
  ALTER TABLE pm_risks ALTER COLUMN title SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
