# SC RAG 확장 — DB 설계 문서

> 작성일: 2026-05-15
> 버전: v0.1
> 관련 문서: [아이디어 초안](idea-draft.md), [프로젝트 계획서](project-plan.md)
> 기반 DB: [SC MVP 스키마](../../supabase/migrations/shared_calendar_initial_schema.sql)

---

## 1. 개요

기존 MVP의 5개 테이블 위에 **사진 / 코멘트 / 챗봇 / 임베딩**을 위한 신규 테이블을 추가한다. 벡터 검색은 별도 DB가 아닌 **Supabase pgvector**를 사용하여 기존 Postgres + RLS 인프라와 자연스럽게 통합한다.

### 1.1 기존 테이블 (변경 없음)
| 테이블 | 역할 |
|--------|------|
| `users` | 앱 프로필, SC ID |
| `friendships` | 친구 관계 |
| `group_calendars` | 달력방 (멤버 배열) |
| `group_events` | 공유 일정 |
| `personal_events` | 개인 일정 |

### 1.2 신규 테이블 (5개)
| 테이블 | 역할 |
|--------|------|
| `event_photos` | 일정에 첨부된 사진 + 캡션 + 임베딩 |
| `event_comments` | 일정에 달린 코멘트 + 임베딩 |
| `chat_sessions` | 챗봇 대화 세션 |
| `chat_messages` | 챗봇 메시지 (user/assistant) + 참조 청크 |
| `event_summaries` | (선택) LLM 월별 요약 캐시 |

---

## 2. ERD (Entity Relationship Diagram)

```
auth.users (Supabase)
   │ 1:1
   ▼
users  ────── sc_id (UNIQUE)
   │
   │ N:M
   ▼
friendships

auth.users
   │ 1:N (created_by)
   ▼
group_calendars  ── members: UUID[]
   │ 1:N
   ▼
group_events  ─────────┐
                       │
auth.users  1:N        │
   │                   │
   ▼                   ▼
personal_events    ┌─ event_photos ── caption_embedding (vector)
                   │
                   └─ event_comments ── text_embedding (vector)

auth.users
   │ 1:N
   ▼
chat_sessions
   │ 1:N
   ▼
chat_messages ─── retrieved_chunks: jsonb (RAG 검색 결과 보존)

(선택)
group_calendars/auth.users
   │ 1:N
   ▼
event_summaries (month, scope, summary_text)
```

### 2.1 폴리모픽 관계 설계

`event_photos`와 `event_comments`는 **개인 일정(`personal_events`)** 과 **그룹 일정(`group_events`)** 양쪽에 붙을 수 있다. 두 가지 패턴이 가능하다:

| 패턴 | 장점 | 단점 |
|------|------|------|
| **A. 폴리모픽** (`event_type` + `event_id`) | 테이블 수 적음, 검색 단순 | DB 레벨 FK 강제 불가 |
| **B. 분리** (`personal_event_id`, `group_event_id` 둘 중 하나만 채움) | FK 강제 가능 | 검색 시 UNION 필요 |

**선택: 패턴 A (폴리모픽)**. 이유:
- 검색 시 단일 인덱스 사용 가능 (벡터 인덱스를 두 번 만들지 않아도 됨)
- 챗봇 컨텍스트 구성 시 결과 단순화
- FK 강제는 application layer + check constraint로 보완

```sql
event_type text not null check (event_type in ('personal','group'))
```

---

## 3. 신규 테이블 정의

### 3.1 event_photos

일정에 첨부된 사진. 캡션은 Vision API로 자동 생성하여 검색 가능.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | Y | PK |
| event_type | text | Y | 'personal' \| 'group' |
| event_id | UUID | Y | 참조 일정 ID (폴리모픽) |
| storage_path | text | Y | Supabase Storage 경로 (예: `event-photos/{user_id}/{uuid}.jpg`) |
| caption | text | N | Vision API로 생성된 사진 설명 (한국어) |
| caption_embedding | vector(1536) | N | caption 임베딩 (OpenAI text-embedding-3-small) |
| uploaded_by | UUID | Y | `auth.users(id)` |
| created_at | timestamptz | Y | 업로드 시각 |

