-- ---------------------------------------------------------
-- 일정 메모(자유 기록) 컬럼 추가
-- - personal_events / group_events 양쪽 모두에 memo (text, nullable) 추가
-- - 캘린더 리스트에는 노출하지 않고, 추후 RAG(임베딩) 입력으로 사용 예정
-- ---------------------------------------------------------

alter table public.personal_events
  add column if not exists memo text;

alter table public.group_events
  add column if not exists memo text;
