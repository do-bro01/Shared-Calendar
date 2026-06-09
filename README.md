# SC — 공유 캘린더 + RAG 챗봇

> Expo + Supabase 기반의 개인/공유 캘린더 앱. 일정에 남긴 메모를 **pgvector + LLM 기반 RAG 챗봇**이 자연어로 검색·답변합니다.
>
> 본 README는 **코드 이해 문서**입니다. 설치/실행 안내 외에 시스템 아키텍처, RAG 파이프라인, 평가 결과(RAGAS), 핵심 설계 결정을 함께 정리했습니다.

---

## 1. 개요

| 항목     | 값                                                                                      |
| -------- | --------------------------------------------------------------------------------------- |
| 컨셉     | 친구·가족·커플이 공유 달력방을 만들어 일정과 짧은 메모를 남기고, 챗봇으로 회상          |
| 플랫폼   | Web(PWA), iOS, Android — Expo 단일 코드베이스                                           |
| 백엔드   | Supabase (Auth + Postgres + pgvector + Edge Functions)                                  |
| RAG 챗봇 | OpenAI `text-embedding-3-small` + `gpt-4o-mini`, top-k=8 벡터검색 + 그룹 일정 메타 채널 |
| 평가     | RAGAS 4 메트릭 + AnswerSimilarity, gpt-4o 평가자, 합성 그룹 캘린더(일정 80건/메모 60건) |
| 배포     | Vercel(웹), Supabase Edge Function (`embed-batch`, `chat-rag`)                          |

---

## 2. 시스템 아키텍처

```
┌─────────────────────────────────────────┐
│  React Native + Expo (Web/iOS/Android)  │
│  src/screens/ + src/services/           │
└──────────────┬──────────────────────────┘
               │ Supabase JS SDK (사용자 JWT)
               ▼
┌─────────────────────────────────────────┐         ┌────────────────────┐
│  Supabase Auth + Postgres (+ pgvector)  │◀────────│  Edge Function     │
│  RLS 가 모든 테이블에 자동 적용         │  RPC    │  embed-batch       │
│  - events / event_memos                 │         │  chat-rag          │
│  - group_calendars / friendships        │         │  (Deno/TS)         │
│  - chat_sessions / chat_messages        │         └────────┬───────────┘
│  - search_group_memories(rpc)           │                  │
└─────────────────────────────────────────┘                  │
                                                             ▼
                                                  ┌────────────────────┐
                                                  │  OpenAI API        │
                                                  │  - 임베딩           │
                                                  │  - gpt-4o-mini      │
                                                  └────────────────────┘

(평가 전용 — 별도 환경)
┌─────────────────────────────────────────┐
│  Python scripts/                        │
│  - seed_synthetic_data.py (합성 데이터) │
│  - eval_ragas.py (RAGAS 평가)           │
└─────────────────────────────────────────┘
```

핵심 원칙:

- 클라이언트와 Edge Function 모두 **사용자 JWT** 로만 Supabase 에 접근 → RLS 가 자동으로 권한 격리. 별도 권한 체크 코드 0줄.
- `service_role` 키는 **Python 평가 스크립트에서만** 사용 (합성 데이터 시드 목적). 클라이언트/Edge Function 절대 사용 금지.
- 벡터 DB 도입 X — Postgres `pgvector` 로 통합하여 RLS 와 자연 결합.

---

## 3. RAG 파이프라인 ([supabase/functions/chat-rag/index.ts](supabase/functions/chat-rag/index.ts))

질문 한 번에 대해 챗봇이 수행하는 흐름:

```
사용자 질문
   │
   ▼
[1] 임베딩(text-embedding-3-small)
   │
   ▼
[2] search_group_memories(group_id, embedding, top-k=8)   ──┐
   │    pgvector cosine 검색 + RLS(SECURITY INVOKER)        │ 의미 검색 채널
   │                                                         │
[3] 동일 group 의 일정 메타데이터 200건(최근순) 조회        │ 메타(시간/카테고리) 채널
   │                                                         │
[4] chat_messages 에서 직전 10개 히스토리 로드  ─────────────┘
   │
   ▼
[5] system prompt 구성
   - KST 기준 오늘 날짜·요일 명시 ("LLM 은 '오늘' 을 모른다" 보정)
   - top-8 메모 청크 + 메타 200건을 함께 주입
   │
   ▼
[6] gpt-4o-mini chat completion → 답변 + sources
   │
   ▼
[7] (user, assistant) 메시지 chat_messages 에 저장
```

