-- Restores the host image on public client links.
--
-- The workspace migration (20260902210000) correctly revoked `anon` from
-- client_profiles and scoped every policy to is_admin_member(). That is right —
-- the table holds the client's email address. But the public booking pages
-- (/call, /join, /subscription, /subscription/register) render the host's
-- avatar from that same table, so from the moment it was applied a visitor saw
-- initials on a coloured circle instead of the client's photo.
--
-- The fix is a whitelisted projection, not a policy loosening. This function
-- returns the four display fields the public pages actually render and
-- deliberately omits `email`. The table itself stays closed to anon.
--
-- Disclosure note: a meeting link already carries clientName, hostName,
-- hostAvatar and hostInitials in its query string. Returning the display name
-- and photo for a client id the caller already holds reveals nothing the link
-- itself did not. The id is a v4 UUID, so the set is not enumerable.

-- Projection scope. client_profiles holds:
--   id, name, category, email, avatar_color, avatar_image_path,
--   created_at, updated_at, admin_account_id
--
-- Returned:  id (echo of the caller's own lookup value), name, avatar_color,
--            avatar_image_path — exactly what the public pages render.
-- Withheld:  email (PII), admin_account_id (internal workspace identifier),
--            created_at / updated_at (no public use),
--            category (admin-authored free text for internal organisation; no
--                      public screen renders it, so it has no business here).
create or replace function public.public_client_display(p_client_id uuid)
returns table (
  id uuid,
  name text,
  avatar_color text,
  avatar_image_path text
)
language sql
stable
security definer
set search_path = public
as $$
  -- email is intentionally absent. Do not add it.
  select c.id, c.name, c.avatar_color, c.avatar_image_path
    from public.client_profiles c
   where c.id = p_client_id
   limit 1;
$$;

-- EXECUTE is granted to PUBLIC by default on creation, so revoke first and then
-- grant deliberately.
revoke all on function public.public_client_display(uuid) from public;
grant execute on function public.public_client_display(uuid) to anon, authenticated;
