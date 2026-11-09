ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS score NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS feedback TEXT;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_score_range_check CHECK (score IS NULL OR (score >= 0 AND score <= 100));

DROP POLICY IF EXISTS "Admins can update grades" ON public.submissions;
CREATE POLICY "Admins can update grades"
  ON public.submissions FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admins can view submission files" ON storage.objects;
CREATE POLICY "Admins can view submission files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'submissions' AND public.is_admin_user());
