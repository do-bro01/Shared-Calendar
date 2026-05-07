# SC 테스트 체크리스트 (회귀 검증용)

> 작성일: 2026-05-07
> 대상 버전: v1.0
> 기반: v1.0 안정화 과정에서 실제로 발견·수정된 버그들

본 체크리스트는 SC v1.0을 안정화하면서 잡았던 버그들을 기반으로, **같은 종류의 회귀가 다시 발생하지 않는지** 빠르게 점검하기 위해 작성되었다. 새 코드 푸시 전, RLS·DB 마이그레이션 변경 후, 또는 Vercel 재배포 후에 한 번씩 훑을 것.

## 테스트 환경 표기

- **W**: Vercel 웹 배포 (`https://sharedcalendar-one.vercel.app`)
- **L**: 로컬 (`npm run web`)
- **N**: 네이티브 (Expo Go iOS/Android) — 가능 시

기본적으로 모든 항목을 W에서 검증하고, 가능하면 N도 확인한다. L은 코드 수정 직후 1차 확인용.

---

## 1. 인증 & 계정

- [ ] 로그인 화면이 정상 표시된다 (환영 문구 + Google 로고가 진짜 4색 G 로고).
- [ ] "Google로 시작하기" 클릭 → Google OAuth 페이지로 이동한다.
- [ ] OAuth 완료 후 **Vercel 도메인으로 돌아온다** (localhost로 떨어지지 않음).
  > Supabase URL Configuration에 production URL이 Site URL / Redirect URLs로 등록되어 있어야 한다.
- [ ] 처음 로그인하는 사용자도 `public.users` 행이 자동 생성된다.
  > [App.js](../App.js)의 `onAuthStateChange` → `UserService.createOrUpdateUserProfile` 보장.
- [ ] 설정 화면에서 **로그아웃** 버튼 클릭 시 confirm 다이얼로그가 뜨고, 확인 누르면 실제로 로그아웃되어 로그인 화면으로 돌아온다.
  > W에서는 `Alert.alert` 다중 버튼이 아닌 `window.confirm`이 떠야 정상.
- [ ] **SC ID 복사** 버튼 클릭 시 실제로 클립보드에 복사된다.
  > 단순 알림이 아니라 다른 곳에 붙여넣기 했을 때 6자리 코드가 들어가야 함.

---

## 2. 친구 관리

- [ ] 친구 SC ID를 입력해 추가 → 친구 목록에 즉시 표시된다.
- [ ] 동일한 SC ID를 두 번 추가 시 "이미 친구입니다" 메시지가 뜬다.
- [ ] 존재하지 않는 SC ID 입력 시 "존재하지 않는 SC ID입니다" 메시지가 뜬다.
- [ ] 본인 SC ID 입력 시 "자신을 친구로 추가할 수 없습니다" 메시지가 뜬다.
- [ ] 친구 추가 직후 친구 목록 GET 요청에 `auth_id=eq.null` 같은 잘못된 파라미터가 들어가지 않는다.
  > 회귀 검증: `targetUser.authId` (camelCase) vs `targetUser.auth_id` (snake_case) 필드명 버그.
- [ ] 친구 삭제 버튼 클릭 시 confirm 다이얼로그가 뜨고, 확인 시 즉시 친구 목록에서 사라진다.
- [ ] 친구 0명일 때 빈-상태 디자인(아이콘 + 안내문)이 보인다.

---

## 3. 개인 캘린더

- [ ] 개인 일정 추가 시 캘린더에 색 바(bar)로 즉시 표시된다.
- [ ] FK violation (`Key is not present in table "users"`) 에러가 발생하지 않는다.
  > 회귀 검증: `personal_events.user_id` FK가 `auth.users(id)`를 참조해야 함.
