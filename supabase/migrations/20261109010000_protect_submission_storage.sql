-- Block client mutations of existing submission objects, including when another
-- permissive policy grants them. Service-role maintenance bypasses RLS and must
-- be separately controlled. Review all effective roles/policies before rollout.
BEGIN;
CREATE POLICY "Protect submission objects from client deletion"
ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated
USING (bucket_id IS DISTINCT FROM 'submissions');

-- Uploads use INSERT with upsert=false. Deny overwrites, moves and renames of
-- submission objects as well; leave avatar UPDATE/INSERT policies untouched.
CREATE POLICY "Protect submission objects from client update"
ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
USING (bucket_id IS DISTINCT FROM 'submissions')
WITH CHECK (bucket_id IS DISTINCT FROM 'submissions');
COMMIT;
