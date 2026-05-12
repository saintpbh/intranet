import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './report-table.css'
import App from './App.jsx'

// ── Global fetch interceptor ────────────────────────────────────────
// 1. Adds ngrok-skip-browser-warning header ONLY to ngrok backend requests
// 2. Catches CORS / network errors gracefully so the app doesn't crash
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  let [resource, config] = args;
  const url = typeof resource === 'string' ? resource : resource?.url || '';

  // Only add ngrok header to our own backend (ngrok domain or relative /api paths)
  const isBackendRequest = url.includes('ngrok') || url.includes('/api/');
  if (isBackendRequest) {
    config = config || {};
    config.headers = {
      ...config.headers,
      'ngrok-skip-browser-warning': '69420'
    };
    args[1] = config;
  }

  try {
    const response = await originalFetch.apply(this, args);
    return response;
  } catch (err) {
    // Network / CORS errors land here.
    // Only emit offline event for backend requests, not Firebase SDK calls
    if (isBackendRequest) {
      window.dispatchEvent(new CustomEvent('api-connection-error'));
    }
    throw err;
  }
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
