create table public.caven_boards (user_id uuid primary key references auth.users on delete cascade, state jsonb not null default '{}', version bigint not null default 0);
alter table public.caven_boards enable row level security;
create policy own_board on public.caven_boards to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update on public.caven_boards to authenticated;
create table public.caven_reminders (user_id uuid references auth.users on delete cascade, id text, title text not null, due_at timestamptz not null, delivered_at timestamptz, lease_until timestamptz, primary key(user_id,id));
alter table public.caven_reminders enable row level security;
create policy own_reminders on public.caven_reminders to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.caven_reminders to authenticated;
create index caven_due on public.caven_reminders(due_at) where delivered_at is null;
create table public.caven_push (user_id uuid references auth.users on delete cascade, endpoint text, subscription jsonb not null, primary key(user_id,endpoint));
alter table public.caven_push enable row level security;
create policy own_push on public.caven_push to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.caven_push to authenticated;
-- Compare-and-swap and scheduling share one transaction. A stale tab cannot overwrite a newer board.
create function public.save_caven_board(expected_version bigint, new_state jsonb) returns bigint language plpgsql security invoker set search_path='' as $$
declare next_version bigint; item jsonb;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 insert into public.caven_boards(user_id) values(auth.uid()) on conflict do nothing;
 update public.caven_boards set state=new_state,version=version+1 where user_id=auth.uid() and version=expected_version returning version into next_version;
 if next_version is null then raise exception 'version_conflict' using errcode='40001'; end if;
 delete from public.caven_reminders where user_id=auth.uid() and id not in (select r->>'id' from jsonb_array_elements(coalesce(new_state->'reminders','[]')) r where r->>'dueAt' is not null);
 for item in select * from jsonb_array_elements(coalesce(new_state->'reminders','[]')) loop
  if item->>'dueAt' is not null then
   insert into public.caven_reminders(user_id,id,title,due_at) values(auth.uid(),item->>'id',item->>'title',(item->>'dueAt')::timestamptz)
   on conflict(user_id,id) do update set title=excluded.title,due_at=excluded.due_at,delivered_at=case when public.caven_reminders.due_at=excluded.due_at then public.caven_reminders.delivered_at else null end;
  end if;
 end loop;
 return next_version;
end $$;
revoke all on function public.save_caven_board(bigint,jsonb) from public,anon;
grant execute on function public.save_caven_board(bigint,jsonb) to authenticated;
create function public.claim_caven_reminders() returns setof public.caven_reminders language sql security invoker set search_path='' as $$
 update public.caven_reminders set lease_until=now()+interval '2 minutes' where (user_id,id) in (
 select user_id,id from public.caven_reminders where delivered_at is null and due_at<=now() and (lease_until is null or lease_until<now()) order by due_at limit 50 for update skip locked
 ) returning *;
$$;
revoke all on function public.claim_caven_reminders() from public,anon,authenticated;
grant execute on function public.claim_caven_reminders() to service_role;
grant all on public.caven_boards,public.caven_reminders,public.caven_push to service_role;
-- Preserve the old board privately; never assign it to whichever visitor signs up first.
revoke all on public.kv_store_3159d1b2 from anon,authenticated;
