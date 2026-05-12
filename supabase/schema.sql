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
  meeting_link_token text not null default '',
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

alter table public.verification_threads
  add column if not exists meeting_link_token text not null default '';

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

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.client_profiles to anon, authenticated;
grant select, insert, update, delete on public.subscription_content to anon, authenticated;
grant select, insert, update, delete on public.verification_threads to anon, authenticated;
grant select, insert, update, delete on public.verification_messages to anon, authenticated;
grant select, insert, update, delete on public.verification_attachments to anon, authenticated;

drop policy if exists "public can read clients" on public.client_profiles;
drop policy if exists "authenticated admin can manage clients" on public.client_profiles;
drop policy if exists "public can manage clients" on public.client_profiles;
drop policy if exists "public can create clients" on public.client_profiles;
drop policy if exists "public can update clients" on public.client_profiles;
drop policy if exists "public can delete clients" on public.client_profiles;

create policy "public can read clients"
  on public.client_profiles for select
  to anon, authenticated
  using (true);

create policy "public can create clients"
  on public.client_profiles for insert
  to anon, authenticated
  with check (true);

create policy "public can update clients"
  on public.client_profiles for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "public can delete clients"
  on public.client_profiles for delete
  to anon, authenticated
  using (true);

drop policy if exists "public can read subscription content" on public.subscription_content;
drop policy if exists "authenticated admin can manage subscription content" on public.subscription_content;
drop policy if exists "public can manage subscription content" on public.subscription_content;
drop policy if exists "public can create subscription content" on public.subscription_content;
drop policy if exists "public can update subscription content" on public.subscription_content;
drop policy if exists "public can delete subscription content" on public.subscription_content;

create policy "public can read subscription content"
  on public.subscription_content for select
  to anon, authenticated
  using (true);

create policy "public can create subscription content"
  on public.subscription_content for insert
  to anon, authenticated
  with check (true);

create policy "public can update subscription content"
  on public.subscription_content for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "public can delete subscription content"
  on public.subscription_content for delete
  to anon, authenticated
  using (true);

drop policy if exists "public can create verification threads" on public.verification_threads;
drop policy if exists "public can read verification threads" on public.verification_threads;
drop policy if exists "public can update verification threads" on public.verification_threads;
drop policy if exists "public can delete verification threads" on public.verification_threads;

create policy "public can create verification threads"
  on public.verification_threads for insert
  to anon, authenticated
  with check (true);

create policy "public can read verification threads"
  on public.verification_threads for select
  to anon, authenticated
  using (true);

create policy "public can update verification threads"
  on public.verification_threads for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "public can delete verification threads"
  on public.verification_threads for delete
  to anon, authenticated
  using (true);

drop policy if exists "public can create verification messages" on public.verification_messages;
drop policy if exists "public can read verification messages" on public.verification_messages;
drop policy if exists "public can update verification messages" on public.verification_messages;
drop policy if exists "public can delete verification messages" on public.verification_messages;

create policy "public can create verification messages"
  on public.verification_messages for insert
  to anon, authenticated
  with check (true);

create policy "public can read verification messages"
  on public.verification_messages for select
  to anon, authenticated
  using (true);

create policy "public can update verification messages"
  on public.verification_messages for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "public can delete verification messages"
  on public.verification_messages for delete
  to anon, authenticated
  using (true);

drop policy if exists "public can create verification attachments" on public.verification_attachments;
drop policy if exists "public can read verification attachments" on public.verification_attachments;
drop policy if exists "public can update verification attachments" on public.verification_attachments;

create policy "public can create verification attachments"
  on public.verification_attachments for insert
  to anon, authenticated
  with check (true);

create policy "public can read verification attachments"
  on public.verification_attachments for select
  to anon, authenticated
  using (true);

create policy "public can update verification attachments"
  on public.verification_attachments for update
  to anon, authenticated
  using (true)
  with check (true);

insert into storage.buckets (id, name, public)
values ('zoom-assets', 'zoom-assets', true)
on conflict (id) do nothing;

drop policy if exists "public can read zoom assets" on storage.objects;
drop policy if exists "public can upload zoom assets" on storage.objects;

create policy "public can read zoom assets"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'zoom-assets');

create policy "public can upload zoom assets"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'zoom-assets');
