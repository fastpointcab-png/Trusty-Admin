import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Disable Service Worker only for tracking/privacy pages
if (typeof window !== 'undefined') {
  const isTrackingPage =
    window.location.search.includes('track=') ||
    window.location.search.includes('page=privacy');

  if ('serviceWorker' in navigator) {
    if (isTrackingPage) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister().catch(() => {});
          });
        })
        .catch(() => {});
    } else {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .catch(() => {});
      });
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);