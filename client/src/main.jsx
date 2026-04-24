import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './report-table.css'
import App from './App.jsx'

// Add global fetch interceptor to bypass ngrok browser warning
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  let [resource, config] = args;
  config = config || {};
  config.headers = {
    ...config.headers,
    'ngrok-skip-browser-warning': '69420'
  };
  args[1] = config;
  return originalFetch.apply(this, args);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
