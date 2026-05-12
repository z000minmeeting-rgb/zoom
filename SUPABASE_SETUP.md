# Supabase Setup

The app is prepared for Supabase through `src/app/lib/supabase.ts` and `.env.example`.

## Environment Variables

Set these locally and in Netlify:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Do not put the service-role key in frontend files or Netlify public build variables.

The admin dashboard opens through `/admin/login` with the 4-digit PIN `1688`, so it can be accessed from any device without creating a separate local admin profile per phone.

## Database Schema

Run `supabase/schema.sql` in the Supabase SQL Editor, or apply it with the Supabase CLI using database credentials.

The schema file is safe to rerun. It recreates the row-level security policies that allow the browser app, using the anon key, to read and write the app tables. If the app shows a Supabase sync warning like `new row violates row-level security policy`, rerun `supabase/schema.sql` in your Supabase project.

The service-role JWT can create storage buckets through the API, but Supabase does not expose arbitrary SQL DDL execution through the normal REST API.

## Storage

The `zoom-assets` bucket is used for uploaded app assets such as client avatars and chat attachments.
