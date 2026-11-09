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
SELECT public.create_submission_atomic(:'test_student_id'::uuid, 'concurrency-' || :'test_run_id', 'LINK', NULL, NULL,
  'https://example.invalid/first', clock_timestamp() + interval '1 hour', NULL, '[]');
\echo 'First lock held for 12 seconds; start second session now.'
SELECT pg_sleep(12);
ROLLBACK;
\echo 'First transaction rolled back.'
