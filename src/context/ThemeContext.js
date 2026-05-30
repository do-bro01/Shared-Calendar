import React, { createContext, useContext, useState, useEffect } from "react";
import { Colors } from "../../constants/theme";

const ThemeContext = createContext();

const STORAGE_KEY = "sc-theme-mode";
const CREAM_STORAGE_KEY = "sc-theme-cream";
const WEB_FONT_LINK_ID = "sc-web-font";
const WEB_FONT_HREF =
  "https://cdn.jsdelivr.net/gh/webfontworld/seed/LINESeedKR.css";

// 웹에서 LINE Seed KR을 1회만 CDN으로 로드. <link>만 추가하므로 다른 폰트(아이콘 등)에 영향 없음.
const ensureWebFontLoaded = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById(WEB_FONT_LINK_ID)) return;
  const link = document.createElement("link");
  link.id = WEB_FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = WEB_FONT_HREF;
  document.head.appendChild(link);
};

const getInitialMode = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch (_) {
      // localStorage 사용 불가 (private mode 등) - 무시
    }
  }
  return "light";
};

const getInitialCream = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      return window.localStorage.getItem(CREAM_STORAGE_KEY) === "true";
    } catch (_) {
      // 무시
    }
  }
  return false;
};

// iOS PWA status bar는 페이지 색상이 아니라 meta 태그로 결정됨.
// 라이브 토글 시에는 일부 브라우저에서만 즉시 반영되지만,
// 이 값을 localStorage에 저장해두면 다음 PWA 실행 시 올바른 색으로 시작됨.
const applyWebTheme = (mode, cream) => {
  if (typeof document === "undefined") return;
  ensureWebFontLoaded();
  const isDark = mode === "dark";
  const bgColor = isDark
    ? Colors.dark.background
    : cream
      ? Colors.cream.background
      : Colors.light.background;
  const statusBarStyle = isDark ? "black" : "default";

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute("content", bgColor);

  const appleMeta = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]',
  );
  if (appleMeta) appleMeta.setAttribute("content", statusBarStyle);

  if (document.documentElement) {
    document.documentElement.style.backgroundColor = bgColor;
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }
  if (document.body) {
    document.body.style.backgroundColor = bgColor;
  }
};

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(getInitialMode);
  const [cream, setCream] = useState(getInitialCream);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, mode);
        window.localStorage.setItem(CREAM_STORAGE_KEY, cream ? "true" : "false");
      } catch (_) {
        // 저장 실패는 무시
      }
    }
    applyWebTheme(mode, cream);
  }, [mode, cream]);

  const toggle = () => setMode((m) => (m === "light" ? "dark" : "light"));
  const toggleCream = () => setCream((c) => !c);

  const palette =
    mode === "dark" ? Colors.dark : cream ? Colors.cream : Colors.light;

  const theme = {
    mode,
    cream,
    colors: palette,
    toggle,
    toggleCream,
  };

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
