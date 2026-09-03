-- Hardening. Closes an over-broad EXECUTE surface created by the transactional
-- email migration (20260903120200).
--
-- Postgres grants EXECUTE to PUBLIC on every newly created function, and
-- Supabase additionally grants it directly to anon and authenticated. That
-- migration revoked both for enqueue_email() and resolve_admin_recipient() but
-- not for the rest, so PostgREST published the remainder at /rest/v1/rpc/<name>
-- and the `anon` role could call them. Supabase's database linter reports this
-- as `anon_security_definer_function_executable`.
--
-- Verified exposure before this migration, called live with the anon key:
--   thread_payment_confirmed  200 -> a payment-status oracle for any booking
--                                    UUID the caller already holds
--   email_dispatch_allowed    200 -> reveals that dispatch is enabled
--   is_probably_email         200 -> harmless, but not a public endpoint
--   is_admin_member           200 -> answers only about the caller; not public
--   on_* trigger functions    404 -> PostgREST does not expose functions
--                                    returning `trigger`; revoked anyway
--
-- Two functions deliberately KEEP their `authenticated` grant. Both were tested
-- against production inside a rolled-back transaction:
--
--   is_admin_member(uuid)         every RLS policy on every workspace table
--                                 calls it, and a policy expression is
--                                 evaluated with the caller's privileges.
--                                 Revoking it from `authenticated` would deny
--                                 the admin dashboard its own data.
--
--   generate_booking_reference()  called by assign_booking_reference(), which
--                                 is SECURITY INVOKER, so the nested call is
--                                 checked against the inserting role. Revoking
--                                 it produced, verifiably:
--                                   ERROR 42501: permission denied for function
--                                   generate_booking_reference
--                                   CONTEXT: PL/pgSQL function
--                                   assign_booking_reference() line 4
--                                 which would break admin-side booking inserts,
--                                 including the legacy device import.
--
-- Revoking EXECUTE on the trigger functions themselves is safe: firing a
-- trigger does not check EXECUTE on its function. Confirmed on production in a
-- rolled-back transaction — an UPDATE as `authenticated` fired a BEFORE UPDATE
-- trigger normally after EXECUTE had been revoked from that role.
--
-- public.public_client_display() is deliberately untouched. It is the guest
-- booking pages' only route to the host avatar, it is the only RPC the browser
-- calls, and it is a fixed four-column projection over a caller-supplied UUID.
-- See 20260903130000.

-- ---------------------------------------------------------------------------
-- Internal helpers. Every caller is a SECURITY DEFINER function that runs as
-- the owner, so none of these needs a client-role grant.
-- ---------------------------------------------------------------------------
revoke all on function public.email_dispatch_allowed(timestamptz) from public, anon, authenticated;
revoke all on function public.is_probably_email(text) from public, anon, authenticated;
revoke all on function public.thread_payment_confirmed(uuid, text) from public, anon, authenticated;
revoke all on function public.booking_email_payload(public.verification_threads) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger-only functions. Not reachable over REST, and trigger execution does
-- not consult these grants.
-- ---------------------------------------------------------------------------
revoke all on function public.on_booking_created() from public, anon, authenticated;
revoke all on function public.on_chat_message_created() from public, anon, authenticated;
revoke all on function public.on_appointment_scheduled() from public, anon, authenticated;
revoke all on function public.assign_booking_reference() from public, anon, authenticated;
revoke all on function public.track_appointment_version() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Close the anonymous surface but preserve the server-side callers above.
-- ---------------------------------------------------------------------------
revoke all on function public.generate_booking_reference() from public, anon;
grant execute on function public.generate_booking_reference() to authenticated;

revoke all on function public.is_admin_member(uuid) from public, anon;
grant execute on function public.is_admin_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Pin the mutable search_paths the linter flagged.
--
-- `public` matches every other function in this schema. None of these three
-- calls a pgcrypto routine, so this cannot reintroduce the extension-lookup
-- defect that 20260903120400 fixed for the guest-token functions: they use
-- random/floor/substr/length, the regex operator, and
-- jsonb_build_object/coalesce/to_char respectively — all pg_catalog built-ins,
-- which resolve regardless of search_path.
-- ---------------------------------------------------------------------------
alter function public.generate_booking_reference() set search_path = public;
alter function public.is_probably_email(text) set search_path = public;
alter function public.booking_email_payload(public.verification_threads) set search_path = public;
