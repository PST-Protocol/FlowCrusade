const configuredApiBase = String(import.meta.env.VITE_API_BASE || '').trim().replace(/\/$/, '');

export const WEB_DEMO_MODE = import.meta.env.VITE_WEB_DEMO === 'true'
  || (import.meta.env.PROD && !configuredApiBase);

export const API_BASE = configuredApiBase
  || (import.meta.env.DEV ? 'http://localhost:8787' : '');

export const HAS_REMOTE_API = Boolean(API_BASE);

