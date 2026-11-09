-- Apply only during a coordinated maintenance window with the matching API.
BEGIN;
LOCK TABLE public.submissions IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.submission_files IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.submissions ADD COLUMN superseded_at timestamptz;
ALTER TABLE public.submissions ADD COLUMN superseded_by_submission_id uuid REFERENCES public.submissions(submission_id);

-- Record precisely what this migration changes for verification and rollback.
CREATE TABLE public.submission_supersession_migration_backup (
  submission_id uuid PRIMARY KEY REFERENCES public.submissions(submission_id),
  superseded_at timestamptz,
  superseded_by_submission_id uuid
);
REVOKE ALL ON public.submission_supersession_migration_backup FROM PUBLIC, anon, authenticated;

WITH ranked AS (
  SELECT submission_id, first_value(submission_id) OVER w AS newest_id,
         row_number() OVER w AS position
  FROM public.submissions WHERE cancelled_at IS NULL
  WINDOW w AS (PARTITION BY student_id, assignment_id ORDER BY submitted_at DESC, submission_id DESC)
), backed_up AS (
  INSERT INTO public.submission_supersession_migration_backup
    (submission_id, superseded_at, superseded_by_submission_id)
  SELECT s.submission_id, s.superseded_at, s.superseded_by_submission_id
  FROM public.submissions s JOIN ranked r USING (submission_id) WHERE r.position > 1
  RETURNING submission_id
)
UPDATE public.submissions s SET superseded_at = now(), superseded_by_submission_id = r.newest_id
FROM ranked r, backed_up b WHERE s.submission_id = r.submission_id AND b.submission_id = s.submission_id;

ALTER TABLE public.submissions ADD CONSTRAINT submissions_lifecycle_consistency CHECK (
  NOT (cancelled_at IS NOT NULL AND superseded_at IS NOT NULL)
  AND (superseded_by_submission_id IS NULL OR superseded_at IS NOT NULL)
  AND (superseded_by_submission_id IS NULL OR superseded_by_submission_id <> submission_id)
);
CREATE UNIQUE INDEX submissions_one_active_idx ON public.submissions(student_id, assignment_id)
  WHERE cancelled_at IS NULL AND superseded_at IS NULL;
DROP INDEX IF EXISTS public.submissions_active_lookup_idx;
COMMENT ON COLUMN public.submissions.cancelled_at IS 'Timestamp of explicit cancellation';
COMMENT ON COLUMN public.submissions.superseded_at IS 'Timestamp when a later submission replaced this record';

DROP POLICY IF EXISTS "Students can insert own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students can update own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students can insert own submission files" ON public.submission_files;

-- Only the trusted API, after verifying the JWT and Team 05 deadline, can call this.
CREATE FUNCTION public.create_submission_atomic(
  p_student_id uuid, p_assignment_id text, p_submission_type text,
  p_file_name text, p_file_path text, p_external_link text,
  p_due_at timestamptz, p_client_request_id text,
  p_attachments jsonb
) RETURNS public.submissions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  result public.submissions;
  old_ids uuid[];
  submitted_time timestamptz;
BEGIN
  IF p_student_id IS NULL OR p_assignment_id IS NULL OR btrim(p_assignment_id) = ''
     OR p_due_at IS NULL THEN
    RAISE EXCEPTION 'Invalid submission arguments' USING ERRCODE = '22023';
  END IF;
  -- The idempotency key spans assignments, so lock it separately as well.
  IF p_client_request_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('request:' || p_student_id::text || ':' || p_client_request_id, 0));
    IF EXISTS (SELECT 1 FROM public.submissions WHERE student_id = p_student_id AND client_request_id = p_client_request_id) THEN
      RAISE EXCEPTION 'Duplicate submission request' USING ERRCODE = '23505', CONSTRAINT = 'submissions_student_client_request_idx';
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('submission:' || p_student_id::text || ':' || p_assignment_id, 0));
  -- Cancellation uses a conditional row UPDATE. Lock the current row before
  -- re-reading it so a concurrent cancellation cannot invalidate old_ids.
  PERFORM 1 FROM public.submissions
    WHERE student_id = p_student_id AND assignment_id = p_assignment_id
      AND cancelled_at IS NULL AND superseded_at IS NULL
    FOR UPDATE;
  submitted_time := clock_timestamp();
  SELECT array_agg(submission_id) INTO old_ids FROM public.submissions
    WHERE student_id = p_student_id AND assignment_id = p_assignment_id
      AND cancelled_at IS NULL AND superseded_at IS NULL;
  UPDATE public.submissions SET superseded_at = submitted_time
    WHERE submission_id = ANY(old_ids);
  INSERT INTO public.submissions (student_id, assignment_id, submission_type, file_name, file_path, external_link, submitted_at, status, client_request_id)
    VALUES (p_student_id, p_assignment_id, p_submission_type, p_file_name, p_file_path, p_external_link, submitted_time,
      CASE WHEN submitted_time > p_due_at THEN 'LATE' ELSE 'ON_TIME' END, p_client_request_id)
    RETURNING * INTO result;
  IF p_submission_type = 'FILE' THEN
    INSERT INTO public.submission_files (submission_id, student_id, file_name, file_path, file_size, sort_order)
    SELECT result.submission_id, p_student_id, a.value->>'file_name', a.value->>'file_path',
      (a.value->>'file_size')::bigint, (a.ordinality - 1)::integer
    FROM jsonb_array_elements(p_attachments) WITH ORDINALITY AS a(value, ordinality);
  END IF;
  UPDATE public.submissions SET superseded_by_submission_id = result.submission_id WHERE submission_id = ANY(old_ids);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_submission_atomic(uuid,text,text,text,text,text,timestamptz,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_submission_atomic(uuid,text,text,text,text,text,timestamptz,text,jsonb) TO service_role;
COMMIT;
