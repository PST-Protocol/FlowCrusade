import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MONITOR_FILE = path.join(__dirname, '..', 'data', 'monitor.json');
const CRASH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function ensureMonitorFile() {
  fs.mkdirSync(path.dirname(MONITOR_FILE), { recursive: true });
  if (!fs.existsSync(MONITOR_FILE)) {
    fs.writeFileSync(MONITOR_FILE, JSON.stringify({ sessions: [], events: [] }, null, 2), 'utf8');
  }
}

function readData() {
  ensureMonitorFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(MONITOR_FILE, 'utf8'));
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return { sessions: [], events: [] };
  }
}

function writeData(data) {
  ensureMonitorFile();
  fs.writeFileSync(MONITOR_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export function recoverCrashedSessions() {
  const data = readData();
  const now = Date.now();
  let changed = false;

  data.sessions = data.sessions.map((s) => {
    if (s.status !== 'active') return s;
    const lastSeen = s.lastSeenAt ? new Date(s.lastSeenAt).getTime() : new Date(s.startTime).getTime();
    if (now - lastSeen > CRASH_TIMEOUT_MS) {
      changed = true;
      console.log(`[monitor.crash.recovery] session ${s.sessionId} marked as crashed`);
      return { ...s, status: 'crashed', endTime: s.lastSeenAt || s.startTime, crashRecovered: true };
    }
    return s;
  });

  if (changed) writeData(data);
}

export function getActiveSession() {
  const data = readData();
  return data.sessions.find((s) => s.status === 'active') || null;
}

export function createSession({ mode, linkedTaskId, linkedTaskTitle, privacySnapshot }) {
  const data = readData();

  // End any previously active session
  data.sessions = data.sessions.map((s) =>
    s.status === 'active' ? { ...s, status: 'ended', endTime: new Date().toISOString() } : s
  );

  const session = {
    sessionId: crypto.randomUUID(),
    mode: mode || 'standalone',
    startTime: new Date().toISOString(),
    endTime: null,
    lastSeenAt: new Date().toISOString(),
    linkedTaskId: linkedTaskId || null,
    linkedTaskTitle: linkedTaskTitle || null,
    status: 'active',
    privacySnapshot: privacySnapshot || { blockedApps: [], blockedDomains: [], blockedKeywords: [] },
    crashRecovered: false,
    summary: { focusMinutes: 0, distractionMinutes: 0, eventCount: 0 },
  };

  data.sessions.push(session);
  writeData(data);
  return session;
}

export function endSession(sessionId) {
  const data = readData();
  let ended = null;

  data.sessions = data.sessions.map((s) => {
    if (s.sessionId !== sessionId) return s;
    const sessionEvents = data.events.filter((e) => e.sessionId === sessionId);
    const focusMinutes = sessionEvents
      .filter((e) => e.classification === 'focus')
      .reduce((sum, e) => sum + Math.ceil((e.durationSeconds || 0) / 60), 0);
    const distractionMinutes = sessionEvents
      .filter((e) => e.classification === 'distraction')
      .reduce((sum, e) => sum + Math.ceil((e.durationSeconds || 0) / 60), 0);

    ended = {
      ...s,
      status: 'ended',
      endTime: new Date().toISOString(),
      summary: { focusMinutes, distractionMinutes, eventCount: sessionEvents.length },
    };
    return ended;
  });

  writeData(data);
  return ended;
}

export function updateSessionLastSeen(sessionId) {
  const data = readData();
  data.sessions = data.sessions.map((s) =>
    s.sessionId === sessionId ? { ...s, lastSeenAt: new Date().toISOString() } : s
  );
  writeData(data);
}

export function addMonitorEvent({ sessionId, appName, windowTitle, domain, durationSeconds, timestamp, classification, confidence, method, reason }) {
  const data = readData();
  const event = {
    id: crypto.randomUUID(),
    sessionId,
    appName: appName || 'Unknown',
    windowTitle: windowTitle || '',
    domain: domain || '',
    durationSeconds: Math.max(0, Number(durationSeconds) || 0),
    timestamp: timestamp || new Date().toISOString(),
    classification,
    confidence,
    method,
    reason,
  };
  data.events.push(event);
  writeData(data);
  return event;
}

export function getSessionEvents(sessionId) {
  const data = readData();
  return data.events.filter((e) => e.sessionId === sessionId);
}

export function getAllSessions() {
  return readData().sessions;
}
