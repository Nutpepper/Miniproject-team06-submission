# Submission Storage security and orphan review

The proposed migration retains existing policies and adds restrictive DELETE and
UPDATE policies for `anon` and `authenticated` on `submissions`. Restrictive
policies compose with permissive policies using AND, so the existing permissive
student DELETE policy and other permissive policies cannot reopen those operations. Existing
`avatars` policies are not altered. Authenticated admin clients are also subject
to the restriction; server-side service-role operations bypass RLS. Inspect all
other roles, effective policies, grants and trusted server tools in staging.

The app uploads with unique names and `upsert: false`. On partial upload failure
or an uncertain POST response it retains uploaded objects; cancellation and
resubmission do not remove old objects. Disabling client cleanup means orphaned
objects can accumulate and consume storage. Do not auto-delete them: an upload
may be in progress, the response may have been lost after DB commit, metadata or
legacy records may be incomplete, and paths might be referenced elsewhere.

The following inventory is **read-only** and identifies candidates, not proof
that objects are safe to delete. Use an operator-approved retention period,
protect the results as potentially sensitive, and review all references and
in-flight activity. Never delete Storage metadata with SQL; any future cleanup
requires an independently reviewed privileged process and explicit approval.

```sql
SELECT o.name, o.created_at
FROM storage.objects o
WHERE o.bucket_id = 'submissions'
  AND o.created_at < now() - interval '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.submissions s WHERE s.file_path = o.name
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.submission_files f WHERE f.file_path = o.name
  )
ORDER BY o.created_at;
```

Before rollout, capture the complete current Storage policy definitions, grants,
object inventory and a restorable backup. In isolated staging, apply the
resubmission and Storage migrations, then run the existing lifecycle tests and
`tests/staging/submission-storage.sql` with a synthetic non-admin user. The SQL
test checks RLS against rolled-back metadata fixtures only; also test real
Storage API upload/download/delete, partial failure, historical files, and
avatar upload/update using synthetic objects in staging. Confirm no other
client workflow relies on deleting or updating submission objects.

Rollback requires a reviewed migration that removes the two restrictive policies
if approved. Existing permissive policies remain in place, so removing the new
restrictions re-enables any previously permitted student deletion and reintroduces the history risk. Do
not remove or change avatar policies; do not delete objects during rollback.
No migration or rollback has been executed or verified against a real database.
