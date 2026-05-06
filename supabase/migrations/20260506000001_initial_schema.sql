-- =========================================================
-- Initial schema for SC (Shared Calendar) app
-- Tables: users, friendships, group_calendars, group_events, personal_events
-- Auth: Supabase Auth (OAuth: Google)
-- =========================================================

-- ---------------------------------------------------------
-- users
-- 앱 자체 프로필 (auth.users에 1:1 연결)
-- sc_id: 친구 추가용 6자리 고유 코드
-- ---------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  sc_id varchar(6) not null unique,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists users_auth_id_idx on public.users(auth_id);
create index if not exists users_sc_id_idx on public.users(sc_id);

-- ---------------------------------------------------------
-- friendships
-- id 형식: `${sorted_uid1}_${sorted_uid2}` (양방향 중복 방지)
-- ---------------------------------------------------------
create table if not exists public.friendships (
  id text primary key,
  user1 uuid not null references auth.users(id) on delete cascade,
  user2 uuid not null references auth.users(id) on delete cascade,
  requester uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint friendships_users_sorted check (user1 < user2)
);

create index if not exists friendships_user1_idx on public.friendships(user1);
create index if not exists friendships_user2_idx on public.friendships(user2);

-- ---------------------------------------------------------
-- group_calendars
-- members: 멤버 auth_id 배열
-- ---------------------------------------------------------
create table if not exists public.group_calendars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  members uuid[] not null default '{}',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists group_calendars_members_idx
  on public.group_calendars using gin (members);
create index if not exists group_calendars_created_by_idx
  on public.group_calendars(created_by);

-- ---------------------------------------------------------
-- group_events
-- ---------------------------------------------------------
create table if not exists public.group_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  end_date date not null,
  group_calendar_id uuid not null references public.group_calendars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_personal_event_id uuid,
  dot_color text not null default '#395fa5ff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists group_events_calendar_idx
  on public.group_events(group_calendar_id);
create index if not exists group_events_calendar_date_idx
  on public.group_events(group_calendar_id, date);
create index if not exists group_events_user_idx
  on public.group_events(user_id);

-- ---------------------------------------------------------
-- personal_events
-- linked_group_event_ids: 연결된 그룹 이벤트 id 배열
-- ---------------------------------------------------------
create table if not exists public.personal_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  end_date date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_group_event_ids uuid[] not null default '{}',
  dot_color text not null default '#395fa5ff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_events_user_idx
  on public.personal_events(user_id);
create index if not exists personal_events_user_date_idx
  on public.personal_events(user_id, date);

-- ---------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------
alter table public.users            enable row level security;
alter table public.friendships      enable row level security;
alter table public.group_calendars  enable row level security;
alter table public.group_events     enable row level security;
alter table public.personal_events  enable row level security;

-- users: 모두 읽기 가능 (SC ID/이름 검색용), 본인만 본인 프로필 수정
drop policy if exists "users_select_all" on public.users;
create policy "users_select_all" on public.users
  for select using (true);

drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self" on public.users
  for insert with check (auth.uid() = auth_id);

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users
  for update using (auth.uid() = auth_id);

-- friendships: 본인이 user1 또는 user2일 때만
drop policy if exists "friendships_select_self" on public.friendships;
create policy "friendships_select_self" on public.friendships
  for select using (auth.uid() = user1 or auth.uid() = user2);

drop policy if exists "friendships_insert_self" on public.friendships;
create policy "friendships_insert_self" on public.friendships
  for insert with check (auth.uid() = requester
    and (auth.uid() = user1 or auth.uid() = user2));

drop policy if exists "friendships_delete_self" on public.friendships;
create policy "friendships_delete_self" on public.friendships
  for delete using (auth.uid() = user1 or auth.uid() = user2);

-- group_calendars: 멤버만 읽기, 멤버만 수정, 생성자만 삭제
drop policy if exists "group_calendars_select_member" on public.group_calendars;
create policy "group_calendars_select_member" on public.group_calendars
  for select using (auth.uid() = any(members));

drop policy if exists "group_calendars_insert_self" on public.group_calendars;
create policy "group_calendars_insert_self" on public.group_calendars
  for insert with check (auth.uid() = created_by);

drop policy if exists "group_calendars_update_member" on public.group_calendars;
create policy "group_calendars_update_member" on public.group_calendars
  for update using (auth.uid() = any(members));

drop policy if exists "group_calendars_delete_creator" on public.group_calendars;
create policy "group_calendars_delete_creator" on public.group_calendars
  for delete using (auth.uid() = created_by);

-- group_events: 그룹 멤버만 읽기/쓰기
drop policy if exists "group_events_select_member" on public.group_events;
create policy "group_events_select_member" on public.group_events
  for select using (
    exists (
      select 1 from public.group_calendars gc
      where gc.id = group_events.group_calendar_id
        and auth.uid() = any(gc.members)
    )
  );

drop policy if exists "group_events_insert_member" on public.group_events;
create policy "group_events_insert_member" on public.group_events
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.group_calendars gc
      where gc.id = group_events.group_calendar_id
        and auth.uid() = any(gc.members)
    )
  );

drop policy if exists "group_events_update_member" on public.group_events;
create policy "group_events_update_member" on public.group_events
  for update using (
    exists (
      select 1 from public.group_calendars gc
      where gc.id = group_events.group_calendar_id
        and auth.uid() = any(gc.members)
    )
  );

drop policy if exists "group_events_delete_member" on public.group_events;
create policy "group_events_delete_member" on public.group_events
  for delete using (
    exists (
      select 1 from public.group_calendars gc
      where gc.id = group_events.group_calendar_id
        and auth.uid() = any(gc.members)
    )
  );

-- personal_events: 본인만
drop policy if exists "personal_events_select_self" on public.personal_events;
create policy "personal_events_select_self" on public.personal_events
  for select using (auth.uid() = user_id);

drop policy if exists "personal_events_insert_self" on public.personal_events;
create policy "personal_events_insert_self" on public.personal_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "personal_events_update_self" on public.personal_events;
create policy "personal_events_update_self" on public.personal_events
  for update using (auth.uid() = user_id);

drop policy if exists "personal_events_delete_self" on public.personal_events;
create policy "personal_events_delete_self" on public.personal_events
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- Realtime publications
-- ---------------------------------------------------------
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.group_calendars;
alter publication supabase_realtime add table public.group_events;
alter publication supabase_realtime add table public.personal_events;
