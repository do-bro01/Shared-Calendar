// SC/src/screens/LoginScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
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
      <Text style={styles.title}>친구와 함께하는 일정,{"\n"}SC에서 시작해요</Text>
      <Text style={styles.subtitle}>
        달력방을 만들어 친구들과 약속을 공유하고,{"\n"}소중한 순간을 함께 계획해보세요
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#395fa5ff" />
      ) : (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={handleGoogleSignIn}
            activeOpacity={0.8}
          >
            <Image
              source={require("../../assets/google-logo.png")}
              style={styles.googleIcon}
              resizeMode="contain"
            />
            <Text style={styles.googleButtonText}>Google로 시작하기</Text>
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
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 34,
    color: "#222",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 20,
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
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dadce0",
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: "#3c4043",
    fontSize: 16,
    fontWeight: "bold",
  },
});
