// src/navigation/MainTabNavigator.js
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { FontAwesome } from "@expo/vector-icons";
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
          borderRadius: 16,
          backgroundColor: colors.background,
          paddingBottom: 8,
          paddingTop: 6,
          boxShadow: "0 6px 12px rgba(0, 0, 0, 0.08)",
          elevation: 6,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === "PersonalCalendar") iconName = "calendar";
          else if (route.name === "SharedCalendar") iconName = "users";
          else if (route.name === "Settings") iconName = "cog";

          return <FontAwesome name={iconName} size={22} color={color} />;
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
