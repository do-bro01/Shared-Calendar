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
const TOP_K = 8; // 메모 본문 검색 청크 수
const META_LIMIT = 200; // 그룹 전체 일정 메타데이터 cap (최근부터)

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

    // ---- 병렬: RAG 검색 + 그룹 전체 일정 메타 -------------------------
    // 임베딩 검색만으론 "작년에 먹은 음식" 같은 카테고리/시간 한정 질문에서
    // 일부 일정이 누락됨 (TOP_K 한계 + 의미 유사도 한계).
    // → 그룹 전체 일정 메타데이터를 같이 컨텍스트로 주입해
    //   임베딩 상태·점수와 무관하게 LLM 이 빠짐없이 보고 답할 수 있게 함.
    const [queryEmbedding] = await embedTexts([message]);

    const [searchRes, allEventsRes] = await Promise.all([
      supabase.rpc("search_group_memories", {
        p_group_id: group_calendar_id,
        p_query_embedding: queryEmbedding,
        p_match_count: TOP_K,
      }),
      supabase
        .from("group_events")
        .select("title, date, end_date, memo")
        .eq("group_calendar_id", group_calendar_id)
        .order("date", { ascending: false })
        .limit(META_LIMIT),
    ]);

    if (searchRes.error) throw searchRes.error;
    const chunks: Chunk[] = searchRes.data ?? [];
    const allEvents = allEventsRes.data ?? [];

    // ---- 시스템 프롬프트 구성 ----------------------------------------
    const chunksStr = chunks.length === 0
      ? "(검색 결과 없음)"
      : chunks
        .map((c, i) => {
          const memoPart = c.memo ? `\n메모: ${c.memo}` : "";
          return `[${i + 1}] ${c.event_date} — ${c.title}${memoPart}`;
        })
        .join("\n\n");

    // 메모는 길어질 수 있어 100자 cap → 토큰 폭주 방지
    const allEventsStr = allEvents.length === 0
      ? "(등록된 일정 없음)"
      : allEvents
        .map((e) => {
          const range = e.date === e.end_date
            ? e.date
            : `${e.date} ~ ${e.end_date}`;
          const memoPart = e.memo
            ? ` · ${e.memo.length > 100 ? e.memo.slice(0, 100) + "…" : e.memo}`
            : "";
          return `- ${range} ${e.title}${memoPart}`;
        })
        .join("\n");

    const systemPrompt =
      `당신은 사용자의 공유 캘린더 일정·메모를 기반으로 질문에 답하는 한국어 어시스턴트입니다.

오늘은 ${todayStr} (${weekdayStr}요일) 입니다.
"오늘", "어제", "내일", "이번 주", "다음 주", "작년", "올해" 같은 표현은 이 날짜를 기준으로 해석하세요.

아래 [전체 일정 목록] 과 [관련 메모 상세] 만을 근거로 답하세요. 두 곳 어디에도 없으면 추측하지 말고 "기록에 없어요" 라고 답하세요.

[전체 일정 목록] (날짜·제목·짧은 메모, 최근부터 최대 ${META_LIMIT}개)
${allEventsStr}

[관련 메모 상세] (질문과 의미상 가까운 메모의 본문)
${chunksStr}

답변 규칙:
- 한국어로 자연스럽게, 친근한 말투
- 가능하면 일정 날짜와 제목을 함께 언급
- 카테고리·기간 한정 질문 ("작년 음식", "이번 달 약속" 등) 은 [전체 일정 목록] 을 빠짐없이 살펴 누락 없게 답하세요
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
