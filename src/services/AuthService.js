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

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};
