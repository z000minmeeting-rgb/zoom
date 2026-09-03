-- Additive migration: turns the existing browser-mirrored admin data into
-- workspace-scoped, authenticated Supabase data. Do not apply automatically.
create extension if not exists "pgcrypto";

create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null default 'Admin workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table if not exists public.admin_members (
  id uuid primary key default gen_random_uuid(),
  admin_account_id uuid not null references public.admin_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  unique (admin_account_id, user_id)
);

create table if not exists public.admin_migrations (
  id uuid primary key default gen_random_uuid(),
  admin_account_id uuid not null references public.admin_accounts(id) on delete cascade,
  migration_key text not null,
  device_id uuid not null,
  status text not null check (status in ('started', 'completed', 'failed')),
  records_examined jsonb not null default '{}'::jsonb,
  records_imported jsonb not null default '{}'::jsonb,
  records_skipped jsonb not null default '{}'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (admin_account_id, migration_key, device_id)
);

create table if not exists public.admin_devices (
  id uuid primary key default gen_random_uuid(),
  admin_account_id uuid not null references public.admin_accounts(id) on delete cascade,
  device_id uuid not null,
  device_name text not null default 'Unknown device',
  platform text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (admin_account_id, device_id)
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  admin_account_id uuid not null references public.admin_accounts(id) on delete cascade,
  event text not null,
  title text not null,
  description text not null,
  country text not null default 'Unknown',
  action_url text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.client_profiles add column if not exists admin_account_id uuid references public.admin_accounts(id) on delete restrict;
alter table public.verification_threads add column if not exists admin_account_id uuid references public.admin_accounts(id) on delete restrict;
alter table public.verification_messages add column if not exists admin_account_id uuid references public.admin_accounts(id) on delete restrict;
alter table public.verification_attachments add column if not exists admin_account_id uuid references public.admin_accounts(id) on delete restrict;
alter table public.subscription_content add column if not exists admin_account_id uuid references public.admin_accounts(id) on delete restrict;

-- Bootstrap the one authorised Z00m workspace and scope every legacy row in
-- the same transaction, before the legacy public policies are retired. The
-- owner identity must already exist in Supabase Auth; this migration never
-- creates or stores passwords.
do $$
declare
  v_user_id uuid;
  v_user_count integer;
  v_account_id uuid;
  v_account_count integer;
  v_missing_thread_clients integer;
  v_orphan_messages integer;
  v_orphan_attachments integer;
  v_clients_before bigint;
  v_threads_before bigint;
  v_messages_before bigint;
  v_attachments_before bigint;
  v_content_before bigint;
begin
  select count(*)
    into v_user_count
    from auth.users
   where lower(email) = lower('z000minmeeting@gmail.com');

  if v_user_count <> 1 then
    raise exception 'Expected exactly one Z00m primary Auth user; found %', v_user_count;
  end if;

  select id into v_user_id
    from auth.users
   where lower(email) = lower('z000minmeeting@gmail.com');

  select count(*)
    into v_account_count
    from public.admin_accounts
   where owner_user_id = v_user_id;

  if v_account_count = 0 then
    insert into public.admin_accounts (owner_user_id, name)
    values (v_user_id, 'Z00m')
    returning id into v_account_id;
  elsif v_account_count <> 1 then
    raise exception 'Expected at most one Z00m workspace for the primary Auth user; found %', v_account_count;
  else
    select id into v_account_id
      from public.admin_accounts
     where owner_user_id = v_user_id;
  end if;

  insert into public.admin_members (admin_account_id, user_id, role)
  values (v_account_id, v_user_id, 'owner')
  on conflict (admin_account_id, user_id) do update set role = excluded.role;

  -- Check legacy parent/child links before assigning a common workspace.
  select count(*) into v_missing_thread_clients
    from public.verification_threads t
    left join public.client_profiles c on c.id = t.client_id
   where t.client_id is not null and c.id is null;
  select count(*) into v_orphan_messages
    from public.verification_messages m
    left join public.verification_threads t on t.id = m.thread_id
   where t.id is null;
  select count(*) into v_orphan_attachments
    from public.verification_attachments a
    left join public.verification_threads t on t.id = a.thread_id
   where t.id is null;

  if v_missing_thread_clients <> 0 or v_orphan_messages <> 0 or v_orphan_attachments <> 0 then
    raise exception 'Refusing Z00m ownership backfill: missing thread clients %, orphan messages %, orphan attachments %',
      v_missing_thread_clients, v_orphan_messages, v_orphan_attachments;
  end if;

  select count(*) into v_clients_before from public.client_profiles;
  select count(*) into v_threads_before from public.verification_threads;
  select count(*) into v_messages_before from public.verification_messages;
  select count(*) into v_attachments_before from public.verification_attachments;
  select count(*) into v_content_before from public.subscription_content;

  -- Never overwrite an existing ownership assignment. This initial bootstrap
  -- is authorised for the one legacy Z00m workspace only.
  update public.client_profiles set admin_account_id = v_account_id where admin_account_id is null;
  update public.verification_threads set admin_account_id = v_account_id where admin_account_id is null;
  update public.verification_messages set admin_account_id = v_account_id where admin_account_id is null;
  update public.verification_attachments set admin_account_id = v_account_id where admin_account_id is null;
  update public.subscription_content set admin_account_id = v_account_id where admin_account_id is null;

  if (select count(*) from public.client_profiles) <> v_clients_before
     or (select count(*) from public.verification_threads) <> v_threads_before
     or (select count(*) from public.verification_messages) <> v_messages_before
     or (select count(*) from public.verification_attachments) <> v_attachments_before
     or (select count(*) from public.subscription_content) <> v_content_before then
    raise exception 'Refusing Z00m ownership backfill: a legacy row count changed';
  end if;

  if exists (select 1 from public.client_profiles where admin_account_id is null)
     or exists (select 1 from public.verification_threads where admin_account_id is null)
     or exists (select 1 from public.verification_messages where admin_account_id is null)
     or exists (select 1 from public.verification_attachments where admin_account_id is null)
     or exists (select 1 from public.subscription_content where admin_account_id is null) then
    raise exception 'Refusing Z00m ownership backfill: NULL workspace ownership remains';
  end if;

  if exists (
       select 1 from public.verification_threads t
       join public.client_profiles c on c.id = t.client_id
       where t.client_id is not null and t.admin_account_id <> c.admin_account_id
     )
     or exists (
       select 1 from public.verification_messages m
       join public.verification_threads t on t.id = m.thread_id
       where m.admin_account_id <> t.admin_account_id
     )
     or exists (
       select 1 from public.verification_attachments a
       join public.verification_threads t on t.id = a.thread_id
       where a.admin_account_id <> t.admin_account_id
     ) then
    raise exception 'Refusing Z00m ownership backfill: related rows have inconsistent workspace ownership';
  end if;
end;
$$;

create index if not exists client_profiles_admin_account_id_idx on public.client_profiles(admin_account_id);
create index if not exists verification_threads_admin_account_updated_idx on public.verification_threads(admin_account_id, updated_at desc);
create index if not exists verification_messages_admin_account_thread_idx on public.verification_messages(admin_account_id, thread_id, created_at);
create index if not exists verification_attachments_admin_account_thread_idx on public.verification_attachments(admin_account_id, thread_id);
create index if not exists admin_members_user_id_idx on public.admin_members(user_id);
create index if not exists admin_notifications_account_created_idx on public.admin_notifications(admin_account_id, created_at desc);

create or replace function public.is_admin_member(target_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_members
    where admin_account_id = target_account_id and user_id = auth.uid()
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_accounts_touch_updated_at on public.admin_accounts;
create trigger admin_accounts_touch_updated_at before update on public.admin_accounts
for each row execute function public.touch_updated_at();
drop trigger if exists verification_threads_touch_updated_at on public.verification_threads;
create trigger verification_threads_touch_updated_at before update on public.verification_threads
for each row execute function public.touch_updated_at();
drop trigger if exists client_profiles_touch_updated_at on public.client_profiles;
create trigger client_profiles_touch_updated_at before update on public.client_profiles
for each row execute function public.touch_updated_at();

-- Retire the legacy anonymous policies and grants. Existing NULL-scoped rows
-- are intentionally preserved but inaccessible until reviewed/imported.
revoke all on public.client_profiles, public.subscription_content, public.verification_threads,
  public.verification_messages, public.verification_attachments from anon;
grant select, insert, update, delete on public.client_profiles, public.subscription_content,
  public.verification_threads, public.verification_messages, public.verification_attachments,
  public.admin_accounts, public.admin_members, public.admin_migrations, public.admin_devices,
  public.admin_notifications to authenticated;

alter table public.admin_accounts enable row level security;
alter table public.admin_members enable row level security;
alter table public.admin_migrations enable row level security;
alter table public.admin_devices enable row level security;
alter table public.admin_notifications enable row level security;

drop policy if exists "public can read clients" on public.client_profiles;
drop policy if exists "public can create clients" on public.client_profiles;
drop policy if exists "public can update clients" on public.client_profiles;
drop policy if exists "public can delete clients" on public.client_profiles;
drop policy if exists "public can read subscription content" on public.subscription_content;
drop policy if exists "public can create subscription content" on public.subscription_content;
drop policy if exists "public can update subscription content" on public.subscription_content;
drop policy if exists "public can delete subscription content" on public.subscription_content;
drop policy if exists "public can create verification threads" on public.verification_threads;
drop policy if exists "public can read verification threads" on public.verification_threads;
drop policy if exists "public can update verification threads" on public.verification_threads;
drop policy if exists "public can delete verification threads" on public.verification_threads;
drop policy if exists "public can create verification messages" on public.verification_messages;
drop policy if exists "public can read verification messages" on public.verification_messages;
drop policy if exists "public can update verification messages" on public.verification_messages;
drop policy if exists "public can delete verification messages" on public.verification_messages;
drop policy if exists "public can create verification attachments" on public.verification_attachments;
drop policy if exists "public can read verification attachments" on public.verification_attachments;
drop policy if exists "public can update verification attachments" on public.verification_attachments;

create policy "members can read admin accounts" on public.admin_accounts for select to authenticated
using (public.is_admin_member(id));
create policy "owners can update admin accounts" on public.admin_accounts for update to authenticated
using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "members can read memberships" on public.admin_members for select to authenticated
using (public.is_admin_member(admin_account_id));
create policy "owners can manage memberships" on public.admin_members for all to authenticated
using (exists (select 1 from public.admin_accounts a where a.id = admin_account_id and a.owner_user_id = auth.uid()))
with check (exists (select 1 from public.admin_accounts a where a.id = admin_account_id and a.owner_user_id = auth.uid()));

create policy "members manage clients" on public.client_profiles for all to authenticated
using (public.is_admin_member(admin_account_id)) with check (public.is_admin_member(admin_account_id));
create policy "members manage subscription content" on public.subscription_content for all to authenticated
using (public.is_admin_member(admin_account_id)) with check (public.is_admin_member(admin_account_id));
create policy "members manage verification threads" on public.verification_threads for all to authenticated
using (public.is_admin_member(admin_account_id)) with check (public.is_admin_member(admin_account_id));
create policy "members manage verification messages" on public.verification_messages for all to authenticated
using (public.is_admin_member(admin_account_id)) with check (public.is_admin_member(admin_account_id));
create policy "members manage verification attachments" on public.verification_attachments for all to authenticated
using (public.is_admin_member(admin_account_id)) with check (public.is_admin_member(admin_account_id));
create policy "members manage migrations" on public.admin_migrations for all to authenticated
using (public.is_admin_member(admin_account_id)) with check (public.is_admin_member(admin_account_id));
create policy "members manage devices" on public.admin_devices for all to authenticated
using (public.is_admin_member(admin_account_id)) with check (public.is_admin_member(admin_account_id));
create policy "members manage notifications" on public.admin_notifications for all to authenticated
using (public.is_admin_member(admin_account_id)) with check (public.is_admin_member(admin_account_id));

-- Realtime is safe because RLS still filters the row stream for each session.
do $$ begin
  alter publication supabase_realtime add table public.client_profiles;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.subscription_content;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.verification_threads;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.verification_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.verification_attachments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.admin_notifications;
exception when duplicate_object then null; end $$;

-- The primary Z00m workspace is provisioned and ownership-scoped above before
-- RLS replaces the legacy anonymous policies.
