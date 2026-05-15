# SC (Shared Calendar) 스펙 문서 (PRD)

> 작성일: 2026-05-07
> 버전: v1.0
> 기반 문서: 본 프로젝트는 `/ideate`/`/tech-stack` 단계 없이 구현이 선행되었으며, 본 문서는 코드베이스와 기획자 인터뷰를 바탕으로 역으로 정리한 PRD임.

---

## 1. 프로젝트 개요

### 목적
**SC**는 친한 관계(연인, 팀 프로젝트 그룹 등)에서 일정을 가볍게 공유하기 위한 캘린더 앱이다. 구두나 문자 메시지로 약속을 잡으면 시간이 지나 잊거나, 다시 묻기 번거로운 상황이 자주 발생한다. SC는 약속을 한 번 등록해두면 본인과 상대 모두가 한 화면에서 확인할 수 있게 하여, "그때 우리 며칠에 만나기로 했지?"를 매번 다시 묻지 않아도 되는 환경을 제공한다.

기존 캘린더(Google Calendar 등)는 개인 일정 관리에 최적화되어 있고, 공유 기능은 권한 설정이 복잡하거나 무겁다. SC는 **소수의 친밀한 관계**에 한정해 진입 장벽을 최소화한 공유 캘린더를 목표로 한다.

### 범위
v1.0이 다루는 범위:
- 개인 일정 CRUD (Create / Read / Update / Delete)
- 공유 달력방 CRUD (멤버 관리 포함)
- 공유 달력방 내 일정 CRUD
- 친구 추가/삭제 (SC ID 기반)
- 개인 ↔ 공유 일정 양방향 연결
- 실시간 동기화 (Supabase Realtime)
- 다크/라이트 테마
- Google OAuth 로그인
- 웹 배포 (Vercel) — iOS/Android는 Expo Go로 임시 실행

v1.0에서 제외:
- 푸시 알림
- 일정 댓글/이모지/반응
- 반복 일정 (매주/매달)
- 일정 시간(시:분) 단위 — 현재는 날짜 단위만
- 캘린더 외부 공유 (링크/iCal export)

### 용어 정의
| 용어 | 설명 |
|------|------|
| SC ID | 친구 추가에 사용하는 6자리 고유 영숫자 코드. 사용자별로 1개 자동 발급. |
| 달력방 (Group Calendar) | 여러 사용자가 함께 일정을 공유하는 단체 캘린더. |
| 개인 일정 (Personal Event) | 본인만 보는 일정. |
| 공유 일정 (Group Event) | 특정 달력방의 멤버 모두가 보는 일정. |
| 일정 연결 | 하나의 일정을 개인 캘린더와 공유 달력방에 동시 등록하는 기능. 한쪽 삭제 시 연결된 다른 쪽도 함께 삭제됨. |
| 생성자 (Creator) | 달력방을 만든 사용자 (`created_by`). v1.0에서는 다른 멤버를 강제 제거할 수 있는 권한이 있고, 그 외 권한은 일반 멤버와 동일. |

---

## 2. 사용자 및 권한

### 사용자 역할

| 역할 | 설명 | 주요 권한 |
|------|------|---------|
| 비로그인 사용자 | 로그인 화면만 접근 가능 | Google OAuth 로그인 |
| 로그인 사용자 | 모든 기능 사용 가능. 단일 역할 모델. | 본인 일정/친구 CRUD, 가입한 달력방 일정 CRUD |
| 달력방 생성자 | 로그인 사용자의 부분집합. 자신이 만든 방에 한해 다른 멤버 강제 제거 가능. | 다른 멤버 제거 (UI는 멤버 1명만 남았을 때 삭제 버튼 노출) |

> RLS(Row Level Security)로 모든 권한이 DB 레벨에서 강제됨. 클라이언트 검증은 UX 보조 수단.

### 핵심 사용자 시나리오

#### 시나리오 1: 연인과 데이트 일정 잡기
1. 사용자 A가 SC에 Google 계정으로 로그인한다.
2. 설정에서 자신의 SC ID(예: `A1B2C3`)를 확인하고 연인 B에게 공유한다.
3. B가 자신의 SC에서 친구 추가 → A의 SC ID 입력 → 친구 등록.
4. A가 "달력방 만들기" → 이름 "우리" → B 선택 → 방 생성.
5. A가 5/15에 "데이트 — 영화" 일정을 추가하면 B의 화면에도 즉시 표시됨 (실시간 동기화).
6. B가 5/16에 "기념일 저녁" 일정을 등록 → A의 화면에도 즉시 반영.

