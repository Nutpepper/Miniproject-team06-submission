-- Read-only preflight: run each SELECT separately in Supabase SQL Editor.
-- Capture the results securely; no secrets should be included in the output.
-- The SQL Editor role must be able to see all relevant rows and policies.

-- Expected: exactly one row per required table.
SELECT n.nspname AS schema_name, c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('submissions','submission_files','user_roles')
  AND c.relkind IN ('r','p') ORDER BY c.relname;

-- Verify required columns and types, and that the two supersession columns
-- are not already present. Stop if the live schema differs from the migration.
SELECT table_name, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('submissions','submission_files')
ORDER BY table_name, ordinal_position;

-- Expected absent before a first migration; existing objects require review.
SELECT to_regclass('public.submission_supersession_migration_backup') AS backup_table,
       to_regclass('public.submissions_one_active_idx') AS new_index,
       to_regprocedure('public.create_submission_atomic(uuid,text,text,text,text,text,timestamp with time zone,text,jsonb)') AS new_rpc;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname='public' AND tablename IN ('submissions','submission_files'))
   OR (schemaname='storage' AND tablename='objects')
ORDER BY schemaname, tablename, policyname;

SELECT n.nspname, c.relname, t.tgname, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('submissions','submission_files') AND NOT t.tgisinternal;

SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE conrelid IN ('public.submissions'::regclass, 'public.submission_files'::regclass)
   OR confrelid IN ('public.submissions'::regclass, 'public.submission_files'::regclass)
ORDER BY 1,2;
SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('submissions','submission_files');

WITH groups AS (
  SELECT student_id, assignment_id, count(*) AS n FROM public.submissions
  WHERE cancelled_at IS NULL GROUP BY student_id, assignment_id HAVING count(*) > 1
)
SELECT count(*) AS duplicate_groups, coalesce(sum(n-1),0) AS excess_active_records,
       coalesce(max(n),0) AS max_active_per_group FROM groups;
-- Previously reported: 4 / 16 / 8; stop and investigate if the baseline changes.

WITH ranked AS (
  SELECT student_id, assignment_id, submission_id, submitted_at,
         row_number() OVER (PARTITION BY student_id,assignment_id ORDER BY submitted_at DESC,submission_id DESC) AS position,
         count(*) OVER (PARTITION BY student_id,assignment_id) AS group_size
  FROM public.submissions WHERE cancelled_at IS NULL
)
SELECT student_id,assignment_id,submission_id,submitted_at,position,group_size,
       CASE WHEN position=1 THEN 'KEEP_ACTIVE' ELSE 'MARK_SUPERSEDED' END AS planned_action
FROM ranked WHERE group_size>1 ORDER BY student_id,assignment_id,position;
-- Expected when baseline unchanged: 20 rows, 4 keep and 16 supersede.

SELECT count(*) AS total_submissions, count(*) FILTER (WHERE cancelled_at IS NOT NULL) AS cancelled
FROM public.submissions;
SELECT count(*) AS attachment_metadata FROM public.submission_files;
SELECT bucket_id, count(*) AS object_count FROM storage.objects WHERE bucket_id IN ('submissions','avatars') GROUP BY bucket_id;
