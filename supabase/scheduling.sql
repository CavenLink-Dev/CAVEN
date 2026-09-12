-- Scheduling for reminder delivery. Run by hand, once, in the Supabase SQL
-- editor. Deliberately NOT a migration: it carries a deployment URL, and the
-- secret it reads must never be written into this repository.
--
-- Why not Vercel Cron? vercel.json asks for "* * * * *", which is what a reminder
-- actually needs, but a Hobby plan reduces a job to once a day — a reminder for
-- 6:26pm would arrive some time in the next 24 hours. On Pro, the Vercel schedule
-- is enough and this file can be skipped. On Hobby this is the thing that makes
-- reminders arrive when they are due.
--
-- Already in place on this project, so this file does not create them:
--   * pg_cron and pg_net extensions        (reminder_delivery_hardening)
--   * a vault secret named caven_cron_secret, holding the dispatch secret
--     (configure_caven_reminder_dispatch_secret)
--
-- Whatever caven_cron_secret holds must equal CRON_SECRET in Vercel, or every
-- dispatch is refused with a 403. Read it back with:
--   select decrypted_secret from vault.decrypted_secrets where name='caven_cron_secret';
-- and set that as CRON_SECRET in the Vercel project. Do not paste it in here.

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
