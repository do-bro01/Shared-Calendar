// SC/src/screens/LoginScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { Radius, Spacing, Typography } from "../../constants/theme";
import Button from "../components/Button";
import { signInWithGoogle, signInWithEmail } from "../services/AuthService";

export default function LoginScreen({ navigation }) {
  const theme = useTheme();
  const colors = theme.colors;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("안내", "이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      // onAuthStateChange가 자동으로 MainTabs로 전환.
    } catch (err) {
      Alert.alert(
        "로그인 실패",
        err?.message?.includes("Invalid login credentials")
          ? "이메일 또는 비밀번호가 올바르지 않습니다."
          : err?.message || "로그인에 실패했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (_error) {
      Alert.alert("오류", "Google 로그인에 실패했습니다.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>
          친구와 함께하는 일정,{"\n"}SC에서 시작해요
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          달력방을 만들어 친구들과 약속을 공유하고,{"\n"}
          소중한 순간을 함께 계획해보세요
        </Text>

        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
          placeholder="이메일"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          editable={!loading && !googleLoading}
          returnKeyType="next"
        />

        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.card,
              marginTop: Spacing.md,
            },
          ]}
          placeholder="비밀번호"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          editable={!loading && !googleLoading}
          returnKeyType="done"
          onSubmitEditing={handleEmailLogin}
        />

        <Button
          title="로그인"
          onPress={handleEmailLogin}
          loading={loading}
          disabled={googleLoading}
          size="lg"
          fullWidth
          style={{ marginTop: Spacing.lg }}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate("ForgotPassword")}
          style={styles.forgotLink}
          hitSlop={8}
        >
          <Text style={[styles.forgotText, { color: colors.muted }]}>
            비밀번호를 잊으셨나요?
          </Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View
            style={[styles.dividerLine, { backgroundColor: colors.border }]}
          />
          <Text style={[styles.dividerText, { color: colors.muted }]}>or</Text>
          <View
            style={[styles.dividerLine, { backgroundColor: colors.border }]}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.googleButton,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              opacity: loading ? 0.5 : 1,
            },
          ]}
          onPress={handleGoogleSignIn}
          disabled={loading || googleLoading}
          activeOpacity={0.8}
        >
          <Image
            source={require("../../assets/google-logo.png")}
            style={styles.googleIcon}
            resizeMode="contain"
          />
          <Text style={[styles.googleButtonText, { color: colors.text }]}>
            {googleLoading ? "Google 연결 중..." : "Google로 계속하기"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate("Signup")}
          style={styles.signupLink}
          hitSlop={8}
        >
          <Text style={[styles.signupText, { color: colors.muted }]}>
            아직 계정이 없으신가요?{" "}
            <Text style={{ color: colors.tint, fontWeight: "600" }}>
              회원가입
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.xl,
  },
  title: {
    fontSize: Typography.title2,
    fontWeight: "700",
    marginBottom: Spacing.md,
    textAlign: "center",
    lineHeight: 32,
  },
  subtitle: {
    fontSize: Typography.subhead,
    textAlign: "center",
    marginBottom: Spacing.xxl,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontSize: Typography.body,
  },
  forgotLink: {
    alignSelf: "flex-end",
    marginTop: Spacing.md,
  },
  forgotText: {
    fontSize: Typography.subhead,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    fontSize: Typography.subhead,
  },
  googleButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: Typography.body,
    fontWeight: "600",
  },
  signupLink: {
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  signupText: {
    fontSize: Typography.subhead,
  },
});