**왜 채널 두 개인가** — 임베딩 검색만으로는 "작년 가을에 다녀온 곳", "가장 자주 간 카페" 같은 **시간·카테고리 한정 질문**에 약합니다. 그룹 일정 메타 200건을 함께 주입하면 LLM 이 의미 검색이 놓친 정답을 메타에서 보충할 수 있고, RAGAS 평가에서도 Faithfulness 와 Context Recall 이 크게 상승합니다(§5 참고).

**임베딩 무효화 자동화** — 메모 수정 시 클라이언트가 `memo_embedded_at = NULL` 처리하는 걸 잊을 위험을 없애기 위해, `reset_memo_embedding_on_change` DB 트리거가 `memo` 컬럼 변경을 감지해 자동 무효화. [embed-batch](supabase/functions/embed-batch/index.ts) 는 `memo_embedded_at IS NULL` 만 보면 됨.

---

## 4. 주요 기능

- **개인 캘린더 / 공유 캘린더** — 친구를 SC ID 로 추가해 달력방 생성, 일정 CRUD
- **AI 챗봇 (RAG)** — 우하단 FAB → 풀스크린 모달. 그룹 선택 후 자연어 질문, 출처 카드 표시
- **수동 임베딩 트리거** — 설정 탭의 "챗봇에게 내 일정 알려주기" 버튼이 [embed-batch](supabase/functions/embed-batch/index.ts) 호출 (cron 대신 사용자 JWT 기반 호출만 사용)
- **다크/라이트/크림 3종 테마**, 한국 공휴일 표시
- **PWA** — 아이폰 Safari "홈 화면에 추가" 로 풀스크린 앱처럼 동작

---

## 5. RAGAS 평가 (iter 3)

자세한 보고서: [docs/rag-extension/evaluation-report.md](docs/rag-extension/evaluation-report.md)

**평가 대상**: 합성 그룹 캘린더 "캠퍼스 친구들 (합성 데이터)" — 가상 사용자 3명 / 일정 80건 / 메모 60건
**Ground Truth**: 15문항 (사실 날짜·장소 6, 사실 인물·관계 3, 통계·패턴 3, 시간 한정 회상 3)
**평가 LLM**: `gpt-4o` (RAGAS evaluator), 생성 LLM 은 `gpt-4o-mini`

### 5.1 종합 결과

| 메트릭                         |      점수 |   목표 | 비고                                     |
| ------------------------------ | --------: | -----: | ---------------------------------------- |
| Faithfulness (사실 일치도)     | **0.864** | ≥ 0.85 | ✓ 목표 달성                              |
| Answer Relevancy               |     0.386 | ≥ 0.80 | RAGAS 한국어 측정 한계                   |
| **Answer Similarity** (임베딩) | **0.701** | ≥ 0.80 | Ans.Rel 측정 노이즈를 우회한 정직한 그림 |
| Context Precision              |     0.537 | ≥ 0.75 | 인물/관계·통계 질문이 끌어내림           |
| Context Recall                 | **0.760** | ≥ 0.80 | 근접                                     |

![radar](scripts/eval_outputs/ragas_radar.png)

### 5.2 카테고리별

![category](scripts/eval_outputs/ragas_by_category.png)

| 카테고리        | Faith. | Ans. Sim. | Ctx. Recall |
| --------------- | -----: | --------: | ----------: |
| 사실(날짜/장소) |  0.917 |     0.793 |       1.000 |
| 사실(인물/관계) |  0.667 |     0.604 |       0.333 |
| 통계/패턴       |  0.933 |     0.645 |       0.833 |
| 시간 한정 회상  |  0.889 |     0.669 |       0.635 |

**관측**:

- 단일 일정 응답(날짜/장소) 이 RAG 와 평가 양쪽 모두에 가장 잘 맞음
- 인물/관계 질문에서 검색이 약함 — "셋이 같이 등산 간 곳" 같은 추상 조건은 임베딩이 잘 못 잡음. `events.tags` 필터 + Hybrid Search(BM25) 가 다음 돌파구
- Answer Relevancy 카테고리별 편차(0.29~0.51) 와 달리 **Answer Similarity 는 4 카테고리 모두 0.60+** 로 일관 — Ans.Rel 의 변동 대부분이 측정 노이즈임을 시사

### 5.3 평가 환경 제약 (보고서에 명시)

`retrieved_contexts` 에는 chat-rag 의 **벡터 검색 top-8** 만 RAGAS 에 노출 (iter 3 부터 답변에 등장한 메타 일정도 augment). 메타 200건을 전부 넣으면 RAGAS 평가 LLM 토큰이 폭증해 비용·노이즈가 커짐. 이는 "벡터 검색만으로는 카테고리·시간 한정 질문에 약하다 → 메타 채널을 추가했다" 는 설계를 정량적으로 보여주는 자료가 됨.

