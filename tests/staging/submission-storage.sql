\set ON_ERROR_STOP on
-- Synthetic metadata only, on the independently verified disposable local DB.
-- Pass -v test_student_id=<synthetic auth.users UUID>. All writes roll back.
\if :{?test_student_id}
\else
  \echo 'Missing test_student_id'
  \quit 1
\endif
SELECT current_database() = 'unilearn_resubmission_staging'
  AND inet_server_addr() IN ('127.0.0.1'::inet, '::1'::inet) AS safe_target \gset
\if :safe_target
\else
  \echo 'Refusing non-local or incorrectly named database'
  \quit 1
\endif
BEGIN;
SELECT set_config('test.student_id', :'test_student_id', true),
       set_config('test.run_id', gen_random_uuid()::text, true),
       set_config('request.jwt.claim.sub', :'test_student_id', true);

-- Metadata fixtures are inserted as the privileged staging test connection.
-- No actual Storage API objects are uploaded or deleted by this SQL test.
INSERT INTO storage.objects(bucket_id, name)
VALUES
  ('submissions', current_setting('test.student_id') || '/staging-' || current_setting('test.run_id')),
  ('avatars', current_setting('test.student_id') || '/staging-' || current_setting('test.run_id'));

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  path text := current_setting('test.student_id') || '/staging-' || current_setting('test.run_id');
  n integer;
BEGIN
  IF auth.uid()::text IS DISTINCT FROM current_setting('test.student_id') THEN
    RAISE EXCEPTION 'JWT fixture identity mismatch';
  END IF;
  BEGIN
    DELETE FROM storage.objects WHERE bucket_id = 'submissions' AND name = path;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'Submission object deletion was permitted'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE storage.objects SET metadata = '{"changed":true}'::jsonb WHERE bucket_id = 'submissions' AND name = path;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'Submission object update was permitted'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  INSERT INTO storage.objects(bucket_id, name) VALUES ('submissions', path || '-new');
  INSERT INTO storage.objects(bucket_id, name) VALUES ('avatars', path || '-new');
  UPDATE storage.objects SET metadata = '{"changed":true}'::jsonb WHERE bucket_id = 'avatars' AND name = path;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Avatar update was blocked'; END IF;
  RAISE NOTICE 'Storage policy checks passed';
END $$;
ROLLBACK;
