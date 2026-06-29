import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Unregister Service Workers and clear caches to prevent black/blank screens and caching issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length > 0) {
      for (const registration of registrations) {
        registration.unregister().then(() => {
          console.log('Successfully unregistered service worker');
        });
      }
      const reloadCount = sessionStorage.getItem('sw_reload_count') || '0';
      if (parseInt(reloadCount, 10) < 2) {
        sessionStorage.setItem('sw_reload_count', (parseInt(reloadCount, 10) + 1).toString());
        window.location.reload();
      }
    }
  });
}

if ('caches' in window) {
  caches.keys().then((names) => {
    for (const name of names) {
      caches.delete(name).then(() => {
        console.log('Cache cleared:', name);
      });
    }
  });
}
