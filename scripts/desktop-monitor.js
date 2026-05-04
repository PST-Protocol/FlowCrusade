import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const API_BASE = process.env.API_BASE || 'http://localhost:8787';
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 15_000;
const MIN_REPORT_SECONDS = Number(process.env.MIN_REPORT_SECONDS) || 10; // minimum stay before reporting
const REPORT_CHUNK_SECONDS = Number(process.env.REPORT_CHUNK_SECONDS) || MIN_REPORT_SECONDS;
const IDLE_BUFFER_SECONDS = 5 * 60; // stop accumulating after 5 min idle

// ─── AppleScript helpers ────────────────────────────────────────────────────

async function runAppleScript(script) {
  const { stdout } = await execFileAsync('osascript', ['-e', script]);
  return stdout.trim();
}

async function getIdleSeconds() {
  try {
    const { stdout } = await execFileAsync('ioreg', ['-c', 'IOHIDSystem']);
    const match = stdout.match(/HIDIdleTime[^=]+=\s*(\d+)/);
    if (match) return Math.floor(Number(match[1]) / 1_000_000_000);
  } catch {}
  return 0;
}

async function isScreenLocked() {
  try {
    const result = await runAppleScript(
      'tell application "System Events" to get running of screen saver'
    );
    if (result === 'true') return true;
  } catch {}
  // fallback: treat very long idle (>10 min) as locked
  const idle = await getIdleSeconds();
  return idle > 600;
}

async function getActiveAppName() {
  return runAppleScript(
    'tell application "System Events" to get name of first application process whose frontmost is true'
  );
}

async function getActiveWindowTitle(appName) {
  try {
    return await runAppleScript(
      `tell application "System Events" to tell process "${appName}" to get name of first window`
    );
  } catch {
    return '';
  }
}

async function getBrowserDomain(appName) {
  const lower = appName.toLowerCase();
  try {
    if (lower.includes('chrome')) {
      const url = await runAppleScript(
        'tell application "Google Chrome" to return URL of active tab of front window'
      );
      return extractDomain(url);
    }
    if (lower.includes('safari')) {
      const url = await runAppleScript(
        'tell application "Safari" to return URL of current tab of front window'
      );
      return extractDomain(url);
    }
  } catch {}
  return '';
}

