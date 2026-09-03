-- Transactional email infrastructure: the outbox, its dispatch settings, and the
-- claim/complete surface used by the dispatcher.
--
-- Nothing in this file sends mail and nothing in it references a mail provider.
-- The outbox is the only contract between business events and delivery.
--
-- Trust model: anon and authenticated get NO write access at all. Rows are
-- written exclusively by SECURITY DEFINER trigger functions (see the event
-- migration) which compute recipient_email, template_key and event_type from
-- the business row. A customer therefore cannot choose a recipient, a template
-- or an event, so this cannot be driven as an arbitrary mail relay.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Dispatch settings (single row)
-- ---------------------------------------------------------------------------
-- enabled_from is the legacy-import cutover. Business rows created before this
-- timestamp never produce email, so importing a historic device is silent.
create table if not exists public.email_dispatch_settings (
  id boolean primary key default true,
  enabled boolean not null default false,
  enabled_from timestamptz not null default now(),
  admin_notification_email text,
  app_url text not null default '',
  max_attempts integer not null default 5,
  updated_at timestamptz not null default now(),
  constraint email_dispatch_settings_single_row check (id)
);

insert into public.email_dispatch_settings (id) values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The outbox
-- ---------------------------------------------------------------------------
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  admin_account_id uuid references public.admin_accounts(id) on delete cascade,

  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,

  recipient_email text,
  recipient_name text,
  recipient_role text not null check (recipient_role in ('customer', 'admin')),
  recipient_source text not null,

  template_key text not null,
  template_payload jsonb not null default '{}'::jsonb,

  idempotency_key text not null,

  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'retry', 'failed')),
  attempt_count integer not null default 0,
  last_error text,

  created_at timestamptz not null default now(),
  processing_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  next_attempt_at timestamptz not null default now()
);

-- The single guarantee that survives multiple devices, tabs, Realtime echoes,
-- reloads and worker races. Everything else is convenience.
create unique index if not exists email_outbox_idempotency_key_idx
  on public.email_outbox (idempotency_key);

-- Claim path: only rows that are actually due.
create index if not exists email_outbox_claimable_idx
  on public.email_outbox (next_attempt_at, created_at)
  where status in ('pending', 'retry');

-- Stuck-row reclaim path.
create index if not exists email_outbox_processing_idx
  on public.email_outbox (processing_at)
  where status = 'processing';

-- Admin delivery view path.
create index if not exists email_outbox_account_created_idx
  on public.email_outbox (admin_account_id, created_at desc);

create index if not exists email_outbox_entity_idx
  on public.email_outbox (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
alter table public.email_dispatch_settings enable row level security;
alter table public.email_outbox enable row level security;

revoke all on public.email_dispatch_settings from anon, authenticated;
revoke all on public.email_outbox from anon, authenticated;

-- Admins may READ their workspace's delivery status (Phase 18 observability).
-- No insert, update or delete for anyone but the service role, which bypasses
-- RLS entirely. last_error is written pre-sanitised by the dispatcher.
grant select on public.email_outbox to authenticated;

drop policy if exists "members read email delivery" on public.email_outbox;
create policy "members read email delivery"
  on public.email_outbox for select
  to authenticated
  using (admin_account_id is not null and public.is_admin_member(admin_account_id));

-- ---------------------------------------------------------------------------
-- Dispatcher surface (service role only — SECURITY DEFINER, not granted to
-- anon/authenticated below)
-- ---------------------------------------------------------------------------

-- Atomic claim. FOR UPDATE SKIP LOCKED means two concurrent dispatcher runs can
-- never claim the same row, so a slow or overlapping drain cannot double-send.
create or replace function public.claim_email_batch(p_limit integer default 25)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.email_outbox o
     set status = 'processing',
         processing_at = now(),
         attempt_count = o.attempt_count + 1
   where o.id in (
     select c.id
       from public.email_outbox c
      where c.status in ('pending', 'retry')
        and c.next_attempt_at <= now()
      order by c.created_at
      for update skip locked
      limit greatest(1, least(p_limit, 200))
   )
  returning o.*;
end;
$$;

create or replace function public.mark_email_sent(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.email_outbox
     set status = 'sent',
         sent_at = now(),
         last_error = null
   where id = p_id;
$$;

-- Bounded exponential backoff, then a terminal 'failed'. Never retries forever.
create or replace function public.mark_email_failed(p_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
  v_max integer;
  v_delay interval;
begin
  select max_attempts into v_max from public.email_dispatch_settings where id;
  select attempt_count into v_attempts from public.email_outbox where id = p_id;

  if v_attempts >= coalesce(v_max, 5) then
    update public.email_outbox
       set status = 'failed',
           failed_at = now(),
           last_error = left(coalesce(p_error, 'Unknown delivery error'), 2000)
     where id = p_id;
    return;
  end if;

  v_delay := case v_attempts
    when 1 then interval '1 minute'
    when 2 then interval '5 minutes'
    when 3 then interval '15 minutes'
    when 4 then interval '60 minutes'
    else interval '240 minutes'
  end;

  update public.email_outbox
     set status = 'retry',
         last_error = left(coalesce(p_error, 'Unknown delivery error'), 2000),
         next_attempt_at = now() + v_delay
   where id = p_id;
end;
$$;

-- A dispatcher that dies mid-send leaves a row in 'processing'. Reclaim it so
-- the message is not silently lost; the idempotency key still prevents a
-- duplicate if the original send actually succeeded downstream.
create or replace function public.reclaim_stuck_emails(p_older_than interval default interval '10 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with reclaimed as (
    update public.email_outbox
       set status = 'retry',
           next_attempt_at = now(),
           last_error = 'Reclaimed after dispatcher timeout'
     where status = 'processing'
       and processing_at < now() - p_older_than
    returning 1
  )
  select count(*) into v_count from reclaimed;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.claim_email_batch(integer) from public, anon, authenticated;
revoke all on function public.mark_email_sent(uuid) from public, anon, authenticated;
revoke all on function public.mark_email_failed(uuid, text) from public, anon, authenticated;
revoke all on function public.reclaim_stuck_emails(interval) from public, anon, authenticated;
