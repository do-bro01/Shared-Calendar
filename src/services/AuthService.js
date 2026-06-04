// SC/src/services/AuthService.js
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabaseClient";

WebBrowser.maybeCompleteAuthSession();

const getRedirectTo = () => {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
  return Linking.createURL("auth-callback");
};

export const signInWithGoogle = async () => {
  const redirectTo = getRedirectTo();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== "web",
    },
  });
  if (error) throw error;

  if (Platform.OS === "web") {
    return data;
  }

  if (!data?.url) {
    throw new Error("OAuth URL을 받지 못했습니다");
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !result.url) {
    throw new Error("로그인이 취소되었습니다");
  }

  const { queryParams } = Linking.parse(result.url);
  const code = queryParams?.code;
  if (!code) {
    throw new Error("인증 코드를 받지 못했습니다");
  }

  const { data: session, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return session;
};

// ─── 이메일 + 비밀번호 로그인 ─────────────────────────────
export const signInWithEmail = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
};

// ─── 회원가입: 1) 이메일에 6자리 OTP 발송 ───────────────
// shouldCreateUser=true → 미가입자면 새로 만들고, 기존 사용자면 그 계정에 OTP 발송됨.
// 회원가입 화면에서 호출. 이미 가입된 이메일이면 verify는 통과하지만
// 비밀번호 설정 단계에서 사용자 안내가 필요할 수 있음.
export const sendSignupOtp = async (email) => {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
};

// ─── 회원가입: 2) OTP 검증 → 세션 생성 ───────────────────
export const verifyEmailOtp = async (email, token) => {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw error;
  return data;
};

// ─── 회원가입: 3) 인증 직후 비밀번호 설정 ────────────────
// verifyOtp 이후 세션이 활성 상태이므로 updateUser로 비밀번호 저장.
export const setPasswordForCurrentUser = async (password) => {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
};

// ─── 비밀번호 찾기: 1) 가입된 사용자에게만 OTP 발송 ───────
export const sendPasswordResetOtp = async (email) => {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};
