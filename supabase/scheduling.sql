-- Scheduling for reminder delivery. Run by hand, once, in the Supabase SQL
-- editor. Deliberately NOT a migration: it carries a deployment URL, and the
-- secret it reads must never be written into this repository.
--
-- Why not Vercel Cron? A reminder needs "* * * * *", and a Hobby plan reduces a
-- job to once a day — a reminder for 6:26pm would arrive some time in the next
-- 24 hours. vercel.json therefore declares no cron at all rather than one that
-- cannot do the job: pg_cron below is the mechanism. On Pro, a Vercel cron on
-- /api/push-dispatch works too, but Vercel signs it with its own reserved
-- CRON_SECRET, so that name would have to be set as well.
--
-- Already in place on this project, so this file does not create them:
--   * pg_cron and pg_net extensions        (reminder_delivery_hardening)
--   * a vault secret named caven_cron_secret, holding the dispatch secret
--     (configure_caven_reminder_dispatch_secret)
--   * CAVEN_CRON_SECRET, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel
--
-- caven_cron_secret must equal CAVEN_CRON_SECRET in Vercel or every dispatch is
-- refused with a 403. Don't compare them by eye — ask the route:
--   curl -s -H "x-caven-cron: <secret>" https://caven-green.vercel.app/api/push-dispatch
-- A JSON body means they match; "forbidden" means they do not.

select cron.unschedule('caven-push-dispatch')
 where exists (select 1 from cron.job where jobname = 'caven-push-dispatch');

select cron.schedule(
  'caven-push-dispatch',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://caven-green.vercel.app/api/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- Read at fire time, so rotating the secret in the vault is enough.
      'x-caven-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'caven_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Checking on it:
--   select jobname, schedule, active from cron.job;
--   select status, return_message, start_time from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'caven-push-dispatch')
--    order by start_time desc limit 10;
--
-- A run that returns {"ok":false,"reason":"VAPID keys are not configured"} means
-- the schedule is working and the Vercel env vars are not set yet.
--
-- Stopping it:
--   select cron.unschedule('caven-push-dispatch');
