# SC 작업 로드맵

> 작성일: 2026-05-15
> 현재 위치: **Phase 0 완료 (MVP 정리됨)**
> 다음 작업: **Phase 1 (디자인 토큰)**
>
> 이 문서는 살아있는 계획서입니다. 각 Phase 완료 시 체크 + 학습 내용 메모.

---

## 0. 현재 상태 (2026-05-15 기준)

### 완료
- [x] MVP 기능 구현 (로그인, 친구, 일정 CRUD, 공유 달력방, 다크모드)
- [x] 코드 정리 (미사용 service 메서드 8개 제거, 미사용 deps 11개 제거)
- [x] 디자인 토큰 슬림화 ([constants/theme.ts](../constants/theme.ts))
- [x] 문서 동기화 ([docs/spec-sc.md](spec-sc.md))
- [x] 팀플 문서 3종 ([rag-extension/](rag-extension/))

### 작동 중인 것
- Vercel 웹 배포 ([README.md](../README.md) 참조)
- Supabase Auth + Postgres + RLS (스키마: [supabase/migrations/](../supabase/migrations/))
- iOS/Android Expo Go

### 다음 작업 가능한 트랙
| 트랙 | 우선순위 | 이유 |
|------|---------|------|
| **A. 개인 프로젝트 진화** | 중 | 시간 여유 있음 |
| **B. 팀플 RAG 챗봇** | 높음 (데드라인 있음) | 발표 시점에 맞춰 |

두 트랙은 Phase 2(DB 스키마)부터 공통 작업이 많아, **순차 진행 권장**.

---

## 1. 핵심 결정 (변경하지 말 것)

새 세션에서 이 결정을 다시 논의하지 않도록 박제.

| 결정 | 이유 |
|------|------|
| **백엔드는 Supabase Edge Function (TS/Deno)** | 호스팅 비용 0원, RLS 자동, 인증 코드 0줄 |
| **Python은 RAGAS 평가 + 합성 데이터/백필 스크립트에만 사용** | RAG 자체는 언어 독립, RAGAS만 Python 강제 |
| **DB는 Supabase Postgres 유지 + pgvector 추가** | 별도 벡터 DB 도입 안 함, RLS 통합 |
| **프론트는 RN + Expo (.js) 유지** | 신규 파일은 .ts 권장이지만 기존 .js는 강제 변환 안 함 |
| **사진 캡션은 Vision API로 자동 생성 (업로드 시 1회)** | 검색 가능한 텍스트 확보 + 비용 캐시 |
| **챗봇 메모리는 `chat_messages` 테이블 기반** | 별도 메모리 DB 안 씀 |
| **컨셉: "일정 공유 + 추억 기록"** | 커플/가족/친구 대상 |

> 위 결정에 의문이 생기면 [docs/rag-extension/](rag-extension/) 또는 메모리 참조.

---

## 2. Phase별 상세 계획

### Phase 1: 디자인 토큰 교체

**목적**: 폰트·아이콘·색 팔레트 갱신. 이후 모든 신규 UI가 새 토큰으로 작성되도록.

**선행 조건**: 없음 (지금 바로 시작 가능)

**예상 기간**: 1~2일

#### 결정해야 할 것 (작업 시작 전 사용자에게 확인)
- [ ] 폰트 선택 (Pretendard / SUIT / 시스템 폰트)
- [ ] 아이콘 라이브러리 (Lucide / Phosphor / MaterialIcons 유지)
- [ ] 메인 색상 변경 여부 (현재 `#395fa5ff` 파란색)

#### 작업 항목
- [ ] `expo-font` 의존성 재추가 (정리 때 제거됐음)
- [ ] 폰트 파일 [assets/fonts/](../assets/fonts/) 배치
- [ ] [App.js](../App.js)에서 `useFonts()` 호출
- [ ] 아이콘 라이브러리 교체 (선택 시) — 전체 화면에서 `MaterialIcons` 사용처 grep으로 일괄 변경
- [ ] [constants/theme.ts](../constants/theme.ts) 색·spacing 갱신
- [ ] [src/components/Button.js](../src/components/Button.js) 새 토큰 적용 확인
- [ ] 모든 화면을 빠르게 훑어 시각적 회귀 확인

