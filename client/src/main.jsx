import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './report-table.css'
import App from './App.jsx'

// ngrok 무료 플랜 브라우저 경고창 우회를 위한 글로벌 fetch 인터셉터 설정
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  config = config || {};
  config.headers = {
    ...config.headers,
    'ngrok-skip-browser-warning': 'true' // ngrok HTML 경고창 스킵
  };
  return originalFetch(resource, config);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
