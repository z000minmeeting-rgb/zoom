create extension if not exists "pgcrypto";

create table if not exists public.client_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default '',
  email text not null default '',
  avatar_color text not null default '#0B5CFF',
  avatar_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_content (
  id text primary key default 'default',
  content jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.verification_threads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  username text not null default '',
  country text not null default '',
  date_of_birth text not null default '',
  email text not null,
  phone text not null default '',
  gender text not null default '',
  package_id text not null,
  package_name text not null,
  package_price text not null,
  host_name text not null,
  host_avatar text not null default '#0B5CFF',
  host_initials text not null default 'H',
  client_id uuid references public.client_profiles(id) on delete set null,
  status text not null default 'Pending Verification',
  appointment text not null default '',
  unread_for_admin integer not null default 0,
  unread_for_user integer not null default 0,
  typing_user boolean not null default false,
  typing_admin boolean not null default false,
  onboarding_auto_reply_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.verification_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.verification_threads(id) on delete cascade,
  sender text not null check (sender in ('user', 'admin', 'system')),
  text text not null default '',
  status text not null default 'Delivered',
  reply_to jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.verification_messages(id) on delete cascade,
  thread_id uuid not null references public.verification_threads(id) on delete cascade,
  name text not null,
  type text not null,
  size integer not null default 0,
  storage_path text not null,
  payment_status text,
  payment_status_updated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.client_profiles enable row level security;
alter table public.subscription_content enable row level security;
alter table public.verification_threads enable row level security;
alter table public.verification_messages enable row level security;
alter table public.verification_attachments enable row level security;

create policy "public can read clients"
  on public.client_profiles for select
  using (true);

create policy "public can read subscription content"
  on public.subscription_content for select
  using (true);

create policy "public can create verification threads"
  on public.verification_threads for insert
  with check (true);

create policy "public can read verification threads"
  on public.verification_threads for select
  using (true);

create policy "public can update verification threads"
  on public.verification_threads for update
  using (true)
  with check (true);

create policy "public can create verification messages"
  on public.verification_messages for insert
  with check (true);

create policy "public can read verification messages"
  on public.verification_messages for select
  using (true);

create policy "public can update verification messages"
  on public.verification_messages for update
  using (true)
  with check (true);

create policy "public can delete verification messages"
  on public.verification_messages for delete
  using (true);

create policy "public can create verification attachments"
  on public.verification_attachments for insert
  with check (true);

create policy "public can read verification attachments"
  on public.verification_attachments for select
  using (true);

create policy "public can update verification attachments"
  on public.verification_attachments for update
  using (true)
  with check (true);

insert into storage.buckets (id, name, public)
values ('zoom-assets', 'zoom-assets', true)
on conflict (id) do nothing;

create policy "public can read zoom assets"
  on storage.objects for select
  using (bucket_id = 'zoom-assets');

create policy "public can upload zoom assets"
  on storage.objects for insert
  with check (bucket_id = 'zoom-assets');
