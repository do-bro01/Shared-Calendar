/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

const tintColorLight = "#395fa5ff";
const tintColorDark = "#395fa5ff";

export const Colors = {
  light: {
    text: "#11181C",
    mutedText: "#687076",
    background: "#fff",
    surface: "#f5f7fb",
    border: "#ececf2",
    tint: tintColorLight,
    tintMuted: "#dbe5f5",
    danger: "#da4a47",
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#ECEDEE",
    mutedText: "#9BA1A6",
    background: "#17181bff",
    surface: "#222431ff",
    border: "#2f3340",
    tint: tintColorDark,
    tintMuted: "#2c3a55",
    danger: "#e57373",
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
  },
};

// 4·8·12·16·24·32 스케일 - 화면/컴포넌트 간 간격 통일
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// 모서리 라운드: 칩(8) / 카드(12) / 모달(16)
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
};

// 카드/섹션 표준 그림자 (light mode 위주)
export const Shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
};

// 타이포그래피 위계
export const Typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, lineHeight: 36 },
  h2: { fontSize: 22, fontWeight: "700" as const, lineHeight: 30 },
  h3: { fontSize: 18, fontWeight: "600" as const, lineHeight: 26 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: "600" as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