---

## 6. 기술 스택

**프론트엔드**

- Expo SDK 54 + React Native 0.81 (네이티브/웹 공통)
- React Navigation v7 (`@react-navigation/native-stack`, `bottom-tabs`)
- `react-native-calendars`, AsyncStorage(로컬 세션)
- 디자인 토큰: [constants/theme.ts](constants/theme.ts) (`Colors` / `Spacing` / `Radius`)

**백엔드**

- Supabase Postgres + **pgvector** (HNSW index)
- Supabase Auth (Google OAuth + 이메일)
- **Supabase Edge Functions (Deno/TypeScript)** — `embed-batch`, `chat-rag`
- RLS 로 권한 격리 자동화 (`search_group_memories` 는 `SECURITY INVOKER`)

**LLM / 임베딩**

- OpenAI `text-embedding-3-small` (1536d)
- OpenAI `gpt-4o-mini` (챗봇 응답)

**평가 / 합성 데이터** (Python — `scripts/` 폴더 한정)

- RAGAS (Faithfulness, Answer Relevancy, Answer Similarity, Context Precision/Recall)
- 평가 LLM: OpenAI `gpt-4o`
- 의존성 관리: `uv` (또는 venv + pip)
- 시각화: matplotlib

**배포**

- Vercel — 웹 정적 호스팅, PWA
- Supabase Edge Function — Deno 런타임 (`supabase functions deploy ...`)

---

## 7. 디렉토리 구조

```
sc/
├── App.js                         # 진입점 — ThemeProvider + Navigation
├── index.js                       # 웹 PWA 메타 + service worker 등록
├── constants/theme.ts             # 디자인 토큰
│
├── src/
│   ├── components/                # Button, CalendarView, EventModal 등
│   ├── constants/                 # 한국 공휴일
│   ├── context/                   # ThemeContext (light/cream/dark 3종)
│   ├── lib/                       # supabaseClient, caseHelpers
│   ├── navigation/                # MainTabNavigator (4 탭)
│   ├── screens/                   # Login, Personal/SharedCalendar, Settings,
│   │                              # Chatbot (RAG 챗봇 UI)
│   └── services/                  # Auth/Friend/Group/User/Event/Chat Service
│
├── supabase/
│   ├── migrations/                # 9 개 SQL — 초기 스키마 + RAG 확장
│   │   ├── shared_calendar_initial_schema.sql
│   │   ├── rag_extension_schema.sql       # pgvector, chat_sessions, RPC
│   │   ├── event_memo_column.sql
│   │   └── ...
│   └── functions/                 # Edge Function (Deno/TS) — 배포 완료
│       ├── _shared/               # cors / openai / supabaseClient 유틸
│       ├── embed-batch/           # 메모 → 임베딩 일괄 생성
│       └── chat-rag/              # 챗봇 본체 (RAG 파이프라인)
│
├── scripts/                       # Python — 합성 데이터 + RAGAS 평가 전용
│   ├── seed_synthetic_data.py     # 가상 사용자 3명 + 일정 80건 + 메모 60건
│   ├── eval_ragas.py              # RAGAS 4 메트릭 + AnswerSimilarity 측정
│   ├── ground_truth.json          # 평가용 Q&A 15건
│   ├── eval_outputs/              # 결과 (CSV + 차트 PNG)
│   ├── pyproject.toml             # uv 의존성
│   └── README.md                  # 상세 사용법
│
├── docs/
│   ├── roadmap.md                 # ★ 작업 로드맵 (Phase 0~6)
│   ├── spec-sc.md                 # MVP 스펙
│   ├── retrospective.md           # MVP 회고
│   ├── ai-collaboration.md        # AI 협업 기록
│   ├── test-checklist.md          # 회귀 검증 체크리스트
│   └── rag-extension/             # 팀플 RAG 확장 문서
│       ├── project-plan.md        # 큰 그림
│       ├── db-design.md           # 스키마 설계 + RLS 정책
│       ├── idea-draft.md
│       └── evaluation-report.md   # RAGAS 평가 보고서 (iter 1→3)
│
├── public/                        # PWA (manifest, sw.js, 아이콘) → dist/ 루트로 복사
├── assets/                        # 앱 아이콘 원본 (icon.svg, google-logo)
└── ios/                           # Expo prebuild 결과물
```

---

## 8. 핵심 설계 결정 (재논의 X)

