\set ON_ERROR_STOP on
\if :{?test_student_id}
\else
  \echo 'Missing test_student_id'
  \quit 1
\endif
\if :{?test_run_id}
\else
  \echo 'Missing test_run_id'
  \quit 1
\endif
SELECT current_database() = 'unilearn_resubmission_staging' AND inet_server_addr() IN ('127.0.0.1'::inet, '::1'::inet) AS safe_target \gset
\if :safe_target
\else
  \echo 'Refusing non-local or incorrectly named database'
  \quit 1
\endif
BEGIN;
SELECT set_config('test.student_id', :'test_student_id', true), set_config('test.run_id', :'test_run_id', true);
DO $$
DECLARE started timestamptz := clock_timestamp();
BEGIN
  PERFORM public.create_submission_atomic(current_setting('test.student_id')::uuid, 'concurrency-' || current_setting('test.run_id'),
    'LINK', NULL, NULL, 'https://example.invalid/second', clock_timestamp() + interval '1 hour', NULL, '[]');
  IF clock_timestamp() - started < interval '2 seconds' THEN
    RAISE EXCEPTION 'Second request did not wait; repeat with overlapping sessions';
  END IF;
  RAISE NOTICE 'Second transaction waited for the same student and assignment lock';
END $$;
ROLLBACK;
\echo 'Second transaction rolled back.'
