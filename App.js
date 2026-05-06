// SC/App.js
import React, { useEffect, useState } from "react";
import { StatusBar } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { supabase } from "./src/lib/supabaseClient";
import ThemeContext, { ThemeProvider } from "./src/context/ThemeContext";

import LoginScreen from "./src/screens/LoginScreen";
import MainTabNavigator from "./src/navigation/MainTabNavigator";

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null); // 로그인 상태 저장
  const [loading, setLoading] = useState(true); // 초기 로딩

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (loading) return null; // 앱 시작 시 깜빡임 방지

  return (
    <ThemeProvider>
      <ThemeContext.Consumer>
        {(theme) => (
          <>
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
          </>
        )}
      </ThemeContext.Consumer>
    </ThemeProvider>
  );
}
