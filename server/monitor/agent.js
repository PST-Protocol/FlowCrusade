import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getActiveSession } from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const AGENT_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'desktop-monitor.js');
const MAX_LOG_LINES = 60;

let agentProcess = null;
let startedAt = null;
let lastExit = null;
let lastError = null;
let permissionIssue = null;
let recentLogs = [];

function isRunning() {
  return Boolean(agentProcess && agentProcess.exitCode === null && !agentProcess.killed);
}

function detectPermissionIssue(line) {
  const text = String(line || '').toLowerCase();
  return (
    text.includes('accessibility') ||
    text.includes('assistive') ||
    text.includes('not authorized') ||
    text.includes('operation not permitted') ||
    text.includes('system events') ||
    text.includes('osascript')
  );
}

function pushLog(stream, chunk) {
  const lines = String(chunk || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    recentLogs.push({
      stream,
      line,
      timestamp: new Date().toISOString(),
    });

    if (stream === 'stderr') {
      lastError = line;
    }

    if (detectPermissionIssue(line)) {
      permissionIssue = {
        message: line,
        hint: 'Grant Accessibility permission to the app that started the backend, such as Terminal, VS Code, Cursor, or Node.',
        timestamp: new Date().toISOString(),
      };
    }
  }

  recentLogs = recentLogs.slice(-MAX_LOG_LINES);
}

export function getAgentStatus() {
  return {
    running: isRunning(),
    pid: isRunning() ? agentProcess.pid : null,
    startedAt,
    lastExit,
    lastError,
    permissionIssue,
    recentLogs,
  };
}

export function startMonitorAgent({ apiBase } = {}) {
  if (isRunning()) {
    return getAgentStatus();
  }

  lastExit = null;
  lastError = null;
  permissionIssue = null;
  recentLogs = [];
  startedAt = new Date().toISOString();

  agentProcess = spawn(process.execPath, [AGENT_SCRIPT], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      API_BASE: apiBase || process.env.MONITOR_AGENT_API_BASE || 'http://localhost:8787',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  agentProcess.stdout.on('data', (chunk) => pushLog('stdout', chunk));
  agentProcess.stderr.on('data', (chunk) => pushLog('stderr', chunk));

  agentProcess.on('error', (error) => {
    lastError = error.message;
    lastExit = {
      code: null,
      signal: null,
      timestamp: new Date().toISOString(),
    };
    pushLog('stderr', error.message);
  });

  agentProcess.on('exit', (code, signal) => {
    lastExit = {
      code,
      signal,
      timestamp: new Date().toISOString(),
    };
    agentProcess = null;
  });

  return getAgentStatus();
}

export function maybeStartMonitorAgent({ apiBase } = {}) {
  const session = getActiveSession();
  if (!session) {
    return {
      started: false,
      reason: 'no-active-session',
      agent: getAgentStatus(),
    };
  }

  if (isRunning()) {
    return {
      started: false,
      reason: 'already-running',
      agent: getAgentStatus(),
    };
  }

  return {
    started: true,
    reason: 'active-session-restored',
    sessionId: session.sessionId,
    agent: startMonitorAgent({ apiBase }),
  };
}

export function stopMonitorAgent() {
  if (!isRunning()) {
    return getAgentStatus();
  }

  agentProcess.kill('SIGTERM');
  return getAgentStatus();
}

process.once('exit', () => {
  if (isRunning()) {
    agentProcess.kill('SIGTERM');
  }
});
