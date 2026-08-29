# Database migrations

## How migrations are applied

There is no automated migration runner (no Supabase CLI project, no CI step, no code that reads these files by path). Every file here is a SQL script that gets **run manually by the developer, pasted into the Supabase SQL Editor**. Nothing in this repo executes these files automatically — moving them here does not change, re-run, or undo anything in the live database.

## Chronological order (historical / recommended run order)

This is the order the files were originally written in, based on their commit history. It reflects the order they were **designed** to be applied in (later migrations often assume earlier ones already ran) — it is not a guarantee of what has actually been executed against the current production database (see note below).

| # | File | Written |
|---|---|---|
| 1 | `database-schema.sql` | Jul 6 — base schema |
| 2 | `supabase_migration_sharing.sql` | Jul 15 |
| 3 | `supabase_migration_shared_read.sql` | Jul 16 |
| 4 | `supabase_migration_collaborators.sql` | Aug 7 (morning) |
| 5 | `supabase_migration_fix_trips_rls.sql` | Aug 7 (evening) |
| 6 | `supabase_migration_fix_shared_trip_load.sql` | Aug 7 (evening, later) |
| 7 | `supabase_migration_ai_cost_controls.sql` | Aug 22 |
| 8 | `supabase_migration_public_gallery.sql` | Aug 25 |
| 9 | `supabase_migration_places_inbox_delete.sql` | Aug 26 |
| 10 | `supabase_migration_admin_metrics.sql` | Aug 29 |

## ⚠️ Uncertainty about what has already run in production

**This repo has no record of which of these have actually been executed against the live Supabase database.** Because migrations are applied by hand rather than tracked by a migration tool, that information exists only in the developer's own memory / the Supabase project's SQL history — not in git, not in any file here. Treat this table as a map of *intended* order, not a log of *applied* state. Before writing a new migration that depends on one of these, verify against the live schema (or ask) rather than assuming from this list alone.
