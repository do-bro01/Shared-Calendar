// src/navigation/MainTabNavigator.js
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

import PersonalCalendarScreen from "../screens/PersonalCalendarScreen";
import SharedCalendarScreen from "../screens/SharedCalendarScreen";
import SettingsScreen from "../screens/SettingsScreen";

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const theme = useTheme();
  const colors = theme?.colors || {
    tint: "#395fa5ff",
    tabIconDefault: "#687076",
    background: "#fff",
  };
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // 모든 탭을 앱 진입 시 함께 마운트해, 첫 탭 전환 때 로딩이 보이지 않도록 함.
        // 포커스된 개인 캘린더가 먼저 보이고, 공유 캘린더·설정은 백그라운드에서 미리 로드됨.
        lazy: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: 4,
        },
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 12,
          height: 72,
          borderRadius: 20,
          backgroundColor: colors.background,
          paddingBottom: 8,
          paddingTop: 6,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor:
            theme.mode === "dark"
              ? "#2f3340"
              : theme.cream
                ? "#e7decb"
                : "#ececf2",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: theme.mode === "dark" ? 0.25 : 0.06,
          shadowRadius: 16,
          elevation: 4,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === "PersonalCalendar") iconName = "calendar-today";
          else if (route.name === "SharedCalendar") iconName = "groups";
          else if (route.name === "Settings") iconName = "settings";

          return <MaterialIcons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="PersonalCalendar"
        component={PersonalCalendarScreen}
        options={{ title: "개인 캘린더" }}
      />

      <Tab.Screen
        name="SharedCalendar"
        component={SharedCalendarScreen}
        options={{ title: "공유 캘린더" }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "설정" }}
      />
    </Tab.Navigator>
  );
}
