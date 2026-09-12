-- Reminder delivery.
--
-- caven_reminders is the scheduler's view of the board. It knew when a reminder
-- was due but not whether it recurred, and not which zone it was set in, so
-- nothing could roll one forward — which is why "every weekday at 9am" was one
-- reminder that fired once. It also had no way to be told that an occurrence had
-- already been announced inside the open app.

alter table public.caven_reminders add column if not exists repeat text;
alter table public.caven_reminders add column if not exists timezone text;

-- Replaced wholesale, same compare-and-swap as before. The additions: the repeat
-- rule and zone travel through to the scheduler, and a reminder the app already
-- announced itself (firedAt) arrives already marked delivered, so push does not
-- say the same thing a second time.
create or replace function public.save_caven_board(expected_version bigint, new_state jsonb) returns bigint language plpgsql security invoker set search_path='' as $$
declare next_version bigint; item jsonb;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 insert into public.caven_boards(user_id) values(auth.uid()) on conflict do nothing;
 update public.caven_boards set state=new_state,version=version+1 where user_id=auth.uid() and version=expected_version returning version into next_version;
 if next_version is null then raise exception 'version_conflict' using errcode='40001'; end if;
 delete from public.caven_reminders where user_id=auth.uid() and id not in (select r->>'id' from jsonb_array_elements(coalesce(new_state->'reminders','[]')) r where r->>'dueAt' is not null);
 for item in select * from jsonb_array_elements(coalesce(new_state->'reminders','[]')) loop
  if item->>'dueAt' is not null then
   insert into public.caven_reminders(user_id,id,title,due_at,repeat,timezone,delivered_at)
   values(
     auth.uid(), item->>'id', item->>'title', (item->>'dueAt')::timestamptz,
     item->>'repeat', item->>'timezone',
     -- Only a one-off can be finished by being announced; a repeating one has
     -- already been rolled on to a later dueAt by whoever announced it.
     case when item->>'firedAt' is not null and item->>'repeat' is null
          then (item->>'firedAt')::timestamptz end)
   on conflict(user_id,id) do update set
     title=excluded.title,
     due_at=excluded.due_at,
     repeat=excluded.repeat,
     timezone=excluded.timezone,
     lease_until=null,
     -- A new due time is a new occasion and is owed afresh; an unchanged one
     -- keeps whatever delivery mark it had, or takes a new one from the board.
     delivered_at=case
       when public.caven_reminders.due_at=excluded.due_at
       then coalesce(excluded.delivered_at, public.caven_reminders.delivered_at)
       else excluded.delivered_at
     end;
  end if;
 end loop;
 return next_version;
end $$;
revoke all on function public.save_caven_board(bigint,jsonb) from public,anon;
grant execute on function public.save_caven_board(bigint,jsonb) to authenticated;

-- Called by the delivery worker once a reminder has actually gone out. Writes
-- the scheduler row and the board the app reads in one transaction, so the two
-- cannot disagree about whether it was sent. p_next is the reminder's next
-- occurrence when it repeats, and null when it is finished with.
--
-- The version bump is deliberate: an open tab holding the older board will get a
-- 409 on its next save and be offered a reload, rather than quietly writing the
-- delivery back out of existence.
create or replace function public.settle_caven_reminder(p_user uuid, p_id text, p_patch jsonb, p_next timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare patched jsonb;
begin
 update public.caven_reminders
    set delivered_at = case when p_next is null then now() else null end,
        due_at = coalesce(p_next, due_at),
        lease_until = null
  where user_id = p_user and id = p_id;

 select jsonb_agg(case when r->>'id' = p_id then r || p_patch else r end order by idx)
   into patched
   from public.caven_boards b,
        lateral jsonb_array_elements(coalesce(b.state->'reminders','[]')) with ordinality as t(r, idx)
  where b.user_id = p_user;

 if patched is not null then
  update public.caven_boards
     set state = jsonb_set(coalesce(state,'{}'::jsonb), '{reminders}', patched),
         version = version + 1
   where user_id = p_user;
 end if;
end $$;
revoke all on function public.settle_caven_reminder(uuid,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.settle_caven_reminder(uuid,text,jsonb,timestamptz) to service_role;