| 결정                                                                        | 이유                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 백엔드는 **Supabase Edge Function (TS/Deno)**                               | 호스팅 비용 0원, RLS 자동, 인증 코드 0줄. 별도 Python 백엔드 도입 X                         |
| Python 은 **RAGAS 평가 + 합성 데이터 스크립트에만** 사용                    | RAG 자체는 언어 독립, RAGAS만 Python 강제                                                   |
| DB 는 **Supabase Postgres + pgvector**, 별도 벡터 DB X                      | RLS 통합, 운영 복잡도 최소화                                                                |
| `service_role` 키는 **Python 스크립트에서만**                               | 클라이언트/Edge Function 절대 금지. `pg_cron` 패턴도 보류하고 사용자 JWT 수동 트리거만 사용 |
| 챗봇 검색은 **벡터(top-8) + 그룹 일정 메타(200건) 듀얼 채널**               | 시간·카테고리 한정 질문이 벡터 단독으로는 약함 (§3, §5 참조)                                |
| LLM 시스템 프롬프트에 **KST 오늘 날짜·요일 주입**                           | "LLM 은 '오늘' 을 모른다" 보정. "오늘 일정 알려줘" 가 동작하게 됨                           |
| 사진 기능은 **현재 보류**, 코멘트는 별도 테이블 대신 `memo` 컬럼으로 단순화 | MVP 범위 관리. 일정 1:1 메모만으로도 RAG 데모 충분                                          |
| 프론트는 React Native + Expo (.js)                                          | 신규 파일은 .ts 권장, 기존 .js 강제 변환 X                                                  |

자세한 배경은 [docs/roadmap.md §1](docs/roadmap.md) 참조.

---

## 9. 빠른 시작

### 9.1 앱 (Expo)

```bash
npm install                                    # 의존성 설치
# .env.local 작성:
#   EXPO_PUBLIC_SUPABASE_URL=...
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=...

npm run web         # 웹 (Expo Metro)
npm run ios         # iOS 시뮬레이터
npm run android     # Android
npm run lint
```

DB 스키마는 [supabase/migrations/](supabase/migrations/) 의 SQL 을 순서대로 적용.

### 9.2 Edge Function 배포

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy embed-batch chat-rag
```

### 9.3 RAGAS 평가 (Python)

`scripts/` 안에서:

```bash
# .env.local 에 SUPABASE_SERVICE_ROLE_KEY 추가 필요
uv sync                                        # 의존성
uv run python seed_synthetic_data.py --owner you@example.com
# 앱 설정 탭 → "챗봇에게 내 일정 알려주기" 로 임베딩 백필
uv sync --group ragas                          # ragas/langchain/matplotlib
uv run python eval_ragas.py
```

결과는 `scripts/eval_outputs/` 의 CSV + PNG. 상세 사용법은 [scripts/README.md](scripts/README.md).

### 9.4 웹 배포 (Vercel)

[vercel.json](vercel.json) 설정에 따라 자동 빌드. 로컬 빌드:

```bash
npx expo export --platform web    # dist/ 생성
```

[public/](public/) 의 PWA 파일은 빌드 시 `dist/` 루트로 자동 복사. Supabase 환경 변수는 Vercel 프로젝트 설정에 동일 등록 필요.

### 9.5 PWA 아이콘 재생성

[assets/icon.svg](assets/icon.svg) 수정 후:

```bash
rsvg-convert -w 192 -h 192 assets/icon.svg -o public/icon-192.png && \
rsvg-convert -w 512 -h 512 assets/icon.svg -o public/icon-512.png && \
rsvg-convert -w 180 -h 180 assets/icon.svg -o public/apple-touch-icon.png
```

iOS Safari: 배포된 사이트 접속 → 공유 → "홈 화면에 추가" → 풀스크린 앱.

---

## 10. 더 읽을거리

| 문서                                                                               | 내용                                               |
| ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| [docs/roadmap.md](docs/roadmap.md)                                                 | Phase 0~6 작업 로드맵 + 학습/실험 메모             |
| [docs/rag-extension/project-plan.md](docs/rag-extension/project-plan.md)           | RAG 확장 큰 그림                                   |
| [docs/rag-extension/db-design.md](docs/rag-extension/db-design.md)                 | 스키마 설계, RLS 정책, `search_group_memories` RPC |
| [docs/rag-extension/evaluation-report.md](docs/rag-extension/evaluation-report.md) | RAGAS 평가 보고서 (iter 1 → iter 3 비교)           |
| [scripts/README.md](scripts/README.md)                                             | 합성 데이터 시드 + RAGAS 평가 상세 사용법          |
| [docs/spec-sc.md](docs/spec-sc.md)                                                 | MVP 스펙 (기능 명세)                               |
| [docs/retrospective.md](docs/retrospective.md)                                     | MVP 회고                                           |
