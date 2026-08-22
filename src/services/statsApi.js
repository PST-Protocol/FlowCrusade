import { API_BASE, WEB_DEMO_MODE } from '../config/runtime';

async function parseResponse(res, fallbackMessage) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || fallbackMessage);
  }

  return data;
}

export async function fetchStats() {
  if (WEB_DEMO_MODE || !API_BASE) return {};
  const res = await fetch(`${API_BASE}/api/stats`);
  return parseResponse(res, 'Failed to fetch stats');
}

export async function recordFocusSession(payload) {
  if (WEB_DEMO_MODE || !API_BASE) return {};
  const res = await fetch(`${API_BASE}/api/stats/focus-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse(res, 'Failed to record focus session');
}

export async function recordCompletedTask(payload) {
  if (WEB_DEMO_MODE || !API_BASE) return {};
  const res = await fetch(`${API_BASE}/api/stats/completed-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse(res, 'Failed to record completed task');
}

export async function recordDistraction(payload) {
  if (WEB_DEMO_MODE || !API_BASE) return {};
  const res = await fetch(`${API_BASE}/api/stats/distraction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse(res, 'Failed to record distraction');
}