**인덱스**
- `event_type, event_id` 복합 인덱스 (일정별 조회)
- `caption_embedding` HNSW 인덱스 (cosine)
- `uploaded_by` 인덱스

### 3.2 event_comments

일정에 달린 코멘트.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | Y | PK |
| event_type | text | Y | 'personal' \| 'group' |
| event_id | UUID | Y | 참조 일정 ID |
| user_id | UUID | Y | 작성자 `auth.users(id)` |
| text | text | Y | 코멘트 본문 |
| text_embedding | vector(1536) | N | text 임베딩 |
| created_at | timestamptz | Y | |
| updated_at | timestamptz | Y | 수정 시 갱신, 임베딩 재생성 트리거 |

**인덱스**
- `event_type, event_id` 복합 인덱스
- `text_embedding` HNSW 인덱스
- `user_id` 인덱스

### 3.3 chat_sessions

챗봇 대화 세션. 사용자별로 여러 개 보유 가능.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | Y | PK |
| user_id | UUID | Y | `auth.users(id)` (CASCADE) |
| scope | text | Y | 'personal' \| 'group:{group_id}' (검색 범위) |
| title | text | N | 첫 메시지에서 LLM이 자동 생성 (예: "여름 휴가 회상") |
| created_at | timestamptz | Y | |
| updated_at | timestamptz | Y | 마지막 메시지 시각 |

**인덱스**
- `user_id, updated_at desc` 복합 인덱스 (최근 세션 목록)

### 3.4 chat_messages

챗봇의 사용자/어시스턴트 메시지. Memory 기능 핵심.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | Y | PK |
| session_id | UUID | Y | `chat_sessions(id)` (CASCADE) |
| role | text | Y | 'user' \| 'assistant' \| 'system' |
| content | text | Y | 메시지 본문 |
| retrieved_chunks | jsonb | N | RAG 검색 결과 (assistant 메시지에만): `[{type, id, score, snippet}, ...]` |
| token_usage | jsonb | N | `{prompt_tokens, completion_tokens}` (비용 추적용) |
| created_at | timestamptz | Y | |

**인덱스**
- `session_id, created_at asc` 복합 인덱스 (대화 시간순 조회)

> **Memory 구현 방식**: 챗봇 호출 시 `chat_messages`에서 최근 N개(예: 10개)를 가져와 LLM 프롬프트에 system + 과거 대화로 주입. 긴 세션은 요약하여 첫 system 메시지에 추가하는 conversation summary buffer 패턴.

### 3.5 event_summaries (선택)

LLM이 생성한 월별 요약 캐시. 매번 재생성하지 않기 위함.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | Y | PK |
| scope_type | text | Y | 'personal' \| 'group' |
| scope_id | UUID | Y | user_id 또는 group_calendar_id |
| period | text | Y | 'YYYY-MM' 형식 (예: '2026-04') |
| summary | text | Y | LLM 요약 본문 |
| event_count | int | Y | 요약에 포함된 일정 수 (변동 감지용) |
| created_at | timestamptz | Y | 생성 시각 |

**UNIQUE 제약**: `(scope_type, scope_id, period)` — 같은 범위·기간 중복 방지.

> 호출 시 `event_count`가 현재와 다르면 재생성, 같으면 캐시 반환.

---

## 4. pgvector 인덱스 설정

### 4.1 익스텐션 활성화
```sql
create extension if not exists vector;
```

### 4.2 인덱스 종류

| 타입 | 특징 | 권장 상황 |
|------|------|---------|
| **HNSW** | 정확도·속도 우수, 인덱스 크기 큼 | 데이터 < 1M일 때 (본 프로젝트) |
| **IVFFlat** | 메모리 효율적, 학습 필요 | 대규모 데이터 |

