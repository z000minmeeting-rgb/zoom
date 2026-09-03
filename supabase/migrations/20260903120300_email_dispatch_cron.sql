-- Schedules the outbox drain.
--
-- Apply this LAST, and only after `supabase functions deploy dispatch-emails`
-- has succeeded and its secrets are set. Until the settings row is flipped to
-- enabled = true, the triggers enqueue nothing and this drain has no work.
--
-- `project_url` and `outbox_drain_secret` are Supabase Vault entries created
-- during deployment. They are resolved when cron runs; no production secret
-- or project-specific URL is committed in this migration.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Drain every minute. The dispatcher claims a bounded batch, so this is a
-- steady trickle rather than a burst — which also keeps sending under Gmail's
-- per-hour ceiling without extra rate-limiting code.
select cron.unschedule('zoo-dispatch-emails')
  where exists (select 1 from cron.job where jobname = 'zoo-dispatch-emails');

select cron.schedule(
  'zoo-dispatch-emails',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/dispatch-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-outbox-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'outbox_drain_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- Reclaim rows abandoned by a dispatcher that timed out mid-send.
select cron.unschedule('zoo-reclaim-stuck-emails')
  where exists (select 1 from cron.job where jobname = 'zoo-reclaim-stuck-emails');

select cron.schedule(
  'zoo-reclaim-stuck-emails',
  '*/5 * * * *',
  $$ select public.reclaim_stuck_emails(interval '10 minutes'); $$
);
