import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// 요청 헤더의 사용자 JWT 로 Supabase 클라이언트를 만든다.
// → 모든 쿼리에 호출자 권한이 적용되어 RLS 가 자동 작동.
//   (service_role 키는 사용하지 않는다 — 박제 규칙)
export function createUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
