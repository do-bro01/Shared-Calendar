// src/navigation/MainTabNavigator.js
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTheme } from "../context/ThemeContext";
import { CalendarIcon, PeopleIcon, SettingsIcon } from "../components/icons";

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
          borderRadius: 20,
          backgroundColor: colors.background,
          paddingBottom: 8,
          paddingTop: 6,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: theme.mode === "dark" ? "#2f3340" : "#ececf2",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: theme.mode === "dark" ? 0.25 : 0.06,
          shadowRadius: 16,
          elevation: 4,
        },
        tabBarIcon: ({ color }) => {
          if (route.name === "PersonalCalendar")
            return <CalendarIcon size={24} color={color} />;
          if (route.name === "SharedCalendar")
            return <PeopleIcon size={24} color={color} />;
          if (route.name === "Settings")
            return <SettingsIcon size={24} color={color} />;
          return null;
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
