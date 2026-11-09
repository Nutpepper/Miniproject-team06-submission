# Resubmission release procedure

This change requires the migration and application to be released together in
a maintenance window. The old API cannot write after the migration removes
student write policies, and may violate the new unique index. The new API also
cannot work before the migration creates its RPC and columns. Do not use a
rolling release with mixed writers.

1. Confirm Team 05 accepts the existing history limitation documented in
   `KNOWN_ISSUES.md`; the integration response and webhook have not changed.
2. Provision an isolated staging Supabase project with production-like schema,
   policies and synthetic records. Confirm the server-only service role key is
   configured without exposing it to browser code. Check existing policies,
   grants, triggers and foreign keys; this migration removes the named student
   write policies, so any additional permissive write policy must be reviewed.
3. Take and verify a restorable database backup and Storage recovery plan.
   Pause submission and cancellation writes. Record counts and duplicates:

   ```sql
   SELECT student_id, assignment_id, count(*) FROM public.submissions
   WHERE cancelled_at IS NULL GROUP BY student_id, assignment_id HAVING count(*) > 1;
   ```

4. In staging only, apply the migration and deploy the matching application.
   Check `submission_supersession_migration_backup`, constraints, function
   grants, RLS and index. Verify no duplicate active rows:

   ```sql
   SELECT student_id, assignment_id, count(*) FROM public.submissions
   WHERE cancelled_at IS NULL AND superseded_at IS NULL
   GROUP BY student_id, assignment_id HAVING count(*) > 1;
   ```

5. Run isolated database tests: simultaneous submissions for the same pair and
   same idempotency key, different students, cancel/resubmit races, a forced
   attachment insert failure with no state change, unique-index violations,
   unauthorized RPC/direct writes, deadline boundary, history/Storage access,
   and Team 05 response/webhook compatibility. Confirm row and object counts.
6. Obtain explicit production approval. Pause writes; repeat backup and checks,
   apply migration, verify, deploy the matching application, then smoke-test
   first submit, resubmit, cancel, history and Team 05 before reopening writes.

## Rollback

Pause writes first. Application-only rollback is insufficient. Prefer restoring
a verified database backup and matching application, with a plan to reconcile
all writes made after backup. Alternatively prepare and test a reviewed reverse
migration in staging: account for every submission created after cutover and
its supersession links, drop the new unique index and RPC, restore prior student
write policies and old index, then restore migration-touched rows from the backup
table where appropriate. A blind restore of lifecycle values can create multiple
active records and lose post-cutover semantics; do not run it without an audited
reconciliation plan. Never delete Storage objects as part of rollback.
