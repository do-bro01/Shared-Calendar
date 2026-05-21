-- ---------------------------------------------------------
-- 일정에 시간(시:분) 정보 추가
-- - all_day: 하루종일 여부 (default true → 기존 데이터는 모두 하루종일로 간주)
-- - start_time / end_time: all_day=false 일 때만 의미 있는 값
-- 기존 date / end_date 컬럼은 그대로 유지(날짜 부분)
-- ---------------------------------------------------------

alter table public.personal_events
  add column if not exists all_day boolean not null default true,
  add column if not exists start_time time,
  add column if not exists end_time time;

alter table public.group_events
  add column if not exists all_day boolean not null default true,
  add column if not exists start_time time,
  add column if not exists end_time time;

-- all_day=false 일 때 start_time/end_time 모두 있어야 함을 보장
alter table public.personal_events
  drop constraint if exists personal_events_time_required_when_not_all_day;
alter table public.personal_events
  add constraint personal_events_time_required_when_not_all_day
  check (
    all_day = true
    or (start_time is not null and end_time is not null)
  );

alter table public.group_events
  drop constraint if exists group_events_time_required_when_not_all_day;
alter table public.group_events
  add constraint group_events_time_required_when_not_all_day
  check (
    all_day = true
    or (start_time is not null and end_time is not null)
  );
