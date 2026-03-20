-- Step 1: See what pipeline_status values actually exist
SELECT pipeline_status, COUNT(*) FROM pm_organizations GROUP BY pipeline_status;

-- Step 2: Find and drop ALL check constraints on pipeline_status
-- (constraint name may differ from what we expect)
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'pm_organizations'
  AND con.contype = 'c'
  AND pg_get_constraintdef(con.oid) LIKE '%pipeline_status%';
