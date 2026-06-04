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
    // - title 은 NOT NULL → 메모 없어도 제목만으로 임베딩 가능
    const { data: rows, error: selectError } = await supabase
      .from("group_events")
      .select("id, title, memo")
      .is("memo_embedded_at", null)
      .limit(BATCH_LIMIT);

    if (selectError) throw selectError;

    if (!rows || rows.length === 0) {
      return json({ processed: 0, more: false, message: "no pending events" });
    }

    // 임베딩 입력은 "title\nmemo" (memo 있으면) 또는 title 만
    const texts = rows.map((r) => {
      const title = r.title ?? "";
      return r.memo ? `${title}\n${r.memo}` : title;
    });
    const embeddings = await embedTexts(texts);

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
