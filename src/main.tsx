// Ensure window.fetch is writable and configurable in browser runtime
try {
  if (typeof window !== 'undefined') {
    let _fetch = window.fetch ? window.fetch.bind(window) : undefined;
    const desc = {
      get: () => _fetch,
      set: (fn: typeof window.fetch) => {
        _fetch = fn;
      },
      configurable: true,
      enumerable: true,
    };
    if (typeof Window !== 'undefined' && Window.prototype) {
      try {
        Object.defineProperty(Window.prototype, 'fetch', desc);
      } catch {}
    }
    try {
      Object.defineProperty(window, 'fetch', desc);
    } catch {}
  }
} catch {}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
