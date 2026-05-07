-- =========================================================
-- group_calendars UPDATE: 멤버가 스스로 members에서 빠질 수 있게 허용
--
-- 이전 정책: using (auth.uid() = any(members))
--   → WITH CHECK 미지정 시 USING이 새 행에도 적용되어,
--     자기 자신을 members에서 제거하면 "새 행 위반"으로 거부됨
--
-- 수정: USING은 그대로(요청자가 현재 멤버여야 함),
--       WITH CHECK는 true로 두어 자기 제거를 허용
-- =========================================================

drop policy if exists "group_calendars_update_member" on public.group_calendars;

create policy "group_calendars_update_member" on public.group_calendars
  for update
  using (auth.uid() = any(members))
  with check (true);
