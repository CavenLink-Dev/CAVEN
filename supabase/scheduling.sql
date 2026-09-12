-- Scheduling for reminder delivery. Run this by hand, once, in the Supabase SQL
-- editor. It is deliberately NOT a migration: it carries a deployment URL and a
-- secret, and neither belongs in the repository.
--
-- Why not Vercel Cron? vercel.json asks for "* * * * *", which is what a
-- reminder actually needs, but a Hobby plan only schedules a job once a day —
-- a reminder for 6:26pm would arrive somewhere in the next 24 hours. Pro gets
-- the minute schedule and this file can be skipped. On Hobby, pg_cron below is
-- the thing that makes reminders arrive when they are due.
--
-- Before running, replace:
--   <CRON_SECRET>   the same value set as CRON_SECRET in Vercel
--   <DEPLOY_URL>    https://caven-green.vercel.app

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Store the secret where only the database can read it, rather than inlining it
-- into a job definition that any dashboard viewer can read back.
create table if not exists private_config (key text primary key, value text not null);
revoke all on private_config from anon, authenticated;
insert into private_config(key, value) values
  ('cron_secret', '<CRON_SECRET>'),
  ('dispatch_url', '<DEPLOY_URL>/api/push-dispatch')
on conflict (key) do update set value = excluded.value;

select cron.unschedule('caven-push-dispatch')
 where exists (select 1 from cron.job where jobname = 'caven-push-dispatch');

select cron.schedule(
  'caven-push-dispatch',
  '* * * * *',
  $$
  select net.http_post(
    url := (select value from private_config where key = 'dispatch_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-caven-cron', (select value from private_config where key = 'cron_secret')
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
-- Stopping it:
--   select cron.unschedule('caven-push-dispatch');
