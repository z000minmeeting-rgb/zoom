# Supabase Setup

The app is prepared for Supabase through `src/app/lib/supabase.ts` and `.env.example`.
For the admin cloud/workspace deployment procedure, use [docs/admin-cloud-sync-deployment.md](docs/admin-cloud-sync-deployment.md). The legacy `schema.sql` baseline alone is not sufficient for the hardened admin architecture; apply the timestamped migration as well.

## Environment Variables

Set these locally and in Netlify:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Do not put the service-role key in frontend files or Netlify public build variables.

The admin dashboard uses Supabase Auth email/password sign-in and requires the authenticated user to be a member of an `admin_accounts` workspace. It does not use a browser PIN or `localStorage` authorization flag.

## Database Schema

Apply the timestamped files in `supabase/migrations/` with `supabase db push`.
Do not rerun a legacy schema baseline that restores anonymous browser CRUD: the
production model uses workspace RLS for administrators and restricted Edge
Functions for public booking and guest chat.

The service-role JWT can create storage buckets through the API, but Supabase does not expose arbitrary SQL DDL execution through the normal REST API.

## Storage

The `zoom-assets` bucket is used for uploaded app assets such as client avatars and chat attachments.