#### 영향 받는 파일
```
constants/theme.ts                     ← 핵심
src/components/Button.js               ← 자동 반영
src/components/CalendarView.js         ← 색만 수정
src/components/EventModal.js           ← 색만 수정
src/screens/*.js                       ← 폰트는 자동, 아이콘은 일괄 교체
package.json                           ← expo-font 추가
App.js                                 ← useFonts() 추가
```

#### 완료 기준 (DoD)
- 새 토큰이 모든 화면에 적용됨
- `npm run lint` 통과
- `npm run web`으로 모든 화면 확인 (회귀 없음)
- 다크/라이트 모드 둘 다 작동

#### Claude 작업 시 주의
- `MaterialIcons` 일괄 교체할 때는 아이콘 이름 매핑이 다름 (`add` → `Plus`, `delete` → `Trash` 등). 한 번에 전부 바꾸지 말고 화면별로 확인하며 진행.
- 폰트 로딩 실패 시 fallback 처리 잊지 말 것.

---

### Phase 2: DB 스키마 확장 + RLS

**목적**: 사진·코멘트·챗봇·임베딩에 필요한 테이블을 한 번에 추가. 이후 백엔드/프론트 작업의 기반.

**선행 조건**: Phase 1 무관 (병렬 가능). 단, Supabase 대시보드 접근 권한 필요.

**예상 기간**: 0.5~1일

#### 결정해야 할 것
- [ ] 폴리모픽 vs 분리 (계획서에는 폴리모픽으로 결정됨, 그대로 진행)
- [ ] `event_summaries` 테이블 포함 여부 (월별 LLM 요약 — 옵션)

#### 작업 항목
- [ ] [supabase/migrations/rag_extension_schema.sql](../supabase/migrations/) 작성
  - `event_photos`, `event_comments`, `chat_sessions`, `chat_messages`
  - pgvector extension 활성화
  - HNSW 인덱스
  - RLS 정책 (DB 설계 문서 §5 참조)
- [ ] Supabase Dashboard에서 SQL 실행
- [ ] Storage 버킷 `event-photos` 생성 + 폴더 구조 (`{user_id}/`)
- [ ] Storage RLS 정책 설정
- [ ] Realtime publication 추가

#### 영향 받는 파일
```
supabase/migrations/rag_extension_schema.sql    ← 신규
```

#### 완료 기준
- 신규 5개 테이블이 Supabase에 존재
- pgvector extension 활성화 확인 (`select * from pg_extension where extname='vector';`)
- 본인 계정으로 SELECT 시 RLS 작동 확인 (다른 사용자 데이터 안 보임)
- Storage 버킷에 테스트 사진 업로드/조회 가능

#### Claude 작업 시 주의
- SQL은 한 번에 적용하지 말고 트랜잭션 단위로 나눠 실행 후 검증.
- RLS 정책은 작성 직후 반드시 다른 사용자 계정으로 테스트 (대시보드의 "Impersonate user" 활용).
- 기존 MVP 마이그레이션을 수정하면 안 됨 — 항상 새 파일로 추가.

---

### Phase 3: 사진/코멘트 기능 (RN 앱)

**목적**: 개인/공유 일정에 사진 업로드 + 코멘트 작성 UI. 추억 기록 컨셉의 핵심.

**선행 조건**: Phase 2 완료

**예상 기간**: 3~5일

#### 결정해야 할 것
- [ ] 사진 압축 비율 (Storage 용량 관리)
- [ ] 한 일정에 사진 몇 장까지 (UI 제약)
- [ ] 코멘트 길이 제한 (예: 500자)

