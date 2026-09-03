-- Guest chat access, and the additive booking columns the email events need.
--
-- Customers have no accounts by product design. Before this migration the only
-- thing standing between a stranger and a subscriber's identity documents was
-- knowing a thread UUID. A UUID in a URL is not authorization: it appears in
-- browser history, referrer headers, shared screenshots and mail-client link
-- scanners.
--
-- This replaces it with a bearer credential the server can scope, expire and
-- revoke. Only the SHA-256 hash is stored, so a database disclosure does not
-- hand out working chat links.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Additive booking columns
-- ---------------------------------------------------------------------------

-- Human-quotable booking reference for emails. Internal UUIDs stay internal.
alter table public.verification_threads
  add column if not exists booking_reference text;

-- Appointment structure. The existing `appointment` column is free text with no
-- timezone, which cannot be rendered safely in an email that a customer will
-- act on. These carry the parts an email must state explicitly.
alter table public.verification_threads
  add column if not exists appointment_timezone text not null default '';
alter table public.verification_threads
  add column if not exists appointment_version integer not null default 0;
alter table public.verification_threads
  add column if not exists appointment_set_at timestamptz;

-- Lets a server-written message opt out of generating an email: the synthetic
-- opening message and the canned onboarding auto-reply are not real
-- correspondence and must not notify anyone.
alter table public.verification_messages
  add column if not exists suppress_email boolean not null default false;

create unique index if not exists verification_threads_booking_reference_idx
  on public.verification_threads (booking_reference)
  where booking_reference is not null;

-- Short, unambiguous, no look-alike characters. Collision-checked by the unique
-- index above; the caller retries on conflict.
create or replace function public.generate_booking_reference()
returns text
language plpgsql
volatile
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_result text := '';
  i integer;
begin
  for i in 1..8 loop
    v_result := v_result || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  return 'ZB-' || v_result;
end;
$$;

-- Backfill every existing booking so email templates never render a blank
-- reference for a pre-existing thread.
do $$
declare
  r record;
  v_ref text;
begin
  for r in select id from public.verification_threads where booking_reference is null loop
    loop
      v_ref := public.generate_booking_reference();
      begin
        update public.verification_threads set booking_reference = v_ref where id = r.id;
        exit;
      exception when unique_violation then
        -- try another reference
      end;
    end loop;
  end loop;
end;
$$;

create or replace function public.assign_booking_reference()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.booking_reference is null then
    new.booking_reference := public.generate_booking_reference();
  end if;
  return new;
end;
$$;

drop trigger if exists verification_threads_booking_reference on public.verification_threads;
create trigger verification_threads_booking_reference
  before insert on public.verification_threads
  for each row execute function public.assign_booking_reference();

-- Bump the appointment version whenever a distinct appointment is persisted.
-- This is what separates CALL_SCHEDULED from CALL_RESCHEDULED, and what keeps a
-- legitimate reschedule from being suppressed by the first schedule's key.
create or replace function public.track_appointment_version()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(new.appointment, '') <> '' and
     (coalesce(old.appointment, '') is distinct from coalesce(new.appointment, '')
      or coalesce(old.appointment_timezone, '') is distinct from coalesce(new.appointment_timezone, '')) then
    new.appointment_version := coalesce(old.appointment_version, 0) + 1;
    new.appointment_set_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists verification_threads_appointment_version on public.verification_threads;
create trigger verification_threads_appointment_version
  before update on public.verification_threads
  for each row execute function public.track_appointment_version();

-- ---------------------------------------------------------------------------
-- Guest access tokens
-- ---------------------------------------------------------------------------
create table if not exists public.guest_chat_tokens (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.verification_threads(id) on delete cascade,
  admin_account_id uuid references public.admin_accounts(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  last_used_at timestamptz,
  revoked_at timestamptz,
  use_count integer not null default 0
);

create unique index if not exists guest_chat_tokens_hash_idx
  on public.guest_chat_tokens (token_hash);
create index if not exists guest_chat_tokens_thread_idx
  on public.guest_chat_tokens (thread_id)
  where revoked_at is null;

alter table public.guest_chat_tokens enable row level security;
revoke all on public.guest_chat_tokens from anon, authenticated;
-- No policy is created: with RLS on and no policy, only the service role reads
-- this table. The browser can never enumerate or verify tokens itself.

-- Resolves a raw token to the single thread it authorises. Returns nothing for
-- an unknown, revoked or expired token, and never leaks why.
create or replace function public.resolve_guest_chat_token(p_token text)
returns table (thread_id uuid, admin_account_id uuid, token_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if p_token is null or length(p_token) < 20 then
    return;
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  return query
    select t.thread_id, t.admin_account_id, t.id
      from public.guest_chat_tokens t
     where t.token_hash = v_hash
       and t.revoked_at is null
       and t.expires_at > now()
     limit 1;
end;
$$;

-- Mints a token and stores only its hash. The raw value is returned exactly
-- once, to the caller, and never persisted. Every outbound email link gets its
-- own short-lived credential rather than reusing one long-lived secret, so a
-- forwarded or scanned email can be revoked without cutting off the customer's
-- own browser session.
create or replace function public.issue_guest_chat_token(
  p_thread_id uuid,
  p_ttl interval default interval '30 days'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_account uuid;
begin
  select admin_account_id into v_account
    from public.verification_threads
   where id = p_thread_id;

  if not found then
    raise exception 'Unknown booking';
  end if;

  -- 32 random bytes, base64url, unpadded.
  v_token := replace(replace(replace(
    encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');

  insert into public.guest_chat_tokens (thread_id, admin_account_id, token_hash, expires_at)
  values (p_thread_id, v_account, encode(digest(v_token, 'sha256'), 'hex'), now() + p_ttl);

  return v_token;
end;
$$;

create or replace function public.touch_guest_chat_token(p_token_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.guest_chat_tokens
     set last_used_at = now(),
         use_count = use_count + 1
   where id = p_token_id;
$$;

create or replace function public.revoke_guest_chat_tokens(p_thread_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with revoked as (
    update public.guest_chat_tokens
       set revoked_at = now()
     where thread_id = p_thread_id and revoked_at is null
    returning 1
  )
  select count(*) into v_count from revoked;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.resolve_guest_chat_token(text) from public, anon, authenticated;
revoke all on function public.issue_guest_chat_token(uuid, interval) from public, anon, authenticated;
revoke all on function public.touch_guest_chat_token(uuid) from public, anon, authenticated;
revoke all on function public.revoke_guest_chat_tokens(uuid) from public, anon, authenticated;
