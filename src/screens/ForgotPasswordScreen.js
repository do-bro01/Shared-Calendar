// SC/src/screens/ForgotPasswordScreen.js
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { Radius, Spacing, Typography } from "../../constants/theme";
import Button from "../components/Button";
import {
  sendPasswordResetOtp,
  verifyEmailOtp,
  setPasswordForCurrentUser,
} from "../services/AuthService";

const RESEND_COOLDOWN_SECONDS = 60;

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export default function ForgotPasswordScreen({ navigation }) {
  const theme = useTheme();
  const colors = theme.colors;

  const [step, setStep] = useState(1); // 1: 이메일, 2: 코드, 3: 새 비밀번호
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const timerRef = useRef(null);

  useEffect(() => {
    if (resendIn <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        setResendIn((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [resendIn]);

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      Alert.alert("안내", "올바른 이메일 주소를 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetOtp(trimmed);
      setEmail(trimmed);
      setStep(2);
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      Alert.alert(
        "오류",
        err?.message?.includes("not found")
          ? "가입되지 않은 이메일입니다."
          : err?.message || "인증코드 발송에 실패했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setLoading(true);
    try {
      await sendPasswordResetOtp(email);
      setResendIn(RESEND_COOLDOWN_SECONDS);
      Alert.alert("안내", "인증코드를 다시 보냈습니다.");
    } catch (err) {
      Alert.alert("오류", err?.message || "인증코드 발송에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      Alert.alert("안내", "6자리 인증코드를 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      await verifyEmailOtp(email, trimmed);
      setStep(3);
    } catch (_err) {
      Alert.alert("오류", "인증코드가 올바르지 않거나 만료되었습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (password.length < 8) {
      Alert.alert("안내", "비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert("안내", "비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      await setPasswordForCurrentUser(password);
      // 인증 직후 세션이 살아있으므로 자동으로 MainTabs로 전환됨.
    } catch (err) {
      Alert.alert("오류", err?.message || "비밀번호 변경에 실패했습니다.");
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      navigation.goBack();
      return;
    }
    if (step === 2) {
      setCode("");
      setStep(1);
      return;
    }
    if (step === 3) {
      setPassword("");
      setPasswordConfirm("");
      setStep(2);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={[
            styles.stepDot,
            {
              backgroundColor: n <= step ? colors.tint : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={8}>
          <Text style={[styles.backButton, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        {renderStepIndicator()}
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <>
            <Text style={[styles.title, { color: colors.text }]}>
              비밀번호 찾기
            </Text>
            <Text style={[styles.description, { color: colors.muted }]}>
              가입하신 이메일 주소를 입력해주세요.{"\n"}
              인증코드를 보내드릴게요.
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
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleSendCode}
            />

            <Button
              title="인증코드 받기"
              onPress={handleSendCode}
              loading={loading}
              size="lg"
              fullWidth
              style={{ marginTop: Spacing.lg }}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={[styles.title, { color: colors.text }]}>
              인증코드 입력
            </Text>
            <Text style={[styles.description, { color: colors.muted }]}>
              {email}로 보낸{"\n"}
              6자리 인증코드를 입력해주세요.
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.codeInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
              placeholder="000000"
              placeholderTextColor={colors.muted}
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              editable={!loading}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleVerifyCode}
            />

            <Button
              title="확인"
              onPress={handleVerifyCode}
              loading={loading}
              size="lg"
              fullWidth
              style={{ marginTop: Spacing.lg }}
            />

            <TouchableOpacity
              onPress={handleResend}
              disabled={resendIn > 0 || loading}
              style={styles.bottomLink}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.bottomLinkText,
                  { color: resendIn > 0 ? colors.muted : colors.tint },
                ]}
              >
                {resendIn > 0
                  ? `${resendIn}초 후 다시 받기`
                  : "인증코드 다시 받기"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={[styles.title, { color: colors.text }]}>
              새 비밀번호 설정
            </Text>
            <Text style={[styles.description, { color: colors.muted }]}>
              새로 사용하실 비밀번호를 입력해주세요.{"\n"}
              (8자 이상)
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
              placeholder="새 비밀번호"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              editable={!loading}
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
              placeholder="새 비밀번호 확인"
              placeholderTextColor={colors.muted}
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleResetPassword}
            />

            <Button
              title="비밀번호 재설정"
              onPress={handleResetPassword}
              loading={loading}
              size="lg"
              fullWidth
              style={{ marginTop: Spacing.lg }}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === "ios" ? 56 : Spacing.xl,
    paddingBottom: Spacing.md,
  },
  backButton: {
    fontSize: 28,
    fontWeight: "300",
    width: 24,
  },
  stepIndicator: {
    flexDirection: "row",
    gap: 6,
  },
  stepDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
  content: {
    padding: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  title: {
    fontSize: Typography.title1,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: Typography.callout,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontSize: Typography.body,
  },
  codeInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
    fontWeight: "600",
  },
  bottomLink: {
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  bottomLinkText: {
    fontSize: Typography.subhead,
  },
});