**선택: HNSW** (데이터 규모상 적합).

### 4.3 인덱스 생성 예시

```sql
create index event_comments_embedding_idx
  on event_comments
  using hnsw (text_embedding vector_cosine_ops);

create index event_photos_embedding_idx
  on event_photos
  using hnsw (caption_embedding vector_cosine_ops);
```

### 4.4 유사도 검색 쿼리

```sql
-- 사용자가 자연어 질문 → 임베딩 변환 후
-- 본인 권한 내에서 유사도 상위 K개 검색
select id, text, 1 - (text_embedding <=> $1) as similarity
from event_comments
where text_embedding is not null
order by text_embedding <=> $1
limit 10;
```

연산자 정리:
- `<->`: L2 거리
- `<#>`: 음수 내적
- `<=>`: 코사인 거리 (1 - cosine_similarity)

---

## 5. RLS (Row Level Security) 정책

기존 MVP의 RLS 원칙을 유지하고, 신규 테이블에 동일한 패턴을 적용한다.

### 5.1 event_photos / event_comments

원본 일정(`personal_events` 또는 `group_events`) 권한을 그대로 따라간다.

```sql
alter table event_comments enable row level security;

-- SELECT: 본인 개인 일정 또는 자신이 멤버인 그룹 일정의 코멘트
create policy "event_comments_select" on event_comments
  for select using (
    (event_type = 'personal'
     and exists (
       select 1 from personal_events pe
       where pe.id = event_comments.event_id
         and pe.user_id = auth.uid()
     ))
    or
    (event_type = 'group'
     and exists (
       select 1 from group_events ge
       join group_calendars gc on gc.id = ge.group_calendar_id
       where ge.id = event_comments.event_id
         and auth.uid() = any(gc.members)
     ))
  );

-- INSERT: 본인이 작성자이면서 해당 일정 권한 보유
create policy "event_comments_insert" on event_comments
  for insert with check (
    auth.uid() = user_id
    and (
      (event_type = 'personal'
       and exists (
         select 1 from personal_events pe
         where pe.id = event_id and pe.user_id = auth.uid()
       ))
      or
      (event_type = 'group'
       and exists (
         select 1 from group_events ge
         join group_calendars gc on gc.id = ge.group_calendar_id
         where ge.id = event_id and auth.uid() = any(gc.members)
       ))
    )
  );

-- UPDATE / DELETE: 본인 작성 코멘트만
create policy "event_comments_update" on event_comments
  for update using (auth.uid() = user_id);
create policy "event_comments_delete" on event_comments
  for delete using (auth.uid() = user_id);
```

`event_photos`도 같은 패턴 적용.

### 5.2 chat_sessions / chat_messages

본인 데이터만 접근 가능.

```sql
alter table chat_sessions enable row level security;
create policy "chat_sessions_self" on chat_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table chat_messages enable row level security;
create policy "chat_messages_self" on chat_messages
  for all using (
    exists (
      select 1 from chat_sessions cs
      where cs.id = chat_messages.session_id and cs.user_id = auth.uid()
    )
  );
```

### 5.3 RAG 검색 시 RLS 자동 적용

pgvector 검색 쿼리는 일반 SELECT와 동일하게 RLS가 작동한다. 따라서 사용자가 검색을 호출하면 **자기 권한 밖 데이터는 자동으로 결과에서 제외**된다.

> **이것이 본 프로젝트의 핵심 차별점**: 별도 권한 필터 코드 없이 DB 레벨에서 권한 격리가 강제됨.

### 5.4 Storage 권한 (event-photos 버킷)

```sql
-- 본인이 업로드한 파일만 접근
create policy "event_photos_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'event-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      -- 또는 그룹 멤버 검증 로직
    )
  );
```

