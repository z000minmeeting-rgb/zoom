-- Makes admin-edited package pricing visible to the people it is quoted to.
--
-- The workspace migration (20260902210000) revoked `anon` from
-- subscription_content. The public booking pages still read it, and
-- refreshSubscriptionContentFromRemote() swallows the resulting failure and
-- returns the hardcoded defaults from subscriptionPackages.ts. Verified live:
-- an anonymous SELECT returns 401, so every visitor has been shown $350 /
-- $520 / $1,200 no matter what the admin saved.
--
-- Same remedy as 20260903130000: a whitelisted projection, not a policy
-- loosening. The table stays closed to anon.
--
-- Only the rendered page content is returned. subscription_content holds
-- nothing else — no customer data, no workspace identifiers, no timestamps —
-- and this is the same copy already shown to any visitor who opens the page.
--
-- Row selection matters here. Two rows exist for this workspace: the legacy
-- global row (id = 'default') preserved by the workspace migration, and the
-- canonical row written by saveSubscriptionContentRemote() (id = the workspace
-- UUID). Both carry the same admin_account_id, so the canonical row is
-- preferred explicitly and the newest row is only a fallback.

create or replace function public.public_subscription_content(p_client_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_account uuid;
  v_content jsonb;
begin
  -- Resolve the workspace the visitor arrived through: the host client on the
  -- meeting link, or the sole workspace when the link carries no client.
  select c.admin_account_id into v_account
    from public.client_profiles c
   where c.id = p_client_id;

  if v_account is null then
    select a.id into v_account from public.admin_accounts a limit 1;
  end if;

  if v_account is null then
    return null;
  end if;

  select s.content into v_content
    from public.subscription_content s
   where s.admin_account_id = v_account
   order by (s.id = v_account::text) desc, s.updated_at desc
   limit 1;

  return v_content;
end;
$$;

-- EXECUTE is granted to PUBLIC by default on creation, so revoke first and then
-- grant deliberately. `authenticated` is included so an admin previewing the
-- public pages resolves content by exactly the same path a visitor does.
revoke all on function public.public_subscription_content(uuid) from public;
grant execute on function public.public_subscription_content(uuid) to anon, authenticated;
