-- =========================================================
-- Fix: ensure user-referencing FKs point to auth.users(id)
-- (some deployments ended up referencing public.users instead,
--  causing 23503 errors on insert)
-- =========================================================

-- group_calendars.created_by
alter table public.group_calendars
  drop constraint if exists group_calendars_created_by_fkey;
alter table public.group_calendars
  add constraint group_calendars_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete cascade;

-- group_events.user_id
alter table public.group_events
  drop constraint if exists group_events_user_id_fkey;
alter table public.group_events
  add constraint group_events_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- personal_events.user_id
alter table public.personal_events
  drop constraint if exists personal_events_user_id_fkey;
alter table public.personal_events
  add constraint personal_events_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- friendships.user1 / user2 / requester
alter table public.friendships
  drop constraint if exists friendships_user1_fkey;
alter table public.friendships
  add constraint friendships_user1_fkey
  foreign key (user1) references auth.users(id) on delete cascade;

alter table public.friendships
  drop constraint if exists friendships_user2_fkey;
alter table public.friendships
  add constraint friendships_user2_fkey
  foreign key (user2) references auth.users(id) on delete cascade;

alter table public.friendships
  drop constraint if exists friendships_requester_fkey;
alter table public.friendships
  add constraint friendships_requester_fkey
  foreign key (requester) references auth.users(id) on delete cascade;
