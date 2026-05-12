import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './report-table.css'
import App from './App.jsx'

// ── Global fetch interceptor ────────────────────────────────────────
// 1. Adds ngrok-skip-browser-warning header to bypass ngrok interstitial
// 2. Catches CORS / network errors gracefully so the app doesn't crash
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  let [resource, config] = args;
  config = config || {};
  config.headers = {
    ...config.headers,
    'ngrok-skip-browser-warning': '69420'
  };
  args[1] = config;

  try {
    const response = await originalFetch.apply(this, args);
    return response;
  } catch (err) {
    // Network / CORS errors land here.
    // Emit a custom event so OfflineIndicator can react.
    window.dispatchEvent(new CustomEvent('api-connection-error'));
    // Re-throw so callers' .catch() blocks still fire,
    // but the app itself won't produce an unhandled rejection.
    throw err;
  }
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
