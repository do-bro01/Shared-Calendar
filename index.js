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

  ensureMeta('name', 'theme-color', '#ffffff');
  ensureMeta('name', 'mobile-web-app-capable', 'yes');
  ensureMeta('name', 'apple-mobile-web-app-capable', 'yes');
  ensureMeta('name', 'apple-mobile-web-app-status-bar-style', 'default');
  ensureMeta('name', 'apple-mobile-web-app-title', 'Share Calendar');
  ensureMeta(
    'name',
    'viewport',
    'width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no',
  );

  ensureLink('manifest', '/manifest.json');
  ensureLink('apple-touch-icon', '/apple-touch-icon.png');
  ensureLink('icon', '/icon-192.png', { sizes: '192x192', type: 'image/png' });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

registerRootComponent(App);