#### 시나리오 2: 팀 프로젝트 회의 일정 맞추기
1. 팀원 4명이 각자 SC ID를 교환하고 서로 친구 추가.
2. 팀장이 달력방 "캡스톤 팀" 생성, 멤버 3명 초대.
3. 팀원 각자가 본인의 개인 캘린더에 미리 학과 수업/약속을 등록.
4. 회의 후보일을 잡을 때 "공유 일정으로 추가" 시 본인의 개인 일정과 자동 연결되어, 본인 캘린더에서도 같은 일정을 볼 수 있음.
5. 시간이 안 맞는 사람이 있으면 일정을 수정/삭제 → 모두에게 즉시 반영.

#### 시나리오 3: 달력방 정리 (혼자 남았을 때)
1. 팀 프로젝트가 끝나 달력방이 더 이상 필요 없어짐.
2. 멤버들이 한 명씩 "방 나가기"를 수행 → `leave_group_calendar` RPC가 호출되어 해당 사용자가 멤버 목록에서 제거됨.
3. 마지막 한 명이 남으면 "방 삭제" 버튼이 활성화 → 방과 모든 공유 일정이 함께 삭제됨.
4. 중간에 생성자가 먼저 나간 경우에도 남은 멤버가 자율적으로 정리 가능 (마지막 1명이 되면 누구든 삭제할 수 있음).

### 예외 / 오류 케이스
- **자기 자신 친구 추가**: 차단 ("자신을 친구로 추가할 수 없습니다").
- **이미 친구**: 차단 ("이미 친구입니다").
- **존재하지 않는 SC ID**: 차단 ("존재하지 않는 SC ID입니다").
- **다른 멤버가 남아있을 때 방 삭제 시도**: 차단 ("다른 멤버가 남아있어 삭제할 수 없습니다. 먼저 방에서 나가주세요").
- **권한 없는 사용자의 방 정보 수정**: RLS에서 차단.
- **로그인 세션 만료**: 모든 서비스 메서드는 세션 유효성을 검사하여 "로그인되지 않음" 에러 반환.
- **연결된 일정 삭제**: 한쪽을 삭제하면 연결된 반대쪽도 자동 삭제 (cascade). 무한 루프 방지를 위해 `skipCascade` 플래그 사용.

---

## 3. 기능 명세

### 3.1 Google OAuth 로그인
- **목적**: 비밀번호 관리 부담 없이 1초 안에 로그인 완료.
- **접근 권한**: 비로그인 사용자.
- **입력**: Google 계정.
- **출력/결과**: Supabase 세션 발급, `users` 테이블에 프로필 1건 자동 생성(없는 경우), SC ID 6자리 자동 발급.
- **예외 처리**: 사용자가 OAuth 창을 닫으면 "로그인이 취소되었습니다" 메시지.
- **UI/UX 메모**: 웹은 리다이렉트, 모바일은 `expo-web-browser` 인앱 브라우저 사용.

### 3.2 SC ID 기반 친구 추가
- **목적**: 전화번호/이메일 같은 민감 정보 없이 6자리 코드만으로 친구 등록.
- **접근 권한**: 로그인 사용자.
- **입력**: 6자리 SC ID.
- **출력/결과**: `friendships` 레코드 1건 생성. ID 형식 `{sorted_uid1}_{sorted_uid2}`로 양방향 중복 방지.
- **예외 처리**: 자기 자신 / 이미 친구 / 존재하지 않는 SC ID → 명시적 에러 메시지.
- **UI/UX 메모**: 입력 필드는 6자리만 허용. 친구 추가 성공 시 친구 목록에 즉시 반영(Realtime).

### 3.3 친구 삭제
- **목적**: 더 이상 일정 공유가 필요 없는 관계 정리.
- **접근 권한**: 본인이 user1 또는 user2인 friendships 레코드.
- **입력**: 친구의 user_id.
- **출력/결과**: 해당 friendship 레코드 삭제.
- **예외 처리**: RLS에서 권한 없는 삭제 차단.
- **UI/UX 메모**: 친구 삭제 시 확인 다이얼로그 권장.

### 3.4 개인 일정 CRUD
- **목적**: 본인만 보는 사적 일정 관리.
- **접근 권한**: 작성자 본인.
- **입력**: title, date (YYYY-MM-DD), endDate (옵션, 기본=date), dotColor (옵션).
- **출력/결과**: `personal_events` 테이블에 1건 추가/수정/삭제.
- **예외 처리**: 연결된 그룹 일정이 있으면 함께 삭제(cascade).
- **UI/UX 메모**: 캘린더 그리드에 색상 점(dot)으로 일정 표시.

