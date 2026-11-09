# Isolated resubmission staging verification

No staging project has been identified or verified. Do not use a production
connection, production credentials, or a tunnel to production. Creating a
project, connecting to it, running migrations, and modifying its records each
require the owner's approval under the current task instructions.

## Prerequisites

- An explicitly identified, disposable Supabase environment, separate from
  production, with independent project identity, credentials and Storage.
- A verified backup/recovery plan and synthetic data only. Provision at least
  two synthetic non-admin Auth users in staging; the test runner connects with
  a database role able to `SET ROLE authenticated` and inspect function grants.
- Supabase Auth/Storage schemas, `anon`, `authenticated`, and `service_role`,
  and all earlier migrations applied in order. Review all existing policies,
  grants, triggers and foreign keys before applying the lifecycle migration.
- `psql`; Docker/Supabase CLI may help provision a local environment. No such
  executables were found in this workspace during preparation.
- The included SQL scripts deliberately accept **only** a directly local
  PostgreSQL listener and a database named `unilearn_resubmission_staging`.
  A default Supabase Docker installation may report a non-loopback server IP;
  it will be refused by these guards. Do not weaken the guards or use a tunnel
  as a workaround. Establish a genuinely isolated local target or separately
  review and adapt the tests after independently verifying a staging project.

The guard is defense in depth, not proof that a database is non-production.
Verify the environment and user identity independently before approving use.
Do not put passwords, URLs containing credentials, or service keys in scripts,
logs, command history, test output, or the repository.

## Review findings before migration

- Transaction-scoped advisory locks serialize RPC calls for the same student
  and assignment; a partial unique index provides an additional invariant.
  Duplicate request keys have a separate lock. These properties remain untested
  against PostgreSQL, including collisions, rollback and cancellation races.
- `SECURITY DEFINER` uses a fixed `search_path` and only grants execution to
  `service_role`. Confirm the function owner and all effective grants, including
  inherited privileges and pre-existing policies, in the actual target. The RPC
  trusts its server caller for identity, assignment, deadline and file paths.
- The RPC now locks the active row before re-reading it, while cancellation
  uses a conditional row update. Verify both race orderings and API conflict
  responses in staging; the row-lock behavior has not yet been tested on PostgreSQL.
- The migration removes policies by name only; additional permissive policies
  or grants could still allow direct writes. Check effective permissions, not
  only the migration text. The original Storage policy permits a student to
  delete objects in their own folder, including historical files. Metadata
  retention does not prevent such deletion; resolve this with an approved
  Storage retention policy before claiming historical files are protected.
- The existing "Admins can update grades" RLS policy grants authenticated
  administrators row updates, not only grade-column updates. Audit actual
  column privileges and trusted admin behavior: depending on grants, an admin
  client may change lifecycle fields directly. Narrowing this requires a
  coordinated grading-permission review before production.
- The unique index prevents multiple active rows, but the self-reference does
  not itself enforce that a superseding row belongs to the same student and
  assignment. Review all trusted writers. Migration uses an exclusive table
  lock and a backup table for normalized rows; inventory foreign keys and test
  lock duration, data reconciliation and rollback on representative data.
- `supabase/README.md` currently describes resubmission as setting
  `cancelled_at`, which conflicts with the new separate supersession lifecycle
  and with the migration's cancellation comment. Reconcile that documentation
  and inspect legacy records with stakeholders: existing `cancelled_at` values
  alone may not prove whether a student cancelled or an older workflow replaced
  a submission. The new migration does not reclassify cancelled legacy rows.
- Deadline status uses the database clock after the pair lock, not the prior
  application-server timestamp. Verify boundary behavior and clock alignment.
- Team 05 receives the same fields and event type, but cannot distinguish an
  active row from a superseded row where `cancelled_at` is null. Obtain partner
  agreement on semantics before depending on this endpoint for current work.

## Execution, only after approval

1. Verify the project, host, database, permissions and the two synthetic user
   IDs. Seed a synthetic submission for the second user so the RLS isolation
   check is not vacuous. Apply earlier migrations and then the lifecycle migration only to that
   approved isolated target. Check migration result and backup row counts.
2. The scripts are intended for an approved local database role with sufficient
   rights. Use a password prompt or protected local connection configuration;
   the commands below contain no credentials. Replace the UUID with a synthetic
   non-admin user belonging to the verified isolated database:

   ```powershell
   psql -h 127.0.0.1 -d unilearn_resubmission_staging -U postgres -W -v test_student_id=00000000-0000-4000-8000-000000000001 -f tests/staging/resubmission.sql
   ```

3. In two terminals use the same synthetic student and fresh unique run ID.
   Start the second command promptly after the first announces its lock. Both
   transactions roll back; a timeout or insufficient overlap is a failed test.

   ```powershell
   psql -h 127.0.0.1 -d unilearn_resubmission_staging -U postgres -W -v test_student_id=00000000-0000-4000-8000-000000000001 -v test_run_id=replace-with-fresh-uuid -f tests/staging/concurrency-first.sql
   psql -h 127.0.0.1 -d unilearn_resubmission_staging -U postgres -W -v test_student_id=00000000-0000-4000-8000-000000000001 -v test_run_id=replace-with-fresh-uuid -f tests/staging/concurrency-second.sql
   ```

4. Separately test two *committing* concurrent submissions, same-key races,
   cancellation races, distinct users, actual Storage upload/download/delete
   policy, admin history, migration with duplicate legacy rows and rollback.
   These require additional approved synthetic fixtures and cleanup planning;
   the provided lock-wait test alone does not prove those cases.
5. Test the matching application and Team 05 contract in staging, document
   outcomes, and follow `resubmission-deployment.md`. No production rollout
   should occur until all blockers and partner contract semantics are resolved.
