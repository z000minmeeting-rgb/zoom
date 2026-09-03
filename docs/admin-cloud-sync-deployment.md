# Admin cloud synchronization deployment

This repository contains the application and migration only. It does not contain production credentials and does not apply database changes automatically.

## 1. Configure the frontend

Set these deployment environment variables with the Supabase project URL and its **anon/public** key:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

Never set `service_role` or another privileged key in a Vite environment variable.

## 2. Apply the migration

Review and apply the timestamped migrations with the CLI:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

The initial production migration provisions the one configured Z00m workspace
and scopes only legacy rows whose `admin_account_id` is NULL. It asserts that
the related client, thread, message and attachment rows are consistent and that
their counts do not change before it retires the legacy anonymous policies.

## 3. Provision the first admin

1. Create the configured administrator in Supabase Auth through a trusted
   server-side path.
2. Confirm the identity is email-confirmed and can sign in.
3. Run the migration. It resolves exactly one matching Auth email, creates the
   `Z00m` workspace and its `owner` membership idempotently, then scopes the
   legacy data in the same transaction.
4. Confirm the row exists in both `admin_accounts` and `admin_members`.

Do not add an account bootstrap path to the browser: it would let a signed-in non-admin self-authorize.

## 4. Validate security and Realtime

Use two accounts: the provisioned admin and an unrelated test user.

- The admin must read/write only its workspace rows.
- The unrelated user must receive no rows and must be unable to insert or modify workspace data.
- In Database → Replication, verify the six tables added to `supabase_realtime` are present.

## 5. Migrate old devices safely

On each historical device, sign into the same Supabase admin account once while online. The app records a stable local device ID and imports that device's legacy data to `admin_migrations`.

- Existing UUID records are upserted.
- If cloud data for the same ID is newer, the cloud record wins.
- Malformed/non-UUID records are skipped and recorded as conflicts.
- Repeating the same device migration is a no-op.
- Legacy browser keys are retained; do not clear them during this release.

Import Phone A first, then Phone B. Phone B can still contribute records because completion is tracked per device, not globally per account.

## 6. Run the acceptance test

1. On Device A, sign in and create/update a client or verification record.
2. On Device B, sign into the same account; the cloud data must load without copied local storage.
3. Confirm B receives A's update through Realtime.
4. Update/delete from B and confirm A changes without refresh.
5. On a clean Device C, sign in and confirm the same cloud dataset loads.
6. Clear Device C localStorage (except the Supabase session if necessary), sign in again, and confirm cloud data remains.

## Public-flow note

The legacy end-user login and public verification-registration flow still use local browser credentials and were intentionally not migrated in this admin synchronization change. Do not copy plaintext local passwords into Supabase. A follow-up should move end-user authentication to Supabase Auth and expose public verification creation through a validated Edge Function rather than anonymous table permissions.
