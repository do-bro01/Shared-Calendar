# SC — AI 협업 기록

> 작성일: 2026-05-07
> 대상 프로젝트: SC (공유 캘린더 앱)
> 사용 도구: Claude Code (Anthropic), 기타 LLM 기반 IDE 어시스턴트

> 📝 **메모**: 본 문서의 프롬프트/대화 예시는 실제 협업 흐름을 회상하여 정리한 것으로, 일부는 의역되거나 요약되었음. 이 프로젝트는 **과거에 시도하다가 중단했던 개인 프로젝트**를, 이번 과제를 계기로 AI 협업을 통해 재개·완성한 사례임.

---

## 1. AI 활용 전략

### 1.1 역할 분담
| 단계 | 사람의 역할 | AI의 역할 |
|------|------------|-----------|
| 기획 | 문제 정의, 타겟 사용자 결정, UX 우선순위 | 질문을 통한 구체화, 빠진 케이스 지적 |
| 데이터 모델 | 도메인 의도 전달 ("친구는 양방향이고…") | 스키마 초안, 인덱스 제안, 정규화/비정규화 트레이드오프 설명 |
| 구현 | 컴포넌트 분리·UI 의사결정 | 보일러플레이트, Supabase API 호출 패턴 |
| 디버깅 | 증상 관찰·재현 | 가설 제시, 원인 추정, 수정안 제안 |
| 보안(RLS) | 어떤 권한이 있어야 하는지 명세 | 정책 SQL 작성, 엣지 케이스(WITH CHECK 등) 지적 |
| 검증 | 직접 클릭/시나리오 테스트 | 테스트 케이스 누락 점검 |

핵심 원칙: **"AI가 만든 코드는 반드시 사람이 검증한다"**. 특히 RLS 정책과 cascade 삭제처럼 잘못 작성하면 **권한 우회/데이터 유실**로 직결되는 부분은 Supabase 대시보드에서 SQL 실행 결과를 직접 눈으로 확인했다.

### 1.2 좋은 프롬프트의 조건 (이번 프로젝트에서 체득한 것)
- **현재 상태**(에러 메시지 그대로, 관련 코드)와 **원하는 상태**(기대하는 동작)를 같이 적기
- "이거 왜 안 돼?"보다 "X가 의도인데 Y가 일어남, 원인 추정과 해결책 알려줘"
- AI에게 **먼저 질문하게 하는 것**이 종종 더 정확한 답으로 이어짐
- 대안을 1개가 아니라 2~3개 요청하면 **트레이드오프**를 알 수 있음

---

## 2. 핵심 협업 사례

### 사례 1: 달력방 "나가기" 시 RLS WITH CHECK 위반 ⭐ (가장 까다로웠던 디버깅)

**증상**
- 사용자가 자신을 `group_calendars.members`에서 제거하려고 하면 RLS가 거부.
- USING 절은 통과하는데(현재 멤버니까) "new row violates row-level security" 에러 발생.

**프롬프트 (요지)**
> "Supabase에서 group_calendars 테이블의 members 배열에서 자기 자신을 제거하려고 하는데, RLS가 막아. 정책은 `for update using (auth.uid() = any(members))`로 되어 있어. 멤버일 때만 수정 가능해야 하는 건 맞는데, 자기 제거가 안 되는 이유와 해결책 2가지 알려줘."

**AI 답변 요약**
- USING 절은 **수정 전 행**과 **수정 후 행** 모두에 적용된다(Postgres RLS 동작). WITH CHECK를 명시하지 않으면 USING이 그대로 새 행에도 적용되어, 자기를 빼면 "새 행에서 자기가 멤버가 아니므로" USING 실패.
- **해결책 A**: `with check (true)`를 추가해서 새 행 조건을 완화.
- **해결책 B**: `SECURITY DEFINER` 함수(RPC)를 만들어 RLS를 우회하되 함수 내부에서 직접 권한 검사.

