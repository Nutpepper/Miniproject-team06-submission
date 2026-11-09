\set ON_ERROR_STOP on
-- ONLY a disposable, local database named unilearn_resubmission_staging.
-- Pass -v test_student_id=<synthetic auth.users UUID>. All writes roll back.
\if :{?test_student_id}
\else
  \echo 'Missing test_student_id; stopping.'
  \quit 1
\endif
SELECT current_database() = 'unilearn_resubmission_staging'
  AND inet_server_addr() IN ('127.0.0.1'::inet, '::1'::inet) AS safe_target \gset
\if :safe_target
\else
  \echo 'Refusing non-local or incorrectly named database.'
  \quit 1
\endif
BEGIN;
SELECT set_config('test.student_id', :'test_student_id', true);
DO $$
DECLARE
  sid uuid := current_setting('test.student_id')::uuid;
  aid text := 'staging-test-' || gen_random_uuid()::text;
  first_row public.submissions;
  second_row public.submissions;
  third_row public.submissions;
  prior_count integer;
  n integer;
  f regprocedure := 'public.create_submission_atomic(uuid,text,text,text,text,text,timestamp with time zone,text,jsonb)'::regprocedure;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = sid) THEN
    RAISE EXCEPTION 'Synthetic test user missing';
  END IF;
  IF has_function_privilege('anon', f, 'EXECUTE') OR has_function_privilege('authenticated', f, 'EXECUTE')
     OR NOT has_function_privilege('service_role', f, 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected RPC privileges';
  END IF;
  first_row := public.create_submission_atomic(sid, aid, 'FILE', 'old.txt', sid::text || '/old.txt', NULL,
    clock_timestamp() + interval '1 hour', 'staging-1-' || aid,
    jsonb_build_array(jsonb_build_object('file_name', 'old.txt', 'file_path', sid::text || '/old.txt', 'file_size', 10)));
  IF first_row.status <> 'ON_TIME' THEN RAISE EXCEPTION 'First submission status failed'; END IF;
  second_row := public.create_submission_atomic(sid, aid, 'LINK', NULL, NULL, 'https://example.invalid/2',
    clock_timestamp() - interval '1 hour', 'staging-2-' || aid, '[]');
  third_row := public.create_submission_atomic(sid, aid, 'LINK', NULL, NULL, 'https://example.invalid/3',
    clock_timestamp() + interval '1 hour', 'staging-3-' || aid, '[]');
  IF second_row.status <> 'LATE' OR third_row.status <> 'ON_TIME' THEN RAISE EXCEPTION 'Timing failed'; END IF;
  SELECT count(*) INTO n FROM public.submissions WHERE student_id = sid AND assignment_id = aid AND cancelled_at IS NULL AND superseded_at IS NULL;
  IF n <> 1 OR NOT EXISTS (SELECT 1 FROM public.submissions WHERE submission_id = third_row.submission_id AND superseded_at IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.submissions WHERE submission_id = first_row.submission_id AND superseded_by_submission_id = second_row.submission_id)
    OR NOT EXISTS (SELECT 1 FROM public.submissions WHERE submission_id = second_row.submission_id AND superseded_by_submission_id = third_row.submission_id)
    THEN RAISE EXCEPTION 'Active/history lifecycle failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.submission_files WHERE submission_id = first_row.submission_id AND file_name = 'old.txt') THEN
    RAISE EXCEPTION 'Historical attachment metadata missing';
  END IF;
  BEGIN
    INSERT INTO public.submissions(student_id, assignment_id, submission_type, external_link, submitted_at, status)
      VALUES (sid, aid, 'LINK', 'https://example.invalid/direct', clock_timestamp(), 'ON_TIME');
    RAISE EXCEPTION 'Unique active index did not reject insert';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  SELECT count(*) INTO prior_count FROM public.submissions WHERE student_id = sid AND assignment_id = aid;
  BEGIN
    PERFORM public.create_submission_atomic(sid, aid, 'FILE', 'bad.txt', sid::text || '/bad.txt', NULL,
      clock_timestamp(), 'staging-bad-' || aid, '[{"file_name":null,"file_path":"bad"}]');
    RAISE EXCEPTION 'Bad attachment unexpectedly succeeded';
  EXCEPTION WHEN not_null_violation THEN NULL; END;
  IF (SELECT count(*) FROM public.submissions WHERE student_id = sid AND assignment_id = aid) <> prior_count
     OR NOT EXISTS (SELECT 1 FROM public.submissions WHERE submission_id = third_row.submission_id AND superseded_at IS NULL) THEN
    RAISE EXCEPTION 'Failed operation was not rolled back';
  END IF;
  BEGIN
    PERFORM public.create_submission_atomic(sid, aid, 'LINK', NULL, NULL, 'https://example.invalid/duplicate',
      clock_timestamp(), 'staging-3-' || aid, '[]');
    RAISE EXCEPTION 'Duplicate key unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  UPDATE public.submissions SET cancelled_at = clock_timestamp() WHERE submission_id = third_row.submission_id;
  PERFORM public.create_submission_atomic(sid, aid, 'LINK', NULL, NULL, 'https://example.invalid/after-cancel',
    clock_timestamp(), 'staging-4-' || aid, '[]');
  IF NOT EXISTS (SELECT 1 FROM public.submissions WHERE submission_id = third_row.submission_id AND cancelled_at IS NOT NULL AND superseded_at IS NULL) THEN
    RAISE EXCEPTION 'Cancel and resubmit lifecycle failed';
  END IF;
  RAISE NOTICE 'Sequential lifecycle, history, duplicate, unique, rollback and RPC privilege checks passed';
END $$;

-- Test table write policies under the synthetic student's authenticated JWT.
SELECT set_config('request.jwt.claim.sub', :'test_student_id', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE sid uuid := current_setting('test.student_id')::uuid; affected integer;
BEGIN
  IF public.is_admin_user() THEN RAISE EXCEPTION 'Test user must not be an admin'; END IF;
  BEGIN
    PERFORM public.create_submission_atomic(sid, 'staging-direct-rpc', 'LINK', NULL, NULL,
      'https://example.invalid', clock_timestamp(), NULL, '[]');
    RAISE EXCEPTION 'Authenticated RPC unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.submissions(student_id, assignment_id, submission_type, external_link, status)
    VALUES (sid, 'staging-unauthorized-direct', 'LINK', 'https://example.invalid', 'ON_TIME');
    RAISE EXCEPTION 'Direct insert unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.submissions SET status = 'LATE' WHERE student_id = sid;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Direct update unexpectedly succeeded'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.submission_files (submission_id, student_id, file_name, file_path)
    SELECT submission_id, sid, 'direct.txt', sid::text || '/direct.txt'
    FROM public.submissions WHERE student_id = sid LIMIT 1;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Direct attachment insert unexpectedly succeeded'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF EXISTS (SELECT 1 FROM public.submissions WHERE student_id <> sid) THEN
    RAISE EXCEPTION 'RLS exposed another student';
  END IF;
  RAISE NOTICE 'Authenticated direct-insert and row visibility checks passed';
END $$;
ROLLBACK;
\echo 'Transaction rolled back; no test submission records retained.'