#### 작업 항목
- [ ] 의존성 추가
  - `expo-image-picker`
  - `expo-image-manipulator`
  - `expo-image`
- [ ] 신규 서비스 레이어
  - [src/services/PhotoService.js](../src/services/) — 업로드/조회/삭제
  - [src/services/CommentService.js](../src/services/) — CRUD + 실시간 구독
- [ ] 신규 화면
  - `src/screens/EventDetailScreen.js` — 일정 상세 + 사진 갤러리 + 코멘트 스레드
- [ ] 기존 화면 수정
  - [src/components/CalendarView.js](../src/components/CalendarView.js) — 일정 카드 탭 → 상세 화면 네비게이션
  - [src/screens/PersonalCalendarScreen.js](../src/screens/), [src/screens/SharedCalendarScreen.js](../src/screens/) — Stack Navigator 추가
- [ ] 사진 캡션 자동 생성 호출 (Edge Function `caption` — Phase 4와 같이 진행)

#### 영향 받는 파일
```
package.json                                   ← 의존성 3개 추가
src/services/PhotoService.js                   ← 신규
src/services/CommentService.js                 ← 신규
src/screens/EventDetailScreen.js               ← 신규
src/navigation/MainTabNavigator.js             ← Stack 추가
src/components/CalendarView.js                 ← onPress 수정
```

#### 완료 기준
- 사진을 갤러리/카메라에서 선택 → Storage 업로드 → 일정 상세에 표시
- 코멘트 작성 → 다른 멤버 화면에 실시간 반영
- 권한 격리 확인 (다른 그룹 사진/코멘트 안 보임)
- 다크/라이트 모드에서 모두 정상

#### Claude 작업 시 주의
- 사진 업로드는 web과 native 분기 필요 (`Platform.OS === 'web'`).
- 업로드 전 `expo-image-manipulator`로 reseize (긴 변 1600px 정도) → Storage 비용 절약.
- 사진 URL은 signed URL 사용 (RLS 적용된 private 버킷이라).

---

### Phase 4: RAG 백엔드 (Edge Function)

**목적**: 임베딩 생성 + 챗봇 검색·응답 API. 팀플의 핵심 기술 기능.

**선행 조건**: Phase 2 완료 (스키마 필요)

**예상 기간**: 3~5일

#### 결정해야 할 것
- [ ] LLM 선택: Claude Haiku 4.5 vs GPT-4o-mini
- [ ] Embedding 모델: OpenAI text-embedding-3-small vs BGE-Korean
- [ ] Vision 모델 (캡션용): Claude Sonnet Vision vs GPT-4o Vision
- [ ] Rate limit 정책 (사용자당 일 N회)

#### 작업 항목
- [ ] 환경변수 추가 ([.env.local](../.env.local), Supabase Edge Function secrets)
  - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- [ ] Edge Function 작성
  - `supabase/functions/embed/index.ts` — 텍스트 → 임베딩 → DB 저장
  - `supabase/functions/caption/index.ts` — 사진 → Vision API → caption + 임베딩 저장
  - `supabase/functions/chat-rag/index.ts` — 챗봇 메인 (검색 + Memory + 생성)
- [ ] DB Trigger 설정
  - `event_comments` insert/update → `embed` 호출
  - `event_photos` insert → `caption` 호출
- [ ] SQL 함수 (`search_memories`) — DB 설계 문서 §8 참조
- [ ] Edge Function 배포 + 동작 테스트

#### 영향 받는 파일
```
supabase/functions/embed/index.ts              ← 신규
supabase/functions/caption/index.ts            ← 신규
supabase/functions/chat-rag/index.ts           ← 신규
supabase/migrations/search_memories_rpc.sql    ← 신규
.env.local                                     ← 키 추가
```