- [ ] 다중일 일정(시작일 ≠ 종료일)이 캘린더 상에서 여러 날짜를 가로지르는 색 바로 표시된다.
- [ ] 겹치는 일정은 다른 lane(줄)에 stacked 표시된다.
- [ ] 일정 카드를 클릭하면 EventModal이 편집 모드로 열린다 (이전의 Alert.alert 메뉴 형태가 아님).
- [ ] 모달 내 "삭제" 버튼 클릭 시 confirm 후 일정이 즉시 사라진다 — 화면에 잔존하지 않는다.
  > 회귀 검증: realtime DELETE 이벤트가 컬럼 필터로 차단되지 않아야 함 ([PersonalEventService.js](../src/services/PersonalEventService.js)).
- [ ] 일정 색상 변경이 캘린더의 바 색에 반영된다.
- [ ] 빈 날짜에 "일정 없음" 빈-상태 디자인(아이콘 + 안내문)이 표시된다.
- [ ] EventModal의 시작/종료 날짜 input이 모달 폭 안에 들어와 잘리지 않는다.
  > 회귀 검증: `box-sizing: border-box`.

---

## 4. 공유 달력방

- [ ] "방 만들기" 클릭 → 친구 선택 + 이름 입력 → "생성" 클릭 시 방이 생성되고 자동으로 그 방으로 진입한다.
- [ ] 방 생성 직후 `id=eq.true` 같은 잘못된 쿼리가 발생하지 않는다.
  > 회귀 검증: `createGroupCalendar`가 실제 UUID를 반환해야 함 (이전엔 `true` 반환).
- [ ] 방 만들기 시 FK violation 에러가 발생하지 않는다.
- [ ] 멤버가 2명 이상일 때 헤더 우측 아이콘은 **나가기** 아이콘(`exit-to-app`)이고, 클릭 시 본인만 빠진다 (방은 그대로 남음).
  > 회귀 검증: PATCH 요청이 RLS 거부 (`new row violates row-level security policy`) 없이 200 응답을 받는다 — `leave_group_calendar` RPC를 통해 처리됨.
- [ ] 멤버가 1명(나 혼자)일 때 헤더 우측 아이콘이 **삭제** 아이콘(`delete`)으로 바뀐다.
- [ ] 1명 남은 상태에서 삭제 클릭 → 방과 그 방의 모든 일정이 사라진다.
- [ ] 빈-상태(달력방 0개)일 때 안내 아이콘과 "친구와 일정을 공유할 새 방을 만들어보세요" 문구가 보인다.
- [ ] 친구 초대 모달에서 "초대하기" → 멤버가 즉시 추가되고 멤버 카운트가 갱신된다.

---

## 5. 공유 일정

- [ ] 공유 달력방 안에서 일정 추가 → 멤버 모두에게 색 바로 즉시 표시된다.
- [ ] 본인 외 다른 멤버가 추가/수정/삭제한 일정도 실시간으로 반영된다.
- [ ] 공유 일정 삭제 시 화면에서 즉시 사라진다.
  > 회귀 검증: `group_events`의 realtime 구독이 컬럼 필터 없이 동작해야 함 ([GroupEventService.js](../src/services/GroupEventService.js)).

---

## 6. 개인 ↔ 공유 일정 연결

- [ ] 개인 캘린더에서 일정 추가 시 공유 방 선택 → 선택된 방들에도 동시 등록된다.
- [ ] 개인 일정 삭제 시, 연결된 모든 공유 일정도 함께 삭제된다.
- [ ] 개인 일정 수정 시, 연결된 공유 일정들도 동기 수정된다.
- [ ] 수정 시 공유 방 선택을 변경하면(추가/제거), 해당 변경이 공유 측에도 반영된다.

---

## 7. 실시간 동기화

- [ ] 다른 브라우저/계정에서 친구가 새 공유 일정 추가 → 본인 화면에도 자동 갱신된다.
- [ ] 다른 브라우저에서 일정 삭제 → 본인 화면에서도 자동 삭제된다 (DELETE 이벤트 회귀 방지).
- [ ] 다른 브라우저에서 방 멤버 변경 → 본인의 방 멤버 목록도 자동 갱신된다.

