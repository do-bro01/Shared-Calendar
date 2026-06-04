-- =========================================================
-- SC RAG Extension — 챗봇 + 임베딩 스키마
-- =========================================================
-- 목적
--   1) group_events에 메모 임베딩 컬럼 추가 (pgvector)
--   2) 챗봇 대화 보존용 chat_sessions / chat_messages
--   3) 그룹 단위 유사도 검색 RPC (RLS 자동 적용)
--   4) pg_cron + pg_net 활성화 (다음 단계에서 Edge Function 자동 호출)
--
-- 주의
--   - 기존 group_events / RLS는 건드리지 않음 (컬럼 추가만)
--   - service_role 키는 절대 Edge Function/클라이언트에서 사용 금지
--   - pg_cron 스케줄 등록은 Edge Function 배포 후 별도 SQL로 진행
-- =========================================================

-- ---------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------
create extension if not exists vector;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------
-- group_events: 메모 임베딩 컬럼 추가
--   - memo_embedding: OpenAI text-embedding-3-small (1536 dim)
--   - memo_embedded_at: 임베딩 생성/갱신 시각
--     · NULL 이거나 updated_at 보다 오래되면 배치 재임베딩 대상
-- ---------------------------------------------------------
alter table public.group_events
  add column if not exists memo_embedding vector(1536),
  add column if not exists memo_embedded_at timestamptz;

-- HNSW 인덱스 (cosine). NULL 행은 자동 제외됨.
create index if not exists group_events_memo_embedding_idx
  on public.group_events
  using hnsw (memo_embedding vector_cosine_ops);

-- 배치 잡 효율: "재임베딩 필요" 행만 빠르게 스캔
create index if not exists group_events_memo_embed_pending_idx
  on public.group_events (group_calendar_id, updated_at)
  where memo is not null
    and (memo_embedded_at is null or memo_embedded_at < updated_at);

-- ---------------------------------------------------------
-- 메모 변경 시 임베딩 자동 무효화
--   - memo 가 바뀌면 memo_embedding / memo_embedded_at 초기화
--   - 클라이언트가 깜빡해도 다음 배치에서 자동 재임베딩
-- ---------------------------------------------------------
create or replace function public.reset_memo_embedding_on_change()
returns trigger
language plpgsql
as $$
begin
  if NEW.memo is distinct from OLD.memo then
    NEW.memo_embedding := null;
    NEW.memo_embedded_at := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists group_events_reset_memo_embed on public.group_events;
create trigger group_events_reset_memo_embed
  before update on public.group_events
  for each row execute function public.reset_memo_embedding_on_change();

-- ---------------------------------------------------------
-- chat_sessions
--   - 사용자 × 그룹 캘린더 단위 (한 그룹에 여러 세션 허용)
--   - title 은 첫 메시지 후 LLM 자동 생성 (Edge Function 단계)
-- ---------------------------------------------------------
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_calendar_id uuid not null references public.group_calendars(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_user_updated_idx
  on public.chat_sessions(user_id, updated_at desc);
create index if not exists chat_sessions_group_idx
  on public.chat_sessions(group_calendar_id);

-- ---------------------------------------------------------
-- chat_messages
--   - role: user / assistant / system
--   - retrieved_chunks: assistant 응답이 참조한 청크 (출처 카드용)
--     [{event_id, title, date, snippet, score}, ...]
--   - token_usage: 비용 추적용
-- ---------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  retrieved_chunks jsonb,
  token_usage jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_created_idx
  on public.chat_messages(session_id, created_at asc);

-- ---------------------------------------------------------
-- 메시지 INSERT 시 세션 updated_at 갱신
-- ---------------------------------------------------------
create or replace function public.touch_chat_session()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.chat_sessions
    set updated_at = now()
    where id = NEW.session_id;
  return NEW;
end;
$$;

drop trigger if exists chat_messages_touch_session on public.chat_messages;
create trigger chat_messages_touch_session
  after insert on public.chat_messages
  for each row execute function public.touch_chat_session();

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- chat_sessions: 본인 세션만. 생성 시엔 그룹 멤버 확인.
drop policy if exists "chat_sessions_select_self" on public.chat_sessions;
create policy "chat_sessions_select_self" on public.chat_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "chat_sessions_insert_self" on public.chat_sessions;
create policy "chat_sessions_insert_self" on public.chat_sessions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.group_calendars gc
      where gc.id = chat_sessions.group_calendar_id
        and auth.uid() = any(gc.members)
    )
  );

drop policy if exists "chat_sessions_update_self" on public.chat_sessions;
create policy "chat_sessions_update_self" on public.chat_sessions
  for update using (auth.uid() = user_id);

drop policy if exists "chat_sessions_delete_self" on public.chat_sessions;
create policy "chat_sessions_delete_self" on public.chat_sessions
  for delete using (auth.uid() = user_id);

-- chat_messages: 본인 세션에 속한 메시지만
drop policy if exists "chat_messages_select_self" on public.chat_messages;
create policy "chat_messages_select_self" on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_sessions cs
      where cs.id = chat_messages.session_id
        and cs.user_id = auth.uid()
    )
  );

drop policy if exists "chat_messages_insert_self" on public.chat_messages;
create policy "chat_messages_insert_self" on public.chat_messages
  for insert with check (
    exists (
      select 1 from public.chat_sessions cs
      where cs.id = chat_messages.session_id
        and cs.user_id = auth.uid()
    )
  );

drop policy if exists "chat_messages_delete_self" on public.chat_messages;
create policy "chat_messages_delete_self" on public.chat_messages
  for delete using (
    exists (
      select 1 from public.chat_sessions cs
      where cs.id = chat_messages.session_id
        and cs.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------
-- Realtime publication
--   - 다른 기기에서 새 메시지가 들어오면 실시간 반영
-- ---------------------------------------------------------
alter publication supabase_realtime add table public.chat_sessions;
alter publication supabase_realtime add table public.chat_messages;

-- ---------------------------------------------------------
-- 그룹 단위 유사도 검색 RPC
--   - SECURITY INVOKER (기본) → 호출자 권한으로 실행 → RLS 자동 적용
--     즉, 비멤버 그룹 id 를 넘겨도 group_events RLS 에 의해 0건 반환
--   - p_match_count 기본 8 (Edge Function 에서 조정 가능)
-- ---------------------------------------------------------
create or replace function public.search_group_memories(
  p_group_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 8
)
returns table (
  event_id uuid,
  title text,
  event_date date,
  event_end_date date,
  memo text,
  score float
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    ge.id       as event_id,
    ge.title    as title,
    ge.date     as event_date,
    ge.end_date as event_end_date,
    ge.memo     as memo,
    1 - (ge.memo_embedding <=> p_query_embedding) as score
  from public.group_events ge
  where ge.group_calendar_id = p_group_id
    and ge.memo_embedding is not null
  order by ge.memo_embedding <=> p_query_embedding
  limit p_match_count;
$$;
