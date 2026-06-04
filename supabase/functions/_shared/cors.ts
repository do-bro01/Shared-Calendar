// 모든 Edge Function 에서 공유하는 CORS 헤더.
// RN 웹/네이티브 양쪽에서 호출되므로 광범위 허용.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