### 3.5 달력방 생성
- **목적**: 친구 그룹과 일정 공유 시작.
- **접근 권한**: 로그인 사용자.
- **입력**: 방 이름, 초대할 멤버 user_id 목록 (생성자 본인은 자동 포함).
- **출력/결과**: `group_calendars` 레코드 1건 생성. `members` 배열에 모든 초대 멤버 포함, `created_by`는 생성자 user_id.
- **예외 처리**: 멤버 중복은 자동 제거 (Set 처리).
- **UI/UX 메모**: 친구 목록에서 다중 선택 UI 권장.

### 3.6 달력방 멤버 관리
- **목적**: 방에 친구를 추가하거나 제거.
- **접근 권한**:
  - 멤버 추가: 방의 기존 멤버 누구나.
  - 멤버 제거: 방 생성자 또는 본인(=나가기).
- **입력**: groupId, memberId.
- **출력/결과**: `group_calendars.members` 배열 업데이트.
- **예외 처리**: 본인이 본인을 제거(=나가기)는 RLS의 WITH CHECK를 회피하기 위해 `leave_group_calendar` SECURITY DEFINER RPC 사용.
- **UI/UX 메모**: 나가기 시 확인 다이얼로그.

### 3.7 달력방 삭제
- **목적**: 사용 종료된 방 정리.
- **접근 권한**: 방의 마지막 남은 멤버. (RLS는 생성자만 허용하지만, 클라이언트는 멤버 수가 1일 때만 허용)
- **입력**: groupId.
- **출력/결과**: 방의 모든 `group_events` 삭제 → `group_calendars` 레코드 삭제.
- **예외 처리**: 다른 멤버가 남아있으면 차단 ("먼저 방에서 나가주세요").
- **UI/UX 메모**: 모든 일정이 삭제된다는 점을 강하게 경고.

### 3.8 공유 일정 CRUD
- **목적**: 달력방 멤버 모두가 공유하는 일정 관리.
- **접근 권한**: 방의 모든 멤버 (RLS에서 검증).
- **입력**: title, date, endDate, groupCalendarId, linkedPersonalEventId(옵션), dotColor(옵션).
- **출력/결과**: `group_events` 테이블에 1건 추가/수정/삭제. 등록 시 `user_id`는 자동으로 `auth.uid()`.
- **예외 처리**: 연결된 개인 일정 있으면 함께 삭제(cascade).
- **UI/UX 메모**: 일정 작성자(`user_id`)를 함께 표시해 누가 만든 일정인지 식별.

### 3.9 개인 ↔ 공유 일정 연결
- **목적**: 같은 약속을 두 곳에 중복 입력하지 않고 한 번에 등록.
- **접근 권한**: 일정 작성자.
- **입력**: 일정 추가 시 "공유 달력방에도 추가" 옵션 선택.
- **출력/결과**:
  - `personal_events.linked_group_event_ids` (배열, 1:N) ← 한 개인 일정이 여러 방에 동시 등록 가능.
  - `group_events.linked_personal_event_id` (단일, N:1).
- **예외 처리**: 한쪽 삭제 시 반대쪽도 cascade 삭제. 무한 루프 방지를 위해 `skipCascade` 플래그.
- **UI/UX 메모**: 연결된 일정은 시각적으로 다르게 표시 (예: 작은 링크 아이콘).

### 3.10 실시간 동기화
- **목적**: 친구가 일정을 추가하면 본인 화면에 즉시 반영.
- **접근 권한**: 모든 로그인 사용자(자신이 볼 수 있는 데이터에 한해).
- **입력**: 없음 (자동 구독).
- **출력/결과**: `friendships`, `group_calendars`, `group_events`, `personal_events` 테이블 변경 시 클라이언트의 listener 콜백 트리거 → UI 자동 갱신.
- **예외 처리**: 구독 채널 이탈 시 cleanup으로 `removeChannel` 호출.
- **UI/UX 메모**: 별도 새로고침 버튼 불필요.

### 3.11 다크 모드
- **목적**: 야간 사용 시 눈의 피로 감소 + 사용자 취향.
- **접근 권한**: 로그인 사용자 (개인 설정).
- **입력**: 설정 화면의 토글.
- **출력/결과**: AsyncStorage에 저장 + ThemeContext로 앱 전체에 적용.
- **예외 처리**: 저장 실패 시 세션 동안만 유지.
- **UI/UX 메모**: 시스템 테마 자동 추적 옵션은 v1.0에서 제외.