#### 완료 기준
- 코멘트 작성 → 1~2초 내 `text_embedding` 채워짐
- 사진 업로드 → 5~10초 내 `caption` + `caption_embedding` 채워짐
- `curl`로 `chat-rag` 호출 → 한국어 응답 정상
- 응답에 `retrieved_chunks` 포함 (출처 추적 가능)
- 권한 격리 확인 (타 사용자 데이터 검색 결과에 안 섞임)

#### Claude 작업 시 주의
- Edge Function은 Deno 런타임. `import` 경로가 Node와 다름 (`npm:` 또는 URL import).
- API 키는 절대 코드에 하드코딩 금지. `Deno.env.get("KEY")` 사용.
- 사용자 인증은 요청 헤더의 `Authorization: Bearer <jwt>` 로 받아서 `supabase.auth.getUser(jwt)` 검증.
- RLS를 활용하려면 user JWT로 Supabase 클라이언트 생성 (service_role 금지).

---

### Phase 5: 챗봇 UI + 합성 데이터

**목적**: RN 앱에 챗봇 화면 추가 + 발표 데모용 합성 데이터.

**선행 조건**: Phase 4 완료 (API 필요)

**예상 기간**: 3~4일

#### 작업 항목 (UI)
- [ ] 신규 화면 `src/screens/ChatbotScreen.js`
  - 메시지 리스트 (user/assistant 구분)
  - 입력창 + 전송 버튼
  - 응답의 `retrieved_chunks`를 출처 카드로 표시
  - 카드 탭 → 해당 일정 상세로 이동
- [ ] 신규 서비스 `src/services/ChatService.js`
  - 세션 생성/조회/삭제
  - Edge Function 호출
- [ ] [src/navigation/MainTabNavigator.js](../src/navigation/MainTabNavigator.js) 에 챗봇 탭 추가 (4번째 탭)
- [ ] 검색 범위 선택 UI (내 데이터 / ○○ 그룹)

#### 작업 항목 (합성 데이터 — Python)
- [ ] `scripts/pyproject.toml` 생성 (uv 또는 poetry)
- [ ] `scripts/seed_synthetic_data.py`
  - 가상 사용자 3명 생성
  - 2년치 일정 300개 INSERT
  - LLM으로 자연스러운 코멘트 300개 생성
  - Unsplash로 사진 80장 다운로드 → Storage 업로드
- [ ] `scripts/backfill_embeddings.py` — 합성 데이터에 임베딩 일괄 생성

#### 영향 받는 파일
```
src/screens/ChatbotScreen.js                   ← 신규
src/services/ChatService.js                    ← 신규
src/navigation/MainTabNavigator.js             ← 탭 추가
scripts/pyproject.toml                         ← 신규
scripts/seed_synthetic_data.py                 ← 신규
scripts/backfill_embeddings.py                 ← 신규
```

#### 완료 기준
- 챗봇 화면에서 "벚꽃 본 게 언제였지?" 같은 질문 → 합성 데이터 기반 답변
- 응답에 출처 카드 1~3개 표시
- 출처 카드 탭 → 해당 일정 상세로 이동
- 합성 데이터가 RLS로 정상 격리됨 (가상 사용자 A 데이터는 가상 사용자 B에게 안 보임)

#### Claude 작업 시 주의
- Python 스크립트는 `scripts/` 폴더에서만 작성. RN 앱 코드에 Python 침투 금지.
- Python에서 Supabase 접근 시 `SUPABASE_SERVICE_ROLE_KEY` 사용 가능 (RLS 우회). 단, **절대 .env.local 외에 노출 금지**.
- 합성 데이터는 별도 가상 계정으로 만들어, 실제 사용자 데이터와 섞이지 않도록.

---

### Phase 6: RAGAS 평가 + 발표 준비

**목적**: 정량 평가 + 발표 자료. 팀플 마무리.

**선행 조건**: Phase 5 완료 (챗봇 동작)

**예상 기간**: 3~5일

