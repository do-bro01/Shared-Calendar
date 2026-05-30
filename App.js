// SC/App.js
import React, { useEffect, useState } from "react";
import { StatusBar, Text, TextInput } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { supabase } from "./src/lib/supabaseClient";
import { UserService } from "./src/services/UserService";
import ThemeContext, { ThemeProvider } from "./src/context/ThemeContext";
import { OverlayHost } from "./src/context/OverlayContext";
import { Typography } from "./constants/theme";

import LoginScreen from "./src/screens/LoginScreen";
import MainTabNavigator from "./src/navigation/MainTabNavigator";

// 앱 전역 기본 폰트를 iOS 시스템 폰트(SF Pro)로 통일.
// 웹에서는 LINE Seed KR + Apple SD Gothic Neo 폴백 스택 사용 (constants/theme.ts).
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = [
  { fontFamily: Typography.fontFamily },
  Text.defaultProps.style,
];
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.style = [
  { fontFamily: Typography.fontFamily },
  TextInput.defaultProps.style,
];

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null); // 로그인 상태 저장
  const [loading, setLoading] = useState(true); // 초기 로딩

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user || null;
      setUser(nextUser);
      setLoading(false);

      if (nextUser) {
        UserService.createOrUpdateUserProfile(nextUser.id).catch((err) =>
          console.error("Failed to ensure user profile:", err),
        );
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (loading) return null; // 앱 시작 시 깜빡임 방지

  return (
    <ThemeProvider>
      <ThemeContext.Consumer>
        {(theme) => (
          <OverlayHost>
            <StatusBar
              barStyle={
                theme.mode === "dark" ? "light-content" : "dark-content"
              }
              backgroundColor={theme.colors.background}
            />
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                {user ? (
                  // 로그인 되어 있음 → 메인탭 이동
                  <Stack.Screen name="MainTabs" component={MainTabNavigator} />
                ) : (
                  // 로그인 안 됨 → LoginScreen 표시
                  <Stack.Screen name="Login" component={LoginScreen} />
                )}
              </Stack.Navigator>
            </NavigationContainer>
          </OverlayHost>
        )}
      </ThemeContext.Consumer>
    </ThemeProvider>
  );
}