---

## 4. 데이터 모델

### 4.1 핵심 엔티티

#### users
앱 자체 프로필. `auth.users`(Supabase Auth)와 1:1.

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| id | UUID | Y | 앱 내부 PK (`gen_random_uuid()`) |
| auth_id | UUID | Y | `auth.users(id)` 외래키 (UNIQUE, ON DELETE CASCADE) |
| sc_id | varchar(6) | Y | 친구 추가용 6자리 고유 코드 (UNIQUE) |
| display_name | text | Y | 표시 이름 (기본 `''`) |
| created_at | timestamptz | Y | 생성 시각 |

**인덱스**: `auth_id`, `sc_id`

#### friendships
양방향 친구 관계. ID 형식 `{sorted_uid1}_{sorted_uid2}`로 중복 방지.

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| id | text | Y | `${sorted_uid1}_${sorted_uid2}` |
| user1 | UUID | Y | `auth.users(id)`, `user1 < user2` 제약 |
| user2 | UUID | Y | `auth.users(id)` |
| requester | UUID | Y | 친구 추가를 시작한 사용자 |
| status | text | Y | 기본 `'active'` (현재 모델은 즉시 수락 모델) |
| created_at | timestamptz | Y | 생성 시각 |

**인덱스**: `user1`, `user2`

#### group_calendars
달력방. 멤버 목록은 `members` UUID 배열로 저장 (정규화 대신 비정규화 선택).

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| id | UUID | Y | PK |
| name | text | Y | 방 이름 |
| members | UUID[] | Y | 멤버 `auth_id` 배열 (기본 `'{}'`) |
| created_by | UUID | Y | 생성자 `auth.users(id)` |
| created_at | timestamptz | Y | |
| updated_at | timestamptz | Y | 멤버/이름 변경 시 갱신 |

**인덱스**: GIN(`members`), `created_by`

#### group_events
달력방 내 공유 일정.

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| id | UUID | Y | PK |
| title | text | Y | 일정 제목 |
| date | date | Y | 시작일 |
| end_date | date | Y | 종료일 (단일 일정 시 = `date`) |
| group_calendar_id | UUID | Y | `group_calendars(id)` (CASCADE) |
| user_id | UUID | Y | 작성자 `auth.users(id)` |
| linked_personal_event_id | UUID | N | 연결된 개인 일정 ID |
| dot_color | text | Y | 기본 `'#395fa5ff'` |
| created_at, updated_at | timestamptz | Y | |

**인덱스**: `group_calendar_id`, `(group_calendar_id, date)`, `user_id`

#### personal_events
본인만 보는 개인 일정.

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| id | UUID | Y | PK |
| title | text | Y | |
| date | date | Y | |
| end_date | date | Y | |
| user_id | UUID | Y | `auth.users(id)` (CASCADE) |
| linked_group_event_ids | UUID[] | Y | 연결된 그룹 일정 ID 배열 (기본 `'{}'`) |
| dot_color | text | Y | 기본 `'#395fa5ff'` |
| created_at, updated_at | timestamptz | Y | |

**인덱스**: `user_id`, `(user_id, date)`

### 4.2 관계도

```
auth.users (Supabase Auth)
   │ 1:1
   ▼
users  ────── sc_id (UNIQUE 6자리 코드)
   │
   │ N:M (via friendships, ID = sorted concat)
   ▼
friendships

auth.users
   │ 1:N (created_by)
   ▼
group_calendars  ── members: UUID[] (N:M 비정규화)
   │ 1:N
   ▼
group_events  ──── linked_personal_event_id (N:1)
                              │
auth.users  1:N ──► personal_events  ──── linked_group_event_ids: UUID[] (1:N)
```

- `personal_events` ↔ `group_events`: 1:N (한 개인 일정이 여러 방에 동시 등록 가능). 양방향 ID로 추적.

### 4.3 RLS 정책 요약

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| users | 모두 (검색용) | 본인(auth_id=uid)만 | 본인만 | — |
| friendships | 본인이 user1/user2 | 본인이 requester+멤버 | — | 본인이 user1/user2 |
| group_calendars | 멤버만 | 본인이 created_by | 멤버 누구나 | created_by만 |
| group_events | 방 멤버만 | 방 멤버 + user_id=uid | 방 멤버 누구나 | 방 멤버 누구나 |
| personal_events | 본인만 | 본인만 | 본인만 | 본인만 |