#### 작업 항목
- [ ] `scripts/ground_truth.json` — 평가용 Q&A 15개 (DB 설계 문서 §9 참조)
- [ ] `scripts/eval_ragas.py`
  - Ground Truth 로드
  - 각 질문을 `chat-rag` Edge Function에 던지기
  - RAGAS로 메트릭 측정
  - 비교군 3개 (Baseline / RAG Basic / RAG Advanced)
  - CSV/PDF 리포트 생성
- [ ] (선택) `scripts/streamlit_app.py` — 데모 시각화
- [ ] 평가 보고서 작성 (docs/rag-extension/evaluation-report.md)
- [ ] 발표 PPT 작성 (별도 도구)
- [ ] 데모 영상 녹화 (3~5분)
- [ ] (가점) 논문 초안

#### 완료 기준
- RAGAS 메트릭 4종 모두 측정됨 (Faithfulness, Answer Relevancy, Context Precision/Recall)
- 비교군 결과 정량 비교 표 완성
- README에 실행 방법 추가
- Github 레포가 깔끔히 정리됨 (불필요한 파일 없음)

#### Claude 작업 시 주의
- RAGAS는 LLM을 평가용으로도 호출하므로 API 비용 발생 (테스트당 약 $0.5~1). 미리 작은 샘플로 검증 후 전체 실행.
- 평가 결과가 낮으면 즉시 좌절하지 말고 원인 분석 (검색 정확도? 프롬프트? LLM 모델?).
- 발표 자료에는 "RAG vs 순수 LLM 비교"를 핵심으로 배치 (요구사항에 명시됨).

---

## 3. 새 세션에서 Claude가 작업 시작할 때

### 매번 확인할 것
1. 본 문서 (`docs/roadmap.md`) — 현재 Phase 확인
2. [docs/rag-extension/project-plan.md](rag-extension/project-plan.md) — 큰 그림
3. [docs/rag-extension/db-design.md](rag-extension/db-design.md) — 스키마 참조
4. 메모리 폴더 — 사용자 컨텍스트
5. `git status` + `git log -5` — 최근 변경사항

### 작업 전 사용자에게 묻기
- Phase의 "결정해야 할 것" 항목
- 큰 디자인 변경 (색 팔레트, 화면 구조)
- 새 패키지 추가 (의존성 늘어남)
- Supabase 대시보드 작업 (사용자가 직접 해야 함)

### 묻지 않고 해도 되는 것
- Phase 작업 항목에 명시된 코드 작성
- 코드 정리/리팩터링 (기존 동작 유지하는 한)
- 테스트 추가
- 주석 추가/정리
- Lint 에러 수정

### 절대 하지 말 것
- 핵심 결정 (§1) 다시 논의하기
- 기존 마이그레이션 SQL 수정
- `npm install` 임의 실행 (사용자가 직접)
- 환경변수를 코드에 하드코딩
- `service_role` 키를 클라이언트 또는 Edge Function에서 사용

---

## 4. 진행 추적

각 Phase 완료 시 본 섹션을 갱신.

| Phase | 상태 | 완료일 | 메모 |
|-------|------|--------|------|
| 0. MVP 정리 | 완료 | 2026-05-15 | |
| 1. 디자인 토큰 | 미시작 | - | |
| 2. DB 스키마 | 미시작 | - | |
| 3. 사진/코멘트 UI | 미시작 | - | |
| 4. RAG 백엔드 | 미시작 | - | |
| 5. 챗봇 UI + 합성데이터 | 미시작 | - | |
| 6. RAGAS 평가 + 발표 | 미시작 | - | |

---

## 5. 학습/실험 메모

각 Phase 작업 중 알게 된 것을 여기에 추가. 추후 발표 자료 정리 시 활용.

(비어있음 — Phase 1 시작 후 채워나갈 것)

---

## 6. 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-05-15 | 최초 작성 (Phase 0 직후) |
