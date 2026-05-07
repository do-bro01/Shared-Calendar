-- =========================================================
-- group_calendars: 혼자 남았을 때만 삭제 가능 정책으로 변경
-- (이전: 생성자만 삭제 / 변경: 마지막 멤버가 자기 자신일 때만 삭제)
-- =========================================================

drop policy if exists "group_calendars_delete_creator" on public.group_calendars;
drop policy if exists "group_calendars_delete_when_alone" on public.group_calendars;

create policy "group_calendars_delete_when_alone" on public.group_calendars
  for delete using (
    auth.uid() = any(members)
    and coalesce(array_length(members, 1), 0) = 1
  );