> 본인이 본인을 group_calendars.members에서 제거하는 "나가기"는 RLS WITH CHECK 제약을 우회하기 위해 `leave_group_calendar(group_id)` SECURITY DEFINER RPC를 사용한다.

---

## 5. API 명세

별도의 백엔드 서버 없음. 클라이언트가 Supabase 클라이언트(`@supabase/supabase-js`)로 직접 호출한다. 인증/권한은 RLS로 강제. 클라이언트 측 서비스 레이어는 `src/services/*.js`에 위치.

### 5.1 AuthService

| 메서드 | 설명 | 입력 | 출력 |
|--------|------|------|------|
| `signInWithGoogle()` | Google OAuth 로그인 (웹/모바일 분기) | — | Supabase Session |
| `logout()` | 로그아웃 | — | void |

### 5.2 UserService

| 메서드 | 설명 |
|--------|------|
| `generateUniqueScId()` | 충돌하지 않는 6자리 SC ID 생성 |
| `findUserByScId(scId)` | 6자리 SC ID로 사용자 조회 |
| `createOrUpdateUserProfile(userId, displayName)` | 프로필 자동 생성 또는 displayName 업데이트 |
| `getUserProfile(userId)` | 임의 사용자 프로필 조회 |
| `getCurrentUserProfile()` | 현재 로그인 사용자 프로필 |
| `updateDisplayName(userId, displayName)` | 표시 이름 업데이트 |

### 5.3 FriendService

| 메서드 | 설명 | 권한 검증 |
|--------|------|----------|
| `addFriendByScId(scId)` | SC ID로 친구 추가 (자기/중복/없는 ID 검증) | 클라이언트 + RLS |
| `removeFriend(friendUserId)` | 친구 삭제 | RLS |
| `getFriendsList()` | 친구 목록 조회 | RLS |

### 5.4 GroupCalendarService

| 메서드 | 설명 | 권한 검증 |
|--------|------|----------|
| `createGroupCalendar(name, memberIds)` | 달력방 생성 (생성자 자동 포함) | RLS |
| `getGroupCalendar(groupId)` | 방 정보 단건 조회 | RLS |
| `getUserGroupCalendars()` | 가입한 방 목록 | RLS |
| `addMember(groupId, memberId)` | 멤버 추가 | 멤버만 (클라이언트 + RLS) |
| `removeMember(groupId, memberId)` | 멤버 제거. 본인 제거는 RPC 호출. | 생성자 또는 본인 |
| `deleteGroupCalendar(groupId)` | 방+모든 일정 삭제 | 멤버 1명만 남았을 때 |

### 5.5 GroupEventService

| 메서드 | 설명 |
|--------|------|
| `addEventToGroup(event)` | 공유 일정 추가 (linkedPersonalEventId 옵션) |
| `listenGroupEvents(groupCalendarId, cb)` | 방 전체 일정 실시간 구독 |
| `getGroupEvent(eventId)` | 일정 단건 조회 |
| `updateGroupEvent(eventId, fields)` | 일정 수정 |
| `deleteGroupEvent(eventId, skipCascade=false)` | 일정 삭제 (연결 개인 일정도 cascade) |

### 5.6 PersonalEventService

| 메서드 | 설명 |
|--------|------|
| `addPersonalEvent(fields)` | 개인 일정 추가 |
| `updateLinkedGroupEventIds(eventId, ids)` | 연결된 그룹 일정 ID 배열 업데이트 |
| `updatePersonalEvent(eventId, fields)` | 개인 일정 수정 |
| `deletePersonalEvent(eventId, skipCascade=false)` | 개인 일정 삭제 (연결 그룹 일정도 cascade) |
| `listenPersonalEvents(cb)` | 본인 개인 일정 실시간 구독 |

### 5.7 RPC

| 이름 | 설명 |
|------|------|
| `leave_group_calendar(group_id UUID)` | 본인을 멤버 배열에서 제거. SECURITY DEFINER로 RLS 회피. |

---

## 6. 비기능 요구사항

### 성능
- **목표 응답 시간**: 일정 CRUD 요청 후 UI 반영까지 1초 이내 (Realtime 채널 hop 1회 포함).
- **동시 접속**: Supabase Free Tier 한도 내. 친한 관계 그룹(10명 이하)이 주 사용자라 부하는 낮음.
- **데이터 규모**: 사용자당 일정 수 100~1000건 가정. 인덱스(`user_id`, `(user_id, date)` 등) 사전 설정.

