const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

async function parseResponse(res, fallback) {
  let data = null;
  let text = '';
  try {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      text = await res.text();
    }
  } catch {
    data = null;
    text = '';
  }
  const htmlError = text.match(/<pre>([\s\S]*?)<\/pre>/i)?.[1];
  if (!res.ok) throw new Error(data?.error || (res.status === 404 ? fallback : htmlError) || fallback);
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

export async function getMonitorAgentStatus() {
  const res = await fetch(`${API_BASE}/api/monitor/agent/status`);
  return parseResponse(res, 'Failed to get monitor agent status');
}

export async function probeMonitorAgent() {
  const res = await fetch(`${API_BASE}/api/monitor/agent/probe`);
  return parseResponse(res, 'Failed to run monitor agent probe');
}

export async function startMonitorAgent() {
  const res = await fetch(`${API_BASE}/api/monitor/agent/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiBase: API_BASE }),
  });
  return parseResponse(
    res,
    res.status === 404
      ? 'Monitor agent endpoint is unavailable. Restart npm run server so the backend loads the latest code.'
      : 'Failed to start monitor agent'
  );
}

export async function stopMonitorAgent() {
  const res = await fetch(`${API_BASE}/api/monitor/agent/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return parseResponse(
    res,
    res.status === 404
      ? 'Monitor agent endpoint is unavailable. Restart npm run server so the backend loads the latest code.'
      : 'Failed to stop monitor agent'
  );
}

export async function getClassificationConfig() {
  const res = await fetch(`${API_BASE}/api/monitor/classification/config`);
  return parseResponse(res, 'Failed to get classification config');
}

export async function updateClassificationConfig(config) {
  const res = await fetch(`${API_BASE}/api/monitor/classification/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return parseResponse(res, 'Failed to update classification config');
}

export async function resetClassificationConfig() {
  const res = await fetch(`${API_BASE}/api/monitor/classification/config/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return parseResponse(res, 'Failed to reset classification config');
}

export async function getMonitorProviderHealth() {
  const res = await fetch(`${API_BASE}/api/monitor/provider/health`);
  return parseResponse(res, 'Failed to get monitor provider health');
}

export function createMonitorSSE() {
  return new EventSource(`${API_BASE}/api/monitor/stream`);
}
