const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

async function parseResponse(res, fallback) {
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error(data?.error || fallback);
  return data;
}

export async function startMonitorSession({ mode, linkedTaskId, linkedTaskTitle } = {}) {
  const res = await fetch(`${API_BASE}/api/monitor/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: mode || 'standalone', linkedTaskId, linkedTaskTitle }),
  });
  return parseResponse(res, 'Failed to start monitor session');
}

export async function endMonitorSession(sessionId) {
  const res = await fetch(`${API_BASE}/api/monitor/session/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  return parseResponse(res, 'Failed to end monitor session');
}

export async function getActiveMonitorSession() {
  const res = await fetch(`${API_BASE}/api/monitor/session/active`);
  return parseResponse(res, 'Failed to get active session');
}

export async function postMonitorEvent({ sessionId, appName, windowTitle, domain, timestamp, durationSeconds }) {
  const res = await fetch(`${API_BASE}/api/monitor/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, appName, windowTitle, domain, timestamp, durationSeconds }),
  });
  return parseResponse(res, 'Failed to post monitor event');
}

export async function getSessionEvents(sessionId) {
  const res = await fetch(`${API_BASE}/api/monitor/events/${sessionId}`);
  return parseResponse(res, 'Failed to get session events');
}

export function createMonitorSSE() {
  return new EventSource(`${API_BASE}/api/monitor/stream`);
}
