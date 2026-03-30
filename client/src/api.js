// API Base URL configuration
// - Development: proxied via Vite (relative paths)
// - Production: served from same origin (relative paths)
// - External: set VITE_API_URL environment variable

const API_BASE = import.meta.env.VITE_API_URL || '';

export default API_BASE;
