-- =========================================================
-- leave_group_calendar(group_id uuid)
-- 자기 자신을 group_calendars.members에서 제거하는 RPC
-- SECURITY DEFINER로 RLS를 우회하고, 함수 내부에서 직접 권한 검사
-- =========================================================

create or replace function public.leave_group_calendar(group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  current_members uuid[];
begin
  if current_uid is null then
    raise exception '로그인되지 않음';
  end if;

  select members into current_members
  from public.group_calendars
  where id = group_id;

  if current_members is null then
    raise exception '달력방을 찾을 수 없습니다';
  end if;

  if not (current_uid = any(current_members)) then
    raise exception '권한이 없습니다';
  end if;

  update public.group_calendars
  set members = array_remove(members, current_uid),
      updated_at = now()
  where id = group_id;
end;
$$;

grant execute on function public.leave_group_calendar(uuid) to authenticated;
