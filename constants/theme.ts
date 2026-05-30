import { Platform } from "react-native";

const tintColor = "#395fa5ff";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#ffffff",
    card: "#f7f8fa",
    border: "#e6e8ed",
    muted: "#6b7280",
    tint: tintColor,
    danger: "#da4a47",
    tabIconDefault: "#687076",
  },
  cream: {
    text: "#11181C",
    background: "#fbf7ec",
    card: "#f3edde",
    border: "#e7decb",
    muted: "#6b7280",
    tint: tintColor,
    danger: "#da4a47",
    tabIconDefault: "#687076",
  },
  dark: {
    text: "#ECEDEE",
    background: "#17181bff",
    card: "#23252e",
    border: "#34373f",
    muted: "#9ba1ad",
    tint: tintColor,
    danger: "#e57373",
    tabIconDefault: "#9BA1A6",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
};

// 네이티브는 'System' (iOS = SF Pro / Apple SD Gothic Neo, Android = Roboto / Noto Sans CJK).
// 웹은 LINE Seed KR 우선, 폴백으로 Apple 시스템 스택.
// LINE Seed KR CDN은 ThemeContext의 applyWebTheme에서 1회 주입.
// (다른 폰트로 바꾸려면 이 한 줄과 ThemeContext의 WEB_FONT_HREF만 교체)
export const Typography = {
  fontFamily: Platform.select({
    ios: "System",
    android: "System",
    default:
      '"LINESeedKR", "LINE Seed KR", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", Roboto, system-ui, sans-serif',
  }) as string,
  largeTitle: 34,
  title1: 28,
  title2: 22,
  title3: 20,
  headline: 17,
  body: 16,
  callout: 15,
  subhead: 14,
  footnote: 13,
  caption: 12,
  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    heavy: "800" as const,
  },
};

export const Shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const Motion = {
  duration: {
    fast: 150,
    base: 250,
    slow: 400,
  },
  easing: {
    standard: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    decelerate: "cubic-bezier(0, 0, 0.2, 1)",
  },
};
