import React, { createContext, useContext, useState, useEffect } from "react";
import { Colors, Typography } from "../../constants/theme";

const WEB_FONT_STYLE_ID = "sc-global-font";

// react-native-web가 Text에 inline 'fontFamily: System'을 박는 걸 덮어쓰기 위해
// !important 한 줄짜리 전역 스타일 시트를 한 번만 주입.
const ensureWebFontStyle = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById(WEB_FONT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = WEB_FONT_STYLE_ID;
  style.textContent = `
    body, [data-class~="r-fontFamily"], div, span, p, button, input, textarea, label {
      font-family: ${Typography.fontFamily} !important;
    }
    /* MaterialIcons / FontAwesome 등 아이콘 폰트는 원본 유지 */
    [class*="material-icons"], [class*="MaterialIcons"], i[class*="fa-"] {
      font-family: revert !important;
    }
  `;
  document.head.appendChild(style);
};

const ThemeContext = createContext();

const STORAGE_KEY = "sc-theme-mode";

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

// iOS PWA status bar는 페이지 색상이 아니라 meta 태그로 결정됨.
// 라이브 토글 시에는 일부 브라우저에서만 즉시 반영되지만,
// 이 값을 localStorage에 저장해두면 다음 PWA 실행 시 올바른 색으로 시작됨.
const applyWebTheme = (mode) => {
  if (typeof document === "undefined") return;
  ensureWebFontStyle();
  const isDark = mode === "dark";
  const bgColor = isDark ? Colors.dark.background : Colors.light.background;
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

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, mode);
      } catch (_) {
        // 저장 실패는 무시
      }
    }
    applyWebTheme(mode);
  }, [mode]);

  const toggle = () => setMode((m) => (m === "light" ? "dark" : "light"));

  const theme = {
    mode,
    colors: mode === "light" ? Colors.light : Colors.dark,
    toggle,
  };

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
