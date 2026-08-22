import { API_BASE, WEB_DEMO_MODE } from '../config/runtime';
import { createDemoRecovery } from './demoFallback';

export async function postReplanRequest(payload, { signal } = {}) {
  if (WEB_DEMO_MODE || !API_BASE) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    return createDemoRecovery(payload);
  }
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
