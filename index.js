// SC/index.js
import { registerRootComponent } from 'expo';
import App from './App';

if (typeof document !== 'undefined') {
  const ensureMeta = (attr, name, content) => {
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  const ensureLink = (rel, href, extra = {}) => {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
    Object.entries(extra).forEach(([k, v]) => el.setAttribute(k, v));
  };

  // localStorage에 저장된 테마 모드를 읽어서 초기 status bar / 배경색 결정
  // (ThemeContext와 동일한 키 사용 — FOUC 및 iOS PWA 실행 시 status bar 색상 깜빡임 방지)
  let initialIsDark = false;
  let initialIsCream = false;
  try {
    const saved = window.localStorage && window.localStorage.getItem('sc-theme-mode');
    initialIsDark = saved === 'dark';
    const savedCream = window.localStorage && window.localStorage.getItem('sc-theme-cream');
    initialIsCream = !initialIsDark && savedCream === 'true';
  } catch (_) {
    // localStorage 접근 실패 — light 모드로 폴백
  }
  const initialBg = initialIsDark ? '#17181b' : initialIsCream ? '#fbf7ec' : '#ffffff';
  const initialStatusBarStyle = initialIsDark ? 'black' : 'default';

  ensureMeta('name', 'theme-color', initialBg);
  ensureMeta('name', 'mobile-web-app-capable', 'yes');
  ensureMeta('name', 'apple-mobile-web-app-capable', 'yes');
  ensureMeta('name', 'apple-mobile-web-app-status-bar-style', initialStatusBarStyle);
  ensureMeta('name', 'apple-mobile-web-app-title', 'Share Calendar');
  ensureMeta(
    'name',
    'viewport',
    'width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no',
  );

  ensureLink('manifest', '/manifest.json');
  ensureLink('apple-touch-icon', '/apple-touch-icon.png');
  ensureLink('icon', '/icon-192.png', { sizes: '192x192', type: 'image/png' });

  if (document.documentElement) {
    document.documentElement.style.backgroundColor = initialBg;
    document.documentElement.style.colorScheme = initialIsDark ? 'dark' : 'light';
  }
  if (document.body) {
    document.body.style.backgroundColor = initialBg;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

registerRootComponent(App);
