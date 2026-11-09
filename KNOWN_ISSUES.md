# Known issues

## Team 05 cannot distinguish superseded history

The integration response intentionally retains its current schema. It includes
historical submissions, but `cancelled_at` remains null for superseded rows.
Team 05 therefore cannot reliably distinguish a superseded row from an active
one using this contract. Agree on a backward-compatible lifecycle field or
other contract with Team 05 before relying on it to determine active work.

The local supersession implementation and migration have not yet been verified
against a real isolated PostgreSQL/Supabase database. Do not deploy until that
verification, including concurrency and rollback tests, is complete.