### 보안
- **인증**: Supabase Auth + Google OAuth. 세션 토큰은 AsyncStorage(모바일) / localStorage(웹)에 자동 저장.
- **권한 제어**: Postgres RLS로 모든 테이블 강제. 클라이언트 검증은 UX 보조 수단으로만 사용.
- **개인정보**: 이메일/이름은 Supabase Auth 측에서만 보관. 앱 측 `users` 테이블에는 SC ID와 display_name만 노출. 전화번호 미수집.
- **민감 정보 노출 방지**: SC ID는 검색 가능하지만 무작위 6자리라 무차별 검색 비용 큼. 친구 추가 후에만 멤버로 초대 가능.

### 접근성 / 국제화
- **언어**: 한국어만 (v1.0).
- **다크 모드**: 라이트/다크 두 가지 테마 지원.
- **접근성**: 별도 표준 적용 안 함 (개인 과제 범위).

### 호환성
- **웹**: 최신 Chrome / Safari / Firefox.
- **모바일**: Expo Go (iOS/Android) — 정식 스토어 배포는 v1.0 범위 외.

---

## 7. 기술 스택 요약

| 영역 | 선택 |
|------|------|
| 프론트엔드 | React Native + Expo, Web 빌드 (`react-native-web`) |
| 상태/네비게이션 | React Navigation (Native Stack + Bottom Tabs), Context API (테마) |
| 캘린더 UI | `react-native-calendars` |
| 백엔드 | Supabase (Auth + Postgres + Realtime) — 별도 서버 없음 |
| 인증 | Supabase Auth (Google OAuth) |
| DB 보안 | Postgres RLS + SECURITY DEFINER RPC (필요 시) |
| 로컬 저장 | AsyncStorage (테마 등) |
| 배포 | Vercel (웹 정적 호스팅) — `npx expo export --platform web` 산출물 |
| 모바일 실행 | Expo Go (개발용 임시) |

> 별도 백엔드를 두지 않은 이유: 2일 일정 + 단일 개발자 + CRUD 위주 → BaaS의 비용/이점이 명확. 보안은 RLS로 충분히 표현 가능.

---

## 8. 개발 일정 (실제)

| 단계 | 내용 | 기간 |
|------|------|------|
| Phase 1 | Expo 프로젝트 셋업, Supabase 프로젝트 생성, 스키마 작성, RLS 정책 작성 | 2026-05-06 (오전~오후) |
| Phase 2 | 로그인 / 친구 추가 / 개인 일정 CRUD / 달력방 CRUD / 공유 일정 CRUD / 일정 연결 / 실시간 구독 | 2026-05-06 (오후~밤) |
| Phase 3 | 다크모드, UI 다듬기, 나가기 RPC, "혼자일 때 삭제" 정책 보완, 친구 삭제 | 2026-05-07 |
| Phase 4 | Vercel 웹 배포, README 작성, 스펙/회고 문서 작성 | 2026-05-07 |

---

## 9. 미결 사항 (Open Questions)

- [ ] 친구 요청/수락 모델로 변경할지 (현재는 SC ID만 알면 즉시 등록되는 모델 — 프라이버시 고려 시 양방향 수락 필요할 수 있음).
- [ ] 일정에 시간(시:분) 단위 추가 여부.
- [ ] 푸시 알림 (Expo Notifications + Supabase Edge Function).
- [ ] 반복 일정 (RRULE) 지원.
- [ ] 모바일 앱 정식 배포 (App Store / Play Store).
- [ ] 일정 작성자 표시 UI 구현 (`group_events.user_id` 활용).
- [ ] 달력방 이름 변경 기능 (스키마는 `name` 필드 지원, 서비스/UI 미구현).
- [ ] SC ID 재발급 기능 (현재는 1회 발급 후 변경 불가).

---

## 10. 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|---------|------|
| 2026-05-07 | v1.0 | 최초 작성 (구현 후 역으로 정리) | do-bro01 |
| 2026-05-15 | v1.0.1 | MVP 정리: 미구현된 "달력방 이름 변경" 기능 명세를 미결 사항으로 이동, 사용하지 않는 서비스 메서드(`getCurrentUser`, `addFriend`(레거시), `listenFriendsList`, `isFriend`, `listenUserGroupCalendars`, `updateGroupCalendarName`, `getGroupEvents`, `updateScId`) 제거에 따른 API 명세 업데이트, 기술 스택의 `expo-router` 표기 정정. | do-bro01 |