상세는 Supabase Storage RLS 가이드에 맞춰 별도 마이그레이션에서 설정.

---

## 6. 마이그레이션 SQL (요약)

전체 SQL은 별도 파일로 분리 (예: `supabase/migrations/rag_extension_schema.sql`).

```sql
-- ============================================================
-- SC RAG Extension — 신규 스키마
-- ============================================================

create extension if not exists vector;

-- event_photos
create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('personal','group')),
  event_id uuid not null,
  storage_path text not null,
  caption text,
  caption_embedding vector(1536),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists event_photos_event_idx
  on event_photos(event_type, event_id);
create index if not exists event_photos_embedding_idx
  on event_photos using hnsw (caption_embedding vector_cosine_ops);

-- event_comments
create table if not exists public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('personal','group')),
  event_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  text_embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists event_comments_event_idx
  on event_comments(event_type, event_id);
create index if not exists event_comments_embedding_idx
  on event_comments using hnsw (text_embedding vector_cosine_ops);

-- chat_sessions
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_sessions_user_idx
  on chat_sessions(user_id, updated_at desc);

-- chat_messages
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  retrieved_chunks jsonb,
  token_usage jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_session_idx
  on chat_messages(session_id, created_at asc);

-- event_summaries (선택)
create table if not exists public.event_summaries (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('personal','group')),
  scope_id uuid not null,
  period text not null,
  summary text not null,
  event_count int not null,
  created_at timestamptz not null default now(),
  unique (scope_type, scope_id, period)
);

-- RLS 정책 (위 §5 참조)
-- ...

-- Realtime publications (필요 시)
alter publication supabase_realtime add table public.event_photos;
alter publication supabase_realtime add table public.event_comments;
alter publication supabase_realtime add table public.chat_messages;
```

---

## 7. 임베딩 생성 흐름

### 7.1 트리거 방식 (권장)

DB Trigger + Edge Function 호출로 자동화.

```sql
create or replace function trigger_embed_comment()
returns trigger as $$
begin
  -- pg_net 또는 Supabase HTTP extension으로 Edge Function 호출
  perform net.http_post(
    url := 'https://(project).functions.supabase.co/embed',
    body := jsonb_build_object('table','event_comments','id',new.id,'text',new.text)
  );
  return new;
end;
$$ language plpgsql;

create trigger event_comments_embed_trigger
after insert or update of text on event_comments
for each row execute function trigger_embed_comment();
```

### 7.2 백필 방식 (초기 합성 데이터)

Python 또는 TS 스크립트로 일괄 처리. 둘 다 가능.

```python
# Python 예시
for row in unembedded_rows:
    emb = openai.embeddings.create(model="text-embedding-3-small", input=row.text)
    supabase.table("event_comments").update({"text_embedding": emb}).eq("id", row.id).execute()
```

```typescript
// TypeScript 예시 (Deno 또는 Node)
for (const row of unembeddedRows) {
  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: row.text,
  });
  await supabase
    .from("event_comments")
    .update({ text_embedding: data[0].embedding })
    .eq("id", row.id);
}
```

---

## 8. 검색 → LLM 흐름 (Edge Function)

```typescript
// supabase/functions/chat-rag/index.ts
serve(async (req) => {
  const { session_id, user_message } = await req.json();

  // 1. 사용자 인증 확인 (Supabase JWT)
  const user = await verifyAuth(req);

  // 2. 질문 임베딩
  const query_embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: user_message
  });

  // 3. RLS가 자동 적용된 상태로 유사도 검색
  const { data: chunks } = await supabase.rpc("search_memories", {
    query_embedding,
    match_count: 10
  });

  // 4. 이전 대화 컨텍스트 조회 (Memory)
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role,content")
    .eq("session_id", session_id)
    .order("created_at", { ascending: true })
    .limit(20);

  // 5. LLM 호출
  const answer = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    system: buildSystemPrompt(chunks),
    messages: [...history, { role: "user", content: user_message }]
  });

  // 6. 메시지 + retrieved_chunks 저장
  await supabase.from("chat_messages").insert([
    { session_id, role: "user", content: user_message },
    {
      session_id,
      role: "assistant",
      content: answer.content,
      retrieved_chunks: chunks.map(c => ({ id: c.id, score: c.score, snippet: c.text })),
      token_usage: answer.usage
    }
  ]);

  return new Response(JSON.stringify({ answer: answer.content, sources: chunks }));
});
```

