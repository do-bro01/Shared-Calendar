// SC/src/screens/LoginScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { signInWithGoogle } from "../services/AuthService";

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result?.url) {
        Alert.alert("안내", "Google 로그인 페이지로 이동합니다.");
      }
    } catch (error) {
      Alert.alert("오류", "Google 로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>간단 회원가입 / 로그인</Text>
      <Text style={styles.subtitle}>아래 버튼을 클릭하여 시작하세요</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#395fa5ff" />
      ) : (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={handleGoogleSignIn}
          >
            <Text style={styles.buttonText}>🔵 Google로 시작하기</Text>
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
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 40,
  },
  buttonContainer: {
    gap: 15,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  googleButton: {
    backgroundColor: "#395fa5ff",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
