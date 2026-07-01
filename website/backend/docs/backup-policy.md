# Database Backup & Recovery

Noumou stores clinical and account data in **Supabase (Postgres)**. This document describes backup expectations and how to verify recovery.

## Supabase Point-in-Time Recovery (PITR)

- **PITR** allows restoring the database to any point within the retention window.
- **Requires the Supabase Pro plan** — confirm with your team that PITR is enabled for the production project.
- Default daily backups are retained for **7 days** on standard plans; PITR extends granular restore on Pro.

### Team action items

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Database** → **Backups**.
2. Confirm **PITR** or scheduled backups are **Active**.
3. Record the retention period and billing owner in your internal runbook.

## Restore drill

Use a **staging** Supabase project — never run a full restore test against production without a maintenance window.

1. **Create staging project** (or use an existing non-production project) in the Supabase dashboard.
2. In the **production** project, go to **Database** → **Backups**.
3. Choose **Restore to new project** (or **Point in time** if PITR is enabled) and select a recent backup timestamp.
4. Wait for the restore job to complete; note the new project URL and service role key.
5. Point a **staging** backend `.env` at the restored project (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
6. Smoke-test: parent login, child list, therapist directory, one booking read.
7. Document restore duration and any schema drift (run pending SQL migrations if needed).
8. Delete the temporary staging project when finished to avoid duplicate costs.

## Automated canary

The repository includes `.github/workflows/backup-check.yml`, which pings the Supabase REST health endpoint weekly as a reminder that the project remains reachable. It does **not** replace verifying backups in the dashboard.

## Related secrets

After any restore to a new project, rotate `JWT_SECRET`, service role keys, and update all client `.env` files.
