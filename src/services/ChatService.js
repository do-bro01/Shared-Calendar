import { supabase } from "../lib/supabaseClient";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const EMBED_BATCH_URL = `${SUPABASE_URL}/functions/v1/embed-batch`;
const CHAT_RAG_URL = `${SUPABASE_URL}/functions/v1/chat-rag`;

// 무한루프 방지용 페이지 상한
const MAX_BATCH_PAGES = 20;

async function callEdgeFunction(url, body = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("로그인이 필요합니다");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let json;
  try {
    json = await res.json();
  } catch {
    json = { error: `HTTP ${res.status}` };
  }

  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

export class ChatService {
  /**
   * 미임베딩 그룹 일정 메모를 일괄 임베딩.
   * 한 페이지 최대 100건, more 가 true 면 다음 페이지 계속 호출.
   */
  static async runEmbedBatch() {
    let processed = 0;
    for (let i = 0; i < MAX_BATCH_PAGES; i++) {
      const result = await callEdgeFunction(EMBED_BATCH_URL);
      processed += result.processed ?? 0;
      if (!result.more) return { processed, pages: i + 1 };
    }
    return { processed, pages: MAX_BATCH_PAGES, capped: true };
  }

  /**
   * 챗봇 질의. sessionId 가 없으면 서버에서 새 세션 생성.
   * 응답: { session_id, answer, sources, usage }
   */
  static async ask({ sessionId, groupCalendarId, message }) {
    return callEdgeFunction(CHAT_RAG_URL, {
      session_id: sessionId,
      group_calendar_id: groupCalendarId,
      message,
    });
  }

  /**
   * 해당 그룹의 가장 최근 세션 (없으면 null)
   */
  static async getLatestSession(groupCalendarId) {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("group_calendar_id", groupCalendarId)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    return data?.[0] ?? null;
  }

  /**
   * 세션의 메시지 (시간순)
   */
  static async getMessages(sessionId) {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
}

export default ChatService;
