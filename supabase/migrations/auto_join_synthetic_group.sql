-- =========================================================
-- 신규 가입자를 합성 데이터 공유 달력방에 자동 추가 (옵저버)
--
-- 목적: 친구 추가/초대 없이도 모든 사용자가 합성 데이터 달력방
--       "OO동아리 (예시)" 을 볼 수 있게 한다.
--       group_calendars.members 배열에 auth_id 만 들어가면
--       RLS(select using auth.uid() = any(members)) 상 읽기가 열린다.
--       일정 작성자(user_id)는 페르소나 그대로이므로 신규 유저는 옵저버.
--
-- 구성:
--   1) auth.users AFTER INSERT 트리거 → 가입 즉시 members에 추가
--   2) 기존 사용자 일괄 백필 (이미 가입한 사람도 보이게)
--
-- 멱등(idempotent): 이미 멤버면 추가하지 않음. 여러 번 실행해도 안전.
-- 그룹명 변경 시 이 마이그레이션의 그룹명 상수도 함께 바꿔야 함.
-- =========================================================

-- 1) 트리거 함수 ------------------------------------------------
create or replace function public.add_new_user_to_synthetic_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.group_calendars
  set    members    = array_append(members, new.id),
         updated_at = now()
  where  name = 'OO동아리 (예시)'
    and  not (new.id = any(members));   -- 중복 방지(멱등)
  return new;
end;
$$;

-- 2) auth.users INSERT 트리거 ----------------------------------
drop trigger if exists on_auth_user_created_join_synthetic on auth.users;
create trigger on_auth_user_created_join_synthetic
  after insert on auth.users
  for each row
  execute function public.add_new_user_to_synthetic_group();

-- 3) 기존 사용자 일괄 백필 -------------------------------------
--    현재 members ∪ 모든 auth.users 를 distinct 로 합침.
update public.group_calendars
set    members = (
         select coalesce(array_agg(distinct uid), '{}')
         from (
           select unnest(members) as uid
           union
           select id from auth.users
         ) s
       ),
       updated_at = now()
where  name = 'OO동아리 (예시)';