function extractDomain(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function getActiveWindow() {
  const appName = await getActiveAppName();
  const [windowTitle, domain] = await Promise.all([
    getActiveWindowTitle(appName),
    getBrowserDomain(appName),
  ]);
  return { appName, windowTitle, domain };
}

// ─── Backend API ─────────────────────────────────────────────────────────────

async function getActiveSession() {
  const res = await fetch(`${API_BASE}/api/monitor/session/active`);
  if (!res.ok) return null;
  const { session } = await res.json();
  return session || null;
}

async function postEvent({ sessionId, appName, windowTitle, domain, timestamp, durationSeconds }) {
  const res = await fetch(`${API_BASE}/api/monitor/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, appName, windowTitle, domain, timestamp, durationSeconds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[monitor] Desktop monitor agent starting`);
  console.log(`[monitor] API: ${API_BASE} | Poll: ${POLL_INTERVAL_MS / 1000}s | Min report: ${MIN_REPORT_SECONDS}s | Live chunk: ${REPORT_CHUNK_SECONDS}s | Idle cap: ${IDLE_BUFFER_SECONDS / 60}min`);

  let session = null;
  let currentWindow = null;   // { appName, windowTitle, domain }
  let windowStartTime = null; // Date.now() when current window became active
  let lastActiveAt = null;    // last time idle was below IDLE_BUFFER_SECONDS

  async function reportWindow(win, startTime, endTime) {
    const durationSeconds = Math.floor((endTime - startTime) / 1000);
    if (durationSeconds < MIN_REPORT_SECONDS) {
      console.log(`[monitor] Skip ${win.appName} — only ${durationSeconds}s (< ${MIN_REPORT_SECONDS}s threshold)`);
      return;
    }
    try {
      const { monitorEvent } = await postEvent({
        sessionId: session.sessionId,
        appName: win.appName,
        windowTitle: win.windowTitle,
        domain: win.domain,
        timestamp: new Date(startTime).toISOString(),
        durationSeconds,
      });
      console.log(`[monitor] ✓ ${win.appName}${win.domain ? ` [${win.domain}]` : ''} — ${durationSeconds}s → ${monitorEvent?.classification}`);
    } catch (err) {
      console.error(`[monitor] ✗ Failed to report event: ${err.message}`);
      if (err.message.includes('404') || err.message.includes('Session not found')) {
        console.log('[monitor] Session ended externally — waiting for new session');
        session = null;
      }
    }
  }

  async function flushCurrentWindow() {
    if (session && currentWindow && windowStartTime) {
      const effectiveEnd = lastActiveAt || Date.now();
      await reportWindow(currentWindow, windowStartTime, effectiveEnd);
    }
    currentWindow = null;
    windowStartTime = null;
    lastActiveAt = null;
  }

  async function poll() {
    const now = Date.now();

    // 1. Ensure we have an active session
    if (!session) {
      try {
        session = await getActiveSession();
      } catch {
        console.error('[monitor] Cannot reach backend, will retry.');
        return;
      }
      if (!session) {
        console.log('[monitor] No active session — open the Monitor panel in the app and enable it.');
        return;
      }
      console.log(`[monitor] Session found: ${session.sessionId.slice(0, 8)}…`);
      currentWindow = null;
      windowStartTime = null;
      lastActiveAt = now;
    }

    // 2. Check screen lock / screensaver
    const locked = await isScreenLocked();
    if (locked) {
      if (currentWindow) {
        console.log('[monitor] Screen locked — flushing current window.');
        await flushCurrentWindow();
      }
      return;
    }

    // 3. Update idle tracking
    const idleSeconds = await getIdleSeconds();
    if (idleSeconds < IDLE_BUFFER_SECONDS) {
      lastActiveAt = now;
    }
    // if idle >= IDLE_BUFFER_SECONDS, lastActiveAt stops updating (time caps)

    // 4. Get active window
    let win;
    try {
      win = await getActiveWindow();
    } catch (err) {
      console.error(`[monitor] Could not read active window: ${err.message}`);
      return;
    }

    // 5. Detect window change (by app name + window title)
    const changed =
      !currentWindow ||
      win.appName !== currentWindow.appName ||
      win.windowTitle !== currentWindow.windowTitle;

    if (changed) {
      // Report previous window using effective end time (capped by lastActiveAt)
      if (currentWindow && windowStartTime) {
        const effectiveEnd = lastActiveAt || now;
        await reportWindow(currentWindow, windowStartTime, effectiveEnd);
      }
      // Start tracking new window
      currentWindow = win;
      windowStartTime = now;
      lastActiveAt = idleSeconds < IDLE_BUFFER_SECONDS ? now : null;
      const domainStr = win.domain ? ` [${win.domain}]` : '';
      console.log(`[monitor] → ${win.appName}${domainStr}`);
      return;
    }

    // 6. Report long-running activity in live chunks even if the user never
    // switches windows. Without this, the frontend only receives events on
    // window changes or agent shutdown.
    if (currentWindow && windowStartTime) {
      const effectiveEnd = lastActiveAt || now;
      const durationSeconds = Math.floor((effectiveEnd - windowStartTime) / 1000);
      if (durationSeconds >= Math.max(MIN_REPORT_SECONDS, REPORT_CHUNK_SECONDS)) {
        await reportWindow(currentWindow, windowStartTime, effectiveEnd);
        windowStartTime = effectiveEnd;
        lastActiveAt = idleSeconds < IDLE_BUFFER_SECONDS ? now : effectiveEnd;
      }
    }
  }

  // Graceful shutdown: report last window before exit
  async function shutdown() {
    console.log('\n[monitor] Shutting down — flushing last window…');
    await flushCurrentWindow();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start
  await poll();
  setInterval(poll, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error('[monitor] Fatal:', err.message);
  process.exit(1);
});
