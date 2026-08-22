export async function postBreakdownRequest(payload, { signal } = {}) {
  const response = await fetch('http://localhost:8787/api/breakdown', {
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