`search_memories` RPC 예시:
```sql
create or replace function search_memories(query_embedding vector(1536), match_count int default 10)
returns table (
  source_type text, id uuid, event_id uuid, text text, score float
)
language sql stable as $$
  (select 'comment' as source_type, id, event_id, text,
          1 - (text_embedding <=> query_embedding) as score
   from event_comments
   where text_embedding is not null
   order by text_embedding <=> query_embedding limit match_count)
  union all
  (select 'photo' as source_type, id, event_id, caption as text,
          1 - (caption_embedding <=> query_embedding) as score
   from event_photos
   where caption_embedding is not null
   order by caption_embedding <=> query_embedding limit match_count)
  order by score desc limit match_count;
$$;
```

> RLS는 SQL 함수 호출에도 자동 적용되므로, 사용자별 권한 격리 별도 코드 불필요.

---

## 9. 합성 데이터 (Seed) 전략

발표 데모를 위해 가상 사용자 2~3명의 2년치 데이터를 생성.

### 9.1 구성
| 항목 | 수량 | 비고 |
|------|------|------|
| 가상 사용자 | 3명 | 연인 2명 + 친구 1명 |
| 달력방 | 2개 | "우리" (연인), "친구들" |
| 개인 일정 | 사용자당 200개 | 2년치 |
| 그룹 일정 | 100개 | 함께한 약속 |
| 사진 | 80장 | 대표 일정에만 |
| 코멘트 | 300개 | 일정의 30~50%에 부착 |

### 9.2 생성 방법
1. **일정 템플릿** 작성 (생일, 데이트, 휴가, 회식 등 카테고리)
2. LLM(GPT-4o-mini)로 자연스러운 코멘트·캡션 생성
3. 무료 이미지 (Unsplash API) 또는 Stable Diffusion으로 사진 생성
4. Python 스크립트로 일괄 INSERT + 임베딩 생성

---

## 10. 비용 추정

### 10.1 임베딩
- `text-embedding-3-small`: $0.02 / 1M 토큰
- 평균 코멘트 50토큰 × 300개 + 캡션 30토큰 × 80개 = ~17,400 토큰
- **합성 데이터 1회 임베딩 비용: < $0.001**

### 10.2 LLM (챗봇)
- 평균 대화당 입력 2,000토큰 + 출력 300토큰
- Claude Haiku 4.5 기준: 약 $0.0035 / 대화
- 데모 시연 50회 가정: **< $0.20**

### 10.3 Vision (사진 캡션)
- 사진 80장 × Claude Sonnet Vision (이미지당 ~$0.005) = **< $0.5**

### 10.4 Storage
- 사진 80장 × 평균 500KB = 40MB → **Supabase 무료 한도 내**

**합계 예상 비용: < $1** (수업 발표 한정)

---

## 11. 마이그레이션 순서

1. `supabase/migrations/rag_extension_schema.sql` 작성 (위 §6)
2. Supabase 대시보드 SQL Editor에서 실행
3. Storage 버킷 `event-photos` 생성 + RLS 설정
4. Edge Function `embed`, `chat-rag` 배포
5. 합성 데이터 seed 스크립트 실행
6. 임베딩 백필 확인
7. 챗봇 화면에서 첫 질문 → 응답 확인

---

## 12. 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|---------|------|
| 2026-05-15 | v0.1 | 최초 작성 | (작성자) |
