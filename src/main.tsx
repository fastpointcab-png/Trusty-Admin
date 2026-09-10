import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent unwanted automatic page refreshes and clean up any active background service workers
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    // Unregister any active or pending service workers (prevents autoUpdate reload loops)
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});

    // Block any external or Workbox controllerchange listener from forcing a page refresh
    try {
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        (event) => {
          event.stopImmediatePropagation();
        },
        true
      );
    } catch {}
  }

  // Clear any leftover service worker cache storages
  if ('caches' in window) {
    caches.keys().then((cacheNames) => {
      for (const name of cacheNames) {
        if (name.includes('workbox') || name.includes('pwa') || name.includes('sw')) {
          caches.delete(name).catch(() => {});
        }
      }
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

