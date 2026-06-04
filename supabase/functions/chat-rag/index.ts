// chat-rag
// ----------------------------------------------------------------
// 1) 사용자 질문 임베딩
// 2) search_group_memories RPC 로 해당 그룹 메모 top-K 검색 (RLS 적용)
// 3) 최근 대화 히스토리 + 검색 컨텍스트로 GPT-4o-mini 응답 생성
// 4) user / assistant 메시지를 chat_messages 에 저장
// ----------------------------------------------------------------
// 요청 body:
//   { session_id?: string, group_calendar_id: string, message: string }
// 응답:
//   { session_id, answer, sources: [...], usage }
// ----------------------------------------------------------------

import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabaseClient.ts";
import { chatComplete, embedTexts } from "../_shared/openai.ts";

const HISTORY_LIMIT = 10; // 컨텍스트에 넣을 직전 메시지 수
const TOP_K = 8; // 검색 청크 수

type Chunk = {
  event_id: string;
  title: string;
  event_date: string;
  event_end_date: string;
  memo: string;
  score: number;
};

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

    const body = await req.json().catch(() => ({}));
    const { session_id, group_calendar_id, message } = body as {
      session_id?: string;
      group_calendar_id?: string;
      message?: string;
    };

    if (!group_calendar_id || !message || message.trim().length === 0) {
      return json(
        { error: "group_calendar_id, message 가 모두 필요합니다." },
        400,
      );
    }

    // ---- 세션 확보 ----------------------------------------------------
    let sessionId = session_id ?? "";
    if (!sessionId) {
      const title = message.length > 30 ? message.slice(0, 30) + "…" : message;
      const { data: newSession, error: sessError } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          group_calendar_id,
          title,
        })
        .select("id")
        .single();
      if (sessError) throw sessError;
      sessionId = newSession.id;
    }

    // ---- 이전 대화 히스토리 (memory) ---------------------------------
    // 아직 사용자 메시지를 저장 전이라 순수 과거만 잡힘
    const { data: historyRows } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    const history = (historyRows ?? []).reverse();

    // ---- 한국 기준 오늘 날짜 -----------------------------------------
    // Edge Function 은 UTC 환경. 사용자가 한국이라 KST 로 변환.
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const nowKst = new Date(Date.now() + KST_OFFSET_MS);
    const todayStr = nowKst.toISOString().slice(0, 10);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekdayStr = weekdays[nowKst.getUTCDay()];
    const upcomingEnd = new Date(
      nowKst.getTime() + 7 * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);

    // ---- 병렬: RAG 검색 + 오늘~7일 후 일정 메타 -----------------------
    const [queryEmbedding] = await embedTexts([message]);

    const [searchRes, upcomingRes] = await Promise.all([
      supabase.rpc("search_group_memories", {
        p_group_id: group_calendar_id,
        p_query_embedding: queryEmbedding,
        p_match_count: TOP_K,
      }),
      // 시간 한정 질문 ("오늘 뭐 있지?", "이번 주에 뭐 있지?") 보강용.
      // 임베딩 검색만으론 날짜 매칭이 안 잡혀서 별도 쿼리로 채워줌.
      supabase
        .from("group_events")
        .select("title, date, end_date, memo")
        .eq("group_calendar_id", group_calendar_id)
        .gte("end_date", todayStr)
        .lte("date", upcomingEnd)
        .order("date", { ascending: true })
        .limit(20),
    ]);

    if (searchRes.error) throw searchRes.error;
    const chunks: Chunk[] = searchRes.data ?? [];
    const upcoming = upcomingRes.data ?? [];

    // ---- 시스템 프롬프트 구성 ----------------------------------------
    const chunksStr = chunks.length === 0
      ? "(검색 결과 없음)"
      : chunks
        .map(
          (c, i) =>
            `[${i + 1}] ${c.event_date} — ${c.title}\n메모: ${c.memo}`,
        )
        .join("\n\n");

    const upcomingStr = upcoming.length === 0
      ? "(다가오는 일정 없음)"
      : upcoming
        .map((e) => {
          const range = e.date === e.end_date
            ? e.date
            : `${e.date} ~ ${e.end_date}`;
          const memoPart = e.memo ? `\n  메모: ${e.memo}` : "";
          return `- ${range} ${e.title}${memoPart}`;
        })
        .join("\n");

    const systemPrompt =
      `당신은 사용자의 공유 캘린더 메모를 기반으로 질문에 답하는 한국어 어시스턴트입니다.

오늘은 ${todayStr} (${weekdayStr}요일) 입니다.
"오늘", "어제", "내일", "이번 주", "다음 주" 같은 표현은 이 날짜를 기준으로 해석하세요.

아래 [검색된 일정] 과 [오늘부터 7일간 일정] 만을 근거로 답하세요. 두 곳 어디에도 없으면 추측하지 말고 "기록에 없어요" 라고 답하세요.

[검색된 일정] (질문과 의미상 유사한 메모)
${chunksStr}

[오늘부터 7일간 일정] (날짜 기반)
${upcomingStr}

답변 규칙:
- 한국어로 자연스럽게, 친근한 말투
- 가능하면 일정 날짜와 제목을 함께 언급
- 추측·창작 금지`;

    // ---- LLM 호출 ----------------------------------------------------
    const llmMessages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const { content: answer, usage } = await chatComplete({
      messages: llmMessages,
    });

    // ---- retrieved_chunks 포맷 (출처 카드용) -------------------------
    const retrievedChunks = chunks.map((c) => ({
      event_id: c.event_id,
      title: c.title,
      date: c.event_date,
      end_date: c.event_end_date,
      snippet: c.memo,
      score: c.score,
    }));

    // ---- user + assistant 메시지를 함께 저장 -------------------------
    const { error: insertError } = await supabase.from("chat_messages").insert([
      { session_id: sessionId, role: "user", content: message },
      {
        session_id: sessionId,
        role: "assistant",
        content: answer,
        retrieved_chunks: retrievedChunks,
        token_usage: usage,
      },
    ]);
    if (insertError) throw insertError;

    return json({
      session_id: sessionId,
      answer,
      sources: retrievedChunks,
      usage,
    });
  } catch (err) {
    console.error("chat-rag error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
