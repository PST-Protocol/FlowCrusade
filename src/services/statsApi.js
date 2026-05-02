const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

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
  const res = await fetch(`${API_BASE}/api/stats`);
  return parseResponse(res, 'Failed to fetch stats');
}

export async function recordFocusSession(payload) {
  const res = await fetch(`${API_BASE}/api/stats/focus-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse(res, 'Failed to record focus session');
}

export async function recordCompletedTask(payload) {
  const res = await fetch(`${API_BASE}/api/stats/completed-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse(res, 'Failed to record completed task');
}

export async function recordDistraction(payload) {
  const res = await fetch(`${API_BASE}/api/stats/distraction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse(res, 'Failed to record distraction');
}
