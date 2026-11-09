-- Multiple attachments for one assignment submission.
CREATE TABLE IF NOT EXISTS public.submission_files (
  file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(submission_id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submission_files_submission_id_idx ON public.submission_files (submission_id, sort_order);
ALTER TABLE public.submission_files ENABLE ROW LEVEL SECURITY;

-- Some existing deployments predate the role helper in the initial schema.
-- Define it here as well so this migration can be safely applied independently.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Students can view own submission files" ON public.submission_files;
DROP POLICY IF EXISTS "Students can insert own submission files" ON public.submission_files;
DROP POLICY IF EXISTS "Admins can view all submission files" ON public.submission_files;

CREATE POLICY "Students can view own submission files" ON public.submission_files FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Students can insert own submission files" ON public.submission_files FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Admins can view all submission files" ON public.submission_files FOR SELECT TO authenticated USING (public.is_admin_user());
