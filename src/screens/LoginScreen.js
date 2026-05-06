// SC/src/screens/LoginScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { signIn, signUp } from "../services/AuthService";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // 비밀번호 확인
  const [loading, setLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true); // 로그인이랑 회원가입

  const handleAuth = async () => {
    if (email === "" || password === "") {
      Alert.alert("알림", "이메일과 비밀번호를 입력해주세요.");
      return;
    }

    if (!isLoginMode) {
      // 회원가입 모드일 때 비밀번호 확인
      if (password !== confirmPassword) {
        Alert.alert("알림", "비밀번호가 일치하지 않습니다.");
        return;
      }
    }

    setLoading(true);
    try {
      if (isLoginMode) {
        // 로그인 시도
        await signIn(email, password);
      } else {
        // 회원가입 시도
        await signUp(email, password);
        Alert.alert("환영합니다", "회원가입이 완료되었습니다!");
      }
    } catch (error) {
      let errorMessage = "오류가 발생했습니다.";
      if (error.code === "auth/invalid-email")
        errorMessage = "이메일 형식이 잘못되었습니다.";
      if (error.code === "auth/user-not-found")
        errorMessage = "존재하지 않는 계정입니다.";
      if (error.code === "auth/wrong-password")
        errorMessage = "비밀번호가 틀렸습니다.";
      if (error.code === "auth/email-already-in-use")
        errorMessage = "이미 가입된 이메일입니다.";
      if (error.code === "auth/weak-password")
        errorMessage = "비밀번호는 6자리 이상이어야 합니다.";

      Alert.alert("오류", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLoginMode ? "로그인" : "회원가입"}</Text>

      <TextInput
        style={styles.input}
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {!isLoginMode && (
        <TextInput
          style={styles.input}
          placeholder="비밀번호 확인"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#395fa5ff" />
      ) : (
        <View>
          <TouchableOpacity style={styles.button} onPress={handleAuth}>
            <Text style={styles.buttonText}>
              {isLoginMode ? "로그인하기" : "회원가입하기"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsLoginMode(!isLoginMode)}
            style={styles.switchButton}
          >
            <Text style={styles.switchText}>
              {isLoginMode
                ? "계정이 없으신가요? 회원가입"
                : "이미 계정이 있나요? 로그인"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#ffffffff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#395fa5ff",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  switchButton: {
    marginTop: 20,
    alignItems: "center",
  },
  switchText: {
    color: "#2a75c4ff",
  },
});
