// embed-batch
// ----------------------------------------------------------------
// 미임베딩 그룹 일정 메모를 일괄 임베딩 후 group_events 에 저장.
//   - 호출자 JWT 로 동작 → 본인이 멤버인 그룹의 메모만 RLS 가 노출
//   - 한 번 호출당 최대 BATCH_LIMIT 행 처리.
//     남은 행이 있으면 응답의 more:true → 클라이언트가 재호출
//   - memo 변경 시엔 트리거가 memo_embedded_at 을 NULL 로 만들어 둠
//     → 여기선 memo_embedded_at IS NULL 만 체크하면 됨
// ----------------------------------------------------------------

import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabaseClient.ts";
import { embedTexts } from "../_shared/openai.ts";

const BATCH_LIMIT = 100; // OpenAI embeddings 한 번에 처리할 행 수

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createUserClient(req);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // 미임베딩 행 추출 (RLS 가 본인 멤버 그룹으로 자동 제한)
    const { data: rows, error: selectError } = await supabase
      .from("group_events")
      .select("id, memo")
      .not("memo", "is", null)
      .is("memo_embedded_at", null)
      .limit(BATCH_LIMIT);

    if (selectError) throw selectError;

    if (!rows || rows.length === 0) {
      return json({ processed: 0, more: false, message: "no pending memos" });
    }

    // 빈 문자열 메모는 임베딩 의미 없음 — 그래도 텍스트가 있다면 그대로 보낸다.
    // (메모 작성 화면에서 trim 처리되어 있어 빈 문자열이 들어올 일은 거의 없음)
    const embeddings = await embedTexts(rows.map((r) => r.memo));

    const now = new Date().toISOString();
    const results = await Promise.all(
      rows.map((row, i) =>
        supabase
          .from("group_events")
          .update({
            memo_embedding: embeddings[i],
            memo_embedded_at: now,
          })
          .eq("id", row.id),
      ),
    );

    const failed = results.filter((r) => r.error).length;
    if (failed > 0) {
      console.error(
        "embed-batch update failures:",
        results.filter((r) => r.error).map((r) => r.error),
      );
    }

    return json({
      processed: rows.length - failed,
      failed,
      more: rows.length === BATCH_LIMIT, // 가득 찼으면 다음 페이지 가능성
    });
  } catch (err) {
    console.error("embed-batch error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
