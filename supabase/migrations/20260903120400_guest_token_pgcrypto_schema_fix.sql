-- Supabase installs pgcrypto in the extensions schema. The guest-token
-- functions deliberately run with search_path = public, so qualify pgcrypto
-- calls explicitly rather than widening the SECURITY DEFINER search path.

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

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  return query
    select t.thread_id, t.admin_account_id, t.id
      from public.guest_chat_tokens t
     where t.token_hash = v_hash
       and t.revoked_at is null
       and t.expires_at > now()
     limit 1;
end;
$$;

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

  v_token := replace(replace(replace(
    encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');

  insert into public.guest_chat_tokens (thread_id, admin_account_id, token_hash, expires_at)
  values (p_thread_id, v_account, encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + p_ttl);

  return v_token;
end;
$$;

revoke all on function public.resolve_guest_chat_token(text) from public, anon, authenticated;
revoke all on function public.issue_guest_chat_token(uuid, interval) from public, anon, authenticated;
