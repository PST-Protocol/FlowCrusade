const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

export async function postReplanRequest(payload, { signal } = {}) {
  const response = await fetch(`${API_BASE}/api/replan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = { error: 'Recovery request returned an invalid response.' };
  }

  if (!response.ok) {
    const suffix = data.requestId ? ` (requestId: ${data.requestId})` : '';
    throw new Error(`${data.error || 'Recovery request failed.'}${suffix}`);
  }
  return data;
}

