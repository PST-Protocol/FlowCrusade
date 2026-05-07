const clients = new Set();
const HEARTBEAT_INTERVAL_MS = 30_000;

export function addClient(res) {
  clients.add(res);
  res.on('close', () => clients.delete(res));
}

export function broadcast(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export function startHeartbeat() {
  setInterval(() => {
    broadcast('monitor.heartbeat', { ts: new Date().toISOString() });
  }, HEARTBEAT_INTERVAL_MS);
}