**선택과 결과**
B를 선택. RLS를 너무 느슨하게 하면 **다른 멤버를 강제로 빼는 공격 벡터**가 생길 위험이 있어서. 결과물: [supabase/migrations/leave_group_calendar_rpc.sql](supabase/migrations/leave_group_calendar_rpc.sql) — 함수 내부에서 `auth.uid()` 검증 + `array_remove`. 클라이언트에서는 [src/services/GroupCalendarService.js:204-211](src/services/GroupCalendarService.js#L204-L211)에서 본인 제거일 때만 RPC 분기.

**검증**
- A 멤버가 본인 나가기 → 성공. B 멤버 변동 없음 (Supabase 대시보드 SQL로 직접 확인).
- A가 다른 멤버 B를 RPC로 강제 제거 시도 → "권한이 없습니다" (RPC 내부 분기에서 차단).

> 이 사례는 **AI에게 RLS 동작을 한 번 더 설명해달라고 요청**했다. 처음 답변은 WITH CHECK만 권유했는데 보안 우려가 있어서 다시 물어보니 RPC 옵션을 알려줬다.

---

### 사례 2: 양방향 일정 연결의 cascade 삭제 무한 루프

**증상**
- 개인 일정과 그룹 일정을 연결한 상태에서 한쪽을 삭제하면, cascade 로직이 반대쪽을 또 삭제하려 들면서 의도치 않은 호출 또는 무한 루프 가능성.

**프롬프트 (요지)**
> "personal_events.linked_group_event_ids는 배열(1:N), group_events.linked_personal_event_id는 단일(N:1). 한쪽 삭제 시 반대쪽도 자동 삭제하고 싶은데, 서로 cascade를 부르면 무한 루프가 될 것 같음. 가장 간단한 패턴 알려줘."

**AI 답변 요약**
- `skipCascade: boolean = false` 인자를 추가해서, **반대쪽 삭제 호출 시에는 `skipCascade=true`**로 넘긴다.
- 이렇게 하면 첫 호출만 cascade 로직을 타고, 다음 호출은 자기 행만 지운다.

**선택과 결과**
적용 위치:
- [src/services/PersonalEventService.js:96-137](src/services/PersonalEventService.js#L96-L137) `deletePersonalEvent(eventId, skipCascade=false)`
- [src/services/GroupEventService.js:139-181](src/services/GroupEventService.js#L139-L181) `deleteGroupEvent(eventId, skipCascade=false)`

**검증**
- 연결된 일정 한쪽 삭제 → 반대쪽도 정확히 1번 삭제됨 (Supabase 로그 확인).
- 한 개인 일정이 여러 그룹 방에 연결된 경우 → 모든 그룹 일정이 삭제됨.

---

### 사례 3: SC ID(6자리 친구 코드) 설계

**문제 의식**
- 친구 추가에 이메일/전화번호를 쓰고 싶지 않음 (개인정보 노출 + 검색 가능성).
- Supabase Auth UID는 36자리 UUID라 사람이 외우거나 공유하기 불가능.

**프롬프트 (요지)**
> "친구 추가용으로 사람이 공유하기 쉬운 짧은 코드를 만들고 싶어. 충돌 위험과 무차별 검색 위험을 최소화하면서, 6자리 정도가 적당할까? 영숫자로 했을 때 경우의 수 계산해줘."

**AI 답변 요약**
- 영문 대문자 + 숫자 (혼동 문자 제외 시 32자리 알파벳) → 32^6 ≈ 10억. 사용자가 1만 명까지 늘어도 무작위 충돌 확률은 매우 낮음.
- 발급 시 `users.sc_id` UNIQUE 제약 + 충돌 시 재시도.
- 무차별 검색 방지를 위해 별도 rate limit 권장 (현재는 미적용).

**선택과 결과**
[supabase/migrations/shared_calendar_initial_schema.sql:14-18](supabase/migrations/shared_calendar_initial_schema.sql#L14-L18) — `sc_id varchar(6) not null unique`. 최종적으로 OAuth 로그인 시 사용자 프로필 자동 생성에서 SC ID 발급 로직 통합.

**미해결**
- Rate limit (Open Question으로 PRD에 기록).

---

### 사례 4: "혼자 남았을 때만 방 삭제" 정책 변경

**기획자 의사결정**
- 처음에는 "생성자만 삭제 가능"이었으나, **생성자가 먼저 나간 경우 방이 영원히 안 지워지는 문제** 발견.
- 정책을 "마지막 멤버가 자기 자신일 때만 삭제"로 변경.

**프롬프트 (요지)**
> "group_calendars 삭제 정책을 '생성자만'에서 '마지막 한 명이 남았을 때만'으로 바꾸고 싶어. RLS for delete using 절을 어떻게 써야 해?"

**AI 답변 요약**
```sql
for delete using (
  auth.uid() = any(members)
  and coalesce(array_length(members, 1), 0) = 1
);
```
- `array_length`가 빈 배열에서 NULL을 반환하므로 `coalesce`로 0 처리.

**결과**
[supabase/migrations/group_calendars_delete_when_alone.sql](supabase/migrations/group_calendars_delete_when_alone.sql).

---

### 사례 5: OAuth 리다이렉트의 웹/모바일 분기

**문제**
- Expo + Supabase OAuth는 웹에서는 그냥 `redirectTo` URL로 리다이렉트가 잘 동작하지만, 모바일(Expo Go)에서는 `expo-web-browser`로 인앱 브라우저를 띄우고 별도로 코드 교환을 해야 함.

**프롬프트 (요지)**
> "Expo + Supabase Google OAuth, 웹과 iOS에서 모두 동작하는 단일 함수 만들어줘. iOS는 expo-web-browser를 써야 한다고 들었는데."

**AI 답변 요약**
- `Platform.OS === 'web'` 분기.
- 모바일은 `signInWithOAuth({ skipBrowserRedirect: true })` → `WebBrowser.openAuthSessionAsync` → URL의 `code` 파싱 → `exchangeCodeForSession`.

**결과**
[src/services/AuthService.js:16-51](src/services/AuthService.js#L16-L51).

**검증**
- 웹: 정상.
- iOS Expo Go: 정상.
- Android Expo Go: 정상.

---

## 3. AI에게 질문하게 한 사례 (과제에서 강조한 부분)

기능 명세를 처음부터 다 적어주는 대신, **AI가 빠진 부분을 먼저 질문하도록** 유도했다. 그 결과 미처 생각하지 못한 케이스가 드러났다.

### 사례 A: 친구 모델 설계
- **사용자 입력**: "친구 기능을 만들고 싶어."
- **AI의 역질문**:
  - "친구 추가는 양방향 즉시 등록인가요, 요청-수락 모델인가요?"
  - "친구 삭제는 한쪽이 일방적으로 끊을 수 있나요?"
  - "친구 관계의 ID는 양쪽에서 같은 레코드를 가리켜야 하나요?"
- **결과**: 즉시 등록 모델로 결정 (MVP 단순화). 양쪽 ID 정렬 → 결합 키 패턴 도입 (`{sorted_uid1}_{sorted_uid2}`).

### 사례 B: 달력방 멤버 표현 방식
- **사용자 입력**: "달력방에 멤버 여러 명 넣을 수 있어야 해."
- **AI의 역질문**:
  - "멤버 수가 보통 얼마나 되나요? (10명? 100명?)"
  - "별도 `group_members` 조인 테이블로 정규화할지, `members UUID[]` 배열로 비정규화할지 트레이드오프를 보고 결정할까요?"
- **결과**: 친한 관계 그룹은 보통 2~6명. 배열 비정규화 + GIN 인덱스 채택. 쿼리 한 번에 가입한 방 목록을 가져올 수 있음.

### 사례 C: 일정 연결 방향성
- **사용자 입력**: "개인 일정과 그룹 일정 연결되게 하고 싶어."
- **AI의 역질문**:
  - "한 개인 일정이 여러 그룹에 동시에 등록될 수 있나요?"
  - "그룹 일정 한 개가 여러 사람의 개인 일정과 연결될 수 있나요?"
  - "수정도 양방향 동기화할까요, 삭제만 cascade 할까요?"
- **결과**: 1:N(개인→그룹) 모델. 수정은 동기화 안 함(독립). 삭제만 cascade. 무한 루프 방지를 위한 `skipCascade` 패턴 도입.

---

## 4. AI가 틀렸거나 수정이 필요했던 사례 ⚠️

### 케이스 ①: 보안 우선순위가 사람과 달랐음
**RLS WITH CHECK 사례 1**에서 AI가 처음 추천한 해결책은 "WITH CHECK를 `true`로 둔다"였는데, 이 경우 **다른 멤버를 강제로 제거하는 우회 경로**가 생긴다. 사람이 "보안 우려 있음, 다른 방법 알려줘"라고 다시 요청해서 RPC 패턴으로 수정.

→ **교훈**: AI는 "동작하게 만드는" 답을 우선 줌. 보안/엣지 케이스는 사람이 명시적으로 묻지 않으면 빠질 수 있음.

### 케이스 ②: 메서드 시그니처 일관성
초반에 AI가 만든 서비스 메서드들이 어떤 건 `({ a, b })`를, 어떤 건 `(a, b)`를 받아서 호출 코드가 지저분해졌다. 사람이 "전부 객체 인자로 통일해줘"라고 리팩터링 요청.

→ **교훈**: 컨벤션은 처음 설정할 때 명시해야 함.

### 케이스 ③: Realtime 구독 cleanup 누락
첫 구현에서 `useEffect` cleanup으로 `removeChannel`을 빠뜨리는 경우가 있었음. 화면 전환 시 채널 leak 발생.

→ **수정**: 모든 listener에서 `return () => supabase.removeChannel(channel)` 패턴 강제.

### 케이스 ④: 한국어 변수명/주석 일관성
일부 컴포넌트에서 영문 주석과 한글 주석이 섞여 있었음. 사람이 한글 위주로 통일 요청.

---

## 5. 회고

### 가장 도움이 컸던 영역
1. **RLS 정책 작성** — Postgres RLS는 학습곡선이 가파른데 AI가 정책을 빠르게 초안 잡아주고, 엣지 케이스(WITH CHECK 등)를 짚어줌.
2. **Supabase + Expo 통합 보일러플레이트** — OAuth 웹/모바일 분기 같은 Cross-platform 패턴.
3. **데이터 모델링 트레이드오프** — 정규화 vs 비정규화 같은 결정을 빠르게 비교.

### AI 없이는 어려웠을 부분
- 과거에 이 프로젝트를 시도했을 때는 **배포·SQL/DB·서비스화 자체에 대한 개념이 없어서** 로컬 데모 수준에서 멈췄다. 이번에 AI와 협업하면서 "기능 → 데이터 → 권한(RLS) → 동기화(Realtime) → 배포(Vercel)"가 하나의 흐름으로 묶이는 걸 처음으로 끝까지 경험했다.
- 특히 RLS 정책과 Supabase OAuth의 모바일 분기처럼 학습곡선이 가파른 영역은 AI 협업으로 1시간 안에 해결됐다.
- "혼자 남았을 때만 삭제" 같은 **상태 의존 RLS 정책**도 혼자였다면 며칠 헤맸을 부분.
- **모바일 우선 설계** — 최종 사용 환경이 모바일이라 화면 크기·터치 영역·스크롤 동작을 처음부터 모바일 기준으로 결정해야 했다. AI가 `react-native-web`, `react-native-safe-area-context`, 네이티브 datetimepicker 같은 모바일 친화 컴포넌트들을 빠르게 제안해줘서 한 코드베이스로 웹/iOS/Android를 동시에 커버할 수 있었다.

### 사람의 역할이 줄지 않은 영역
- **무엇을 만들지** (기획) — AI는 "어떻게"는 잘하지만 "무엇을, 왜"는 사람이 결정.
- **검증** — Supabase 대시보드에서 직접 SQL을 돌려보고, 두 기기에서 실시간 동기화를 눈으로 확인하는 등 사람의 손/눈 검증은 대체 불가.
- **보안/UX 트레이드오프 결정** — AI는 옵션을 주지만, "어느 쪽이 우리 사용자에게 맞나"는 사람이 골라야 함.

---

## 6. 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|---------|
| 2026-05-07 | v1.0 | 최초 작성 |
