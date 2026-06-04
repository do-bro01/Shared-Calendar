-- ---------------------------------------------------------
-- 메모 없는 일정도 챗봇 검색에 잡히게 함
--   - 임베딩 텍스트를 "title + memo" 로 확장 (Edge Function 측 로직)
--   - 트리거: title 또는 memo 변경 시 임베딩 무효화 (이전엔 memo 만 감지)
--   - 기존 행: memo_embedded_at 을 NULL 로 reset →
--     다음 embed-batch 호출 시 모든 일정이 재임베딩됨
-- ---------------------------------------------------------

create or replace function public.reset_memo_embedding_on_change()
returns trigger
language plpgsql
as $$
begin
  if NEW.title is distinct from OLD.title
     or NEW.memo is distinct from OLD.memo then
    NEW.memo_embedding := null;
    NEW.memo_embedded_at := null;
  end if;
  return NEW;
end;
$$;

-- 모든 기존 임베딩 무효화 → 재임베딩 대상화
update public.group_events
  set memo_embedding = null,
      memo_embedded_at = null
  where memo_embedded_at is not null
     or memo_embedding is not null;
