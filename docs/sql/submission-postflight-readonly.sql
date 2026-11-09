-- Read-only postflight, run during verified write freeze; run SELECTs separately.
-- Expected: no rows.
SELECT student_id, assignment_id, count(*) AS active_count
FROM public.submissions WHERE cancelled_at IS NULL AND superseded_at IS NULL
GROUP BY student_id, assignment_id HAVING count(*) > 1;

-- If the preflight baseline was unchanged, expected 16.
SELECT count(*) AS normalized_records FROM public.submission_supersession_migration_backup;

-- Expected: no rows. Compare the full preflight winner/loser ID list separately.
SELECT old.submission_id, old.superseded_by_submission_id
FROM public.submission_supersession_migration_backup b
JOIN public.submissions old ON old.submission_id=b.submission_id
LEFT JOIN public.submissions newer ON newer.submission_id=old.superseded_by_submission_id
WHERE old.cancelled_at IS NOT NULL OR old.superseded_at IS NULL OR newer.submission_id IS NULL
   OR newer.student_id IS DISTINCT FROM old.student_id OR newer.assignment_id IS DISTINCT FROM old.assignment_id
   OR newer.cancelled_at IS NOT NULL OR newer.superseded_at IS NOT NULL;

-- Expected: UNIQUE, valid, ready, with both active-state predicates.
SELECT i.indexrelid::regclass AS index_name, i.indisunique, i.indisvalid, i.indisready,
       pg_get_indexdef(i.indexrelid) AS definition
FROM pg_index i WHERE i.indexrelid=to_regclass('public.submissions_one_active_idx');

-- Expected: one row, security definer true, fixed search_path,
-- anon/authenticated false and service_role true.
SELECT p.oid::regprocedure AS function_name, pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef, p.proconfig,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.oid=to_regprocedure('public.create_submission_atomic(uuid,text,text,text,text,text,timestamp with time zone,text,jsonb)');

-- Expected: both new policies RESTRICTIVE; avatar policies remain as baseline.
SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname;
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('submissions','submission_files') ORDER BY tablename,policyname;

-- Expected: same counts as the preflight snapshot while writes are frozen.
SELECT count(*) AS total_submissions, count(*) FILTER (WHERE cancelled_at IS NOT NULL) AS cancelled FROM public.submissions;
SELECT count(*) AS attachment_metadata FROM public.submission_files;
SELECT bucket_id,count(*) AS object_count FROM storage.objects WHERE bucket_id IN ('submissions','avatars') GROUP BY bucket_id;
