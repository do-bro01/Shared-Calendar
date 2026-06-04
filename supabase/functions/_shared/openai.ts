// OpenAI API 래퍼.
//   - text-embedding-3-small (1536 dim) — 메모/질문 임베딩
//   - gpt-4o-mini — 챗봇 응답 생성
// SDK 대신 fetch 사용 (Deno 환경, 의존성 최소화)

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY 가 설정되지 않음 — Function 호출 시 실패합니다.");
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  if (texts.length === 0) return [];

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `OpenAI embeddings ${res.status}: ${await res.text()}`,
    );
  }

  const json = await res.json();
  // OpenAI 응답은 입력 순서를 보존
  return json.data.map((d: { embedding: number[] }) => d.embedding);
}

export async function chatComplete(params: {
  messages: ChatMessage[];
  temperature?: number;
}): Promise<{
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: params.messages,
      temperature: params.temperature ?? 0.3,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI chat ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  return {
    content: json.choices[0].message.content,
    usage: {
      prompt_tokens: json.usage.prompt_tokens,
      completion_tokens: json.usage.completion_tokens,
    },
  };
}
