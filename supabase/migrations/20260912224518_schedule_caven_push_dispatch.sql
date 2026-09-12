-- Scheduling for reminder delivery. Every minute, because a reminder due at
-- 6:26pm is no use at 7. Vercel Cron on a Hobby plan reduces a job to once a
-- day, so this is the mechanism rather than vercel.json — which is why that file
-- declares no cron at all.
--
-- The secret stays in the vault. A security definer function reads it at fire
-- time, so it never appears in the job definition where anyone with database
-- access could read it back out of cron.job. It must equal CAVEN_CRON_SECRET in
-- Vercel, or the route answers 403 and nothing is ever delivered.
create or replace function public.dispatch_caven_push()
returns bigint language plpgsql security definer set search_path='' as $$
declare secret text; request_id bigint;
begin
 select decrypted_secret into secret from vault.decrypted_secrets where name = 'caven_cron_secret';
 if secret is null then raise exception 'caven_cron_secret is not in the vault'; end if;
 select net.http_post(
   url := 'https://caven-green.vercel.app/api/push-dispatch',
   headers := jsonb_build_object('Content-Type','application/json','x-caven-cron', secret),
   body := '{}'::jsonb,
   timeout_milliseconds := 20000
 ) into request_id;
 return request_id;
end $$;
revoke all on function public.dispatch_caven_push() from public, anon, authenticated;

select cron.unschedule('caven-push-dispatch')
 where exists (select 1 from cron.job where jobname = 'caven-push-dispatch');

select cron.schedule('caven-push-dispatch', '* * * * *', 'select public.dispatch_caven_push();');

-- Checking on it:
--   select jobname, schedule, active from cron.job;
--   select status, return_message, start_time from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'caven-push-dispatch')
--    order by start_time desc limit 10;
--   select status_code, content, created from net._http_response order by created desc limit 5;
--
-- A healthy run is 200 {"ok":true,"claimed":N,"sent":N,"pruned":N}.
-- 403 means the vault secret and CAVEN_CRON_SECRET have drifted apart.
-- {"ok":false,"reason":"VAPID keys are not usable"} means the key pair is wrong.
--
-- Stopping it:  select cron.unschedule('caven-push-dispatch');