---

## 8. UI / UX (디자인)

- [ ] 카드(이벤트, 섹션, 그룹 항목)의 모서리 둥글기가 12px로 통일되어 있고 부드러운 그림자가 일관되게 들어가 있다.
- [ ] 모든 아이콘이 MaterialIcons로 통일되어 있다 (FontAwesome 잔재 없음).
- [ ] 메인 액션 버튼(생성, 일정 추가, 저장)은 채움 스타일, 보조(취소)는 ghost / secondary 스타일로 일관됨.
- [ ] 하단 탭 바: 둥근 pill 형태, 부드러운 그림자, 다크모드에서도 경계가 명확하다.
- [ ] Settings 섹션 제목이 작은 uppercase 라벨 형태로 표시된다.
- [ ] 모든 빈-상태(일정 없음 / 친구 없음 / 달력방 없음)에 아이콘 + 보조 안내문이 들어 있다.

---

## 9. 다크 모드

- [ ] 설정의 다크 모드 토글로 light/dark 즉시 전환된다.
- [ ] 다크 모드 ON 시 토글의 thumb(원)이 **흰색**으로 유지된다.
  > 회귀 검증: 브라우저 OS accent-color로 인해 초록 등으로 바뀌지 않아야 함.
- [ ] 다크 모드에서 모든 카드/섹션/탭 바에 시각적 경계(테두리)가 명확하다.
- [ ] 다크 모드에서 텍스트 가독성이 유지된다.

---

## 10. 웹 호환성 (W 전용)

네이티브에서는 `Alert.alert`가 정상 작동하지만, 웹에서는 다중 버튼 콜백이 발화되지 않는 케이스가 다수 있어 `window.confirm` / `window.alert` 분기 처리가 필요했다. 아래 confirm 흐름들이 모두 W에서 동작해야 한다.

- [ ] **로그아웃** confirm — 동작한다.
- [ ] **친구 삭제** confirm — 동작한다.
- [ ] **방 나가기** confirm — 동작한다.
- [ ] **방 삭제** confirm — 동작한다.
- [ ] **개인 일정 삭제** confirm — 동작한다 (EventModal 내).
- [ ] **공유 일정 삭제** confirm — 동작한다.

---

## 11. DB / 환경

- [ ] Supabase 대시보드에서 SQL Editor를 띄울 때 **올바른 프로젝트** (`xbtzyielmtrpuwcodsxk`)에 접속되어 있는지 매번 확인한다.
  > 이전에 다른 프로젝트(출결 앱)에서 SQL을 돌려서 시간을 낭비한 적이 있음.
- [ ] FK들이 모두 `auth.users(id)`를 참조한다 (`public.users`가 아님):
  ```sql
  select tc.table_name, tc.constraint_name,
         ccu.table_schema || '.' || ccu.table_name as references
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name
   where tc.constraint_type = 'FOREIGN KEY'
     and tc.table_schema = 'public'
     and tc.table_name in ('group_calendars','group_events','personal_events','friendships');
  ```
- [ ] `group_calendars` RLS 정책이 다음과 같이 적용되어 있다:
  - **UPDATE**: `using (auth.uid() = any(members)) with check (true)`
  - **DELETE**: `using (auth.uid() = any(members) and coalesce(array_length(members,1),0) = 1)`
- [ ] RPC `public.leave_group_calendar(group_id uuid)`가 등록되어 있고 `authenticated` 롤에 EXECUTE 권한이 있다.
- [ ] Vercel 재배포 후 로컬과 Vercel 모두 동일한 동작을 한다.
  > 회귀 검증: 코드 수정만 하고 git push를 깜빡해서 Vercel은 옛 코드로 돌아가던 케이스.
