import { API_BASE, WEB_DEMO_MODE } from '../config/runtime';
import { createDemoBreakdown } from './demoFallback';

export async function postBreakdownRequest(payload, { signal } = {}) {
  if (WEB_DEMO_MODE || !API_BASE) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    return createDemoBreakdown(payload);
  }

  const response = await fetch(`${API_BASE}/api/breakdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = { error: 'Local breakdown request failed' };
  }

  if (!response.ok) {
    const suffix = data.requestId ? ` (requestId: ${data.requestId})` : '';
    throw new Error(`${data.error || 'Local breakdown request failed'}${suffix}`);
  }

  return data;
}
