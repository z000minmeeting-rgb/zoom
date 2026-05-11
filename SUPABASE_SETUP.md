# Supabase Setup

The app is prepared for Supabase through `src/app/lib/supabase.ts` and `.env.example`.

## Environment Variables

Set these locally and in Netlify:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Do not put the service-role key in frontend files or Netlify public build variables.

## Database Schema

Run `supabase/schema.sql` in the Supabase SQL Editor, or apply it with the Supabase CLI using database credentials.

The service-role JWT can create storage buckets through the API, but Supabase does not expose arbitrary SQL DDL execution through the normal REST API.

## Storage

The `zoom-assets` bucket is used for uploaded app assets such as client avatars and chat attachments.
