import { execFile } from 'node:child_process';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const API_BASE = process.env.API_BASE || 'http://localhost:8787';
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 2_000;
const MIN_REPORT_SECONDS = Number(process.env.MIN_REPORT_SECONDS) || 2;
const REPORT_CHUNK_SECONDS = Number(process.env.REPORT_CHUNK_SECONDS) || 5;
const IDLE_BUFFER_SECONDS = 5 * 60;
const CLI_ARGS = new Set(process.argv.slice(2));
const PROBE_MODE = CLI_ARGS.has('--probe');

function compactUnique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

const WINDOWS_POWERSHELL_CANDIDATES = compactUnique([
  process.env.POWERSHELL_PATH,
  process.env.SystemRoot || process.env.SYSTEMROOT
    ? `${process.env.SystemRoot || process.env.SYSTEMROOT}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
    : '',
  'powershell.exe',
  'pwsh.exe',
]);

const WINDOWS_ACTIVE_WINDOW_SCRIPT = String.raw`
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class FlowCrusadeForegroundWindow {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$hwnd = [FlowCrusadeForegroundWindow]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) {
  throw "No foreground window is available"
}

$titleBuilder = New-Object System.Text.StringBuilder 1024
[void][FlowCrusadeForegroundWindow]::GetWindowText($hwnd, $titleBuilder, $titleBuilder.Capacity)

[uint32]$processId = 0
[void][FlowCrusadeForegroundWindow]::GetWindowThreadProcessId($hwnd, [ref]$processId)
$processInfo = Get-Process -Id $processId -ErrorAction SilentlyContinue
$appName = if ($processInfo) { $processInfo.ProcessName } else { "Unknown" }
$path = ""
try {
  if ($processInfo -and $processInfo.Path) {
    $path = $processInfo.Path
  }
} catch {}

[pscustomobject]@{
  appName = $appName
  windowTitle = $titleBuilder.ToString()
  domain = ""
  processId = $processId
  executablePath = $path
} | ConvertTo-Json -Compress
`;

const WINDOWS_IDLE_SCRIPT = String.raw`
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class FlowCrusadeIdleTime {
  [StructLayout(LayoutKind.Sequential)]
  public struct LASTINPUTINFO {
    public uint cbSize;
    public uint dwTime;
  }

  [DllImport("user32.dll")]
  public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

  [DllImport("kernel32.dll")]
  public static extern uint GetTickCount();
}
"@

$lastInput = New-Object FlowCrusadeIdleTime+LASTINPUTINFO
$lastInput.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($lastInput)
if (-not [FlowCrusadeIdleTime]::GetLastInputInfo([ref]$lastInput)) {
  0
  exit
}

$currentTick = [int64][FlowCrusadeIdleTime]::GetTickCount()
$lastTick = [int64]$lastInput.dwTime
$elapsedMs = $currentTick - $lastTick
if ($elapsedMs -lt 0) {
  $elapsedMs += [int64][uint32]::MaxValue + 1
}
[Math]::Floor($elapsedMs / 1000)
`;

const WINDOWS_PROCESS_LABELS = {
  applicationframehost: 'Windows App',
  brave: 'Brave',
  chrome: 'Google Chrome',
  code: 'Visual Studio Code',
  cursor: 'Cursor',
  devenv: 'Visual Studio',
  excel: 'Microsoft Excel',
  firefox: 'Firefox',
  msedge: 'Microsoft Edge',
  notepad: 'Notepad',
  notepadplusplus: 'Notepad++',
  onenote: 'Microsoft OneNote',
  outlook: 'Microsoft Outlook',
  powerpnt: 'Microsoft PowerPoint',
  powershell: 'PowerShell',
  slack: 'Slack',
  teams: 'Microsoft Teams',
  vivaldi: 'Vivaldi',
  windowsterminal: 'Windows Terminal',
  winword: 'Microsoft Word',
  wt: 'Windows Terminal',
};

const BROWSER_APP_PATTERNS = [
  'brave',
  'chrome',
  'edge',
  'firefox',
  'google chrome',
  'microsoft edge',
  'opera',
  'vivaldi',
];

const TITLE_DOMAIN_HINTS = [
  ['youtube', 'youtube.com'],
  ['reddit', 'reddit.com'],
  ['instagram', 'instagram.com'],
  ['tiktok', 'tiktok.com'],
  ['facebook', 'facebook.com'],
  ['twitter', 'twitter.com'],
  ['x.com', 'x.com'],
  ['netflix', 'netflix.com'],
  ['twitch', 'twitch.tv'],
  ['github', 'github.com'],
  ['stack overflow', 'stackoverflow.com'],
  ['stackoverflow', 'stackoverflow.com'],
  ['google docs', 'docs.google.com'],
  ['google sheets', 'sheets.google.com'],
  ['google slides', 'docs.google.com'],
  ['gmail', 'gmail.com'],
  ['notion', 'notion.so'],
  ['figma', 'figma.com'],
  ['linear', 'linear.app'],
  ['jira', 'jira.atlassian.com'],
  ['canvas', 'canvas.instructure.com'],
  ['coursera', 'coursera.org'],
  ['udemy', 'udemy.com'],
  ['edx', 'edx.org'],
];

function parseJsonObject(output) {
  const text = String(output || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error(`PowerShell returned non-JSON output: ${text.slice(0, 160)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function runPowerShell(script) {
  let lastLaunchError = null;
  for (const shellPath of WINDOWS_POWERSHELL_CANDIDATES) {
    try {
      const { stdout } = await execFileAsync(
        shellPath,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { windowsHide: true, maxBuffer: 1024 * 1024 }
      );
      return stdout.trim();
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'EPERM') {
        lastLaunchError = err;
        continue;
      }
      const stderr = String(err.stderr || '').trim();
      throw new Error(`${shellPath}: ${stderr || err.message}`);
    }
  }
  throw new Error(
    `No PowerShell executable could be started. Tried: ${WINDOWS_POWERSHELL_CANDIDATES.join(', ')}. ${lastLaunchError?.message || ''}`
  );
}

async function runAppleScript(script) {
  const { stdout } = await execFileAsync('osascript', ['-e', script]);
  return stdout.trim();
}

function extractDomain(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function getMacIdleSeconds() {
  try {
    const { stdout } = await execFileAsync('ioreg', ['-c', 'IOHIDSystem']);
    const match = stdout.match(/HIDIdleTime[^=]+=\s*(\d+)/);
    if (match) return Math.floor(Number(match[1]) / 1_000_000_000);
  } catch {
    return 0;
  }
  return 0;
}

async function isMacScreenLocked(idleSeconds = null) {
  try {
    const result = await runAppleScript(
      'tell application "System Events" to get running of screen saver'
    );
    if (result === 'true') return true;
  } catch {
    // Fall back to idle time below.
  }
  const idle = idleSeconds ?? await getMacIdleSeconds();
  return idle > 600;
}

async function getMacActiveAppName() {
  return runAppleScript(
    'tell application "System Events" to get name of first application process whose frontmost is true'
  );
}

async function getMacActiveWindowTitle(appName) {
  try {
    return await runAppleScript(
      `tell application "System Events" to tell process "${appName}" to get name of first window`
    );
  } catch {
    return '';
  }
}

async function getMacBrowserDomain(appName) {
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
  } catch {
    return '';
  }
  return '';
}

async function getMacActiveWindow() {
  const appName = await getMacActiveAppName();
  const [windowTitle, domain] = await Promise.all([
    getMacActiveWindowTitle(appName),
    getMacBrowserDomain(appName),
  ]);
  return { appName, windowTitle, domain };
}

function normalizeWindowsAppName(appName) {
  const rawName = String(appName || '').trim();
  const key = rawName.toLowerCase();
  return WINDOWS_PROCESS_LABELS[key] || rawName || 'Unknown';
}

function isBrowserApp(appName) {
  const lower = String(appName || '').toLowerCase();
  return BROWSER_APP_PATTERNS.some((pattern) => lower.includes(pattern));
}

function inferDomainFromWindowTitle(appName, windowTitle) {
  if (!isBrowserApp(appName)) return '';

  const title = String(windowTitle || '');
  const urlMatch = title.match(/\bhttps?:\/\/[^\s"'<>()]+/i);
  if (urlMatch) return extractDomain(urlMatch[0]);

  const domainMatch = title.match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/?#:]|\b)/i);
  if (domainMatch) return domainMatch[1].replace(/^www\./, '').toLowerCase();

  const lowerTitle = title.toLowerCase();
  for (const [hint, domain] of TITLE_DOMAIN_HINTS) {
    if (lowerTitle.includes(hint)) return domain;
  }

  return '';
}

async function getWindowsIdleSeconds() {
  try {
    const result = await runPowerShell(WINDOWS_IDLE_SCRIPT);
    const seconds = Number.parseInt(result, 10);
    return Number.isFinite(seconds) ? seconds : 0;
  } catch {
    return 0;
  }
}

async function isWindowsScreenLocked(idleSeconds = null) {
  const idle = idleSeconds ?? await getWindowsIdleSeconds();
  return idle > 600;
}

function isWindowsLockWindow(win) {
  const appName = String(win?.appName || '').toLowerCase();
  const title = String(win?.windowTitle || '').toLowerCase();
  return (
    appName.includes('lockapp') ||
    appName.includes('logonui') ||
    title.includes('windows default lock screen') ||
    title.includes('windows spotlight')
  );
}

async function getWindowsActiveWindow() {
  const win = parseJsonObject(await runPowerShell(WINDOWS_ACTIVE_WINDOW_SCRIPT));
  const appName = normalizeWindowsAppName(win.appName);
  const windowTitle = String(win.windowTitle || '').trim();
  const domain = inferDomainFromWindowTitle(appName, windowTitle);
  return { appName, windowTitle, domain };
}

function createPlatformMonitor() {
  if (process.platform === 'darwin') {
    return {
      name: 'macOS',
      getActiveWindow: getMacActiveWindow,
      getIdleSeconds: getMacIdleSeconds,
      isLockWindow: () => false,
      isScreenLocked: isMacScreenLocked,
    };
  }

  if (process.platform === 'win32') {
    return {
      name: 'Windows',
      getActiveWindow: getWindowsActiveWindow,
      getIdleSeconds: getWindowsIdleSeconds,
      isLockWindow: isWindowsLockWindow,
      isScreenLocked: isWindowsScreenLocked,
    };
  }

  throw new Error(`Desktop monitor is only supported on macOS and Windows. Current platform: ${process.platform}`);
}

async function getProbeSnapshot(platformMonitor) {
  const idleSeconds = await platformMonitor.getIdleSeconds();
  const win = await platformMonitor.getActiveWindow();
  const locked = await platformMonitor.isScreenLocked(idleSeconds) || platformMonitor.isLockWindow(win);
  return {
    ok: true,
    platform: process.platform,
    platformLabel: platformMonitor.name,
    timestamp: new Date().toISOString(),
    idleSeconds,
    locked,
    activeWindow: win,
    apiBase: API_BASE,
  };
}

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

async function main() {
  const platformMonitor = createPlatformMonitor();
  if (PROBE_MODE) {
    const snapshot = await getProbeSnapshot(platformMonitor);
    console.log(JSON.stringify(snapshot));
    return;
  }

  console.log(`[monitor] Desktop monitor agent starting (${platformMonitor.name})`);
  console.log(`[monitor] API: ${API_BASE} | Poll: ${POLL_INTERVAL_MS / 1000}s | Min report: ${MIN_REPORT_SECONDS}s | Live chunk: ${REPORT_CHUNK_SECONDS}s | Idle cap: ${IDLE_BUFFER_SECONDS / 60}min`);

  let session = null;
  let currentWindow = null;
  let windowStartTime = null;
  let lastActiveAt = null;
  let polling = false;

  async function reportWindow(win, startTime, endTime) {
    const durationSeconds = Math.floor((endTime - startTime) / 1000);
    if (durationSeconds < MIN_REPORT_SECONDS) {
      console.log(`[monitor] Skip ${win.appName} - only ${durationSeconds}s (< ${MIN_REPORT_SECONDS}s threshold)`);
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
      console.log(`[monitor] Reported ${win.appName}${win.domain ? ` [${win.domain}]` : ''} - ${durationSeconds}s -> ${monitorEvent?.classification}`);
    } catch (err) {
      console.error(`[monitor] Failed to report event: ${err.message}`);
      if (err.message.includes('404') || err.message.includes('Session not found')) {
        console.log('[monitor] Session ended externally - waiting for new session');
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
    if (polling) return;
    polling = true;

    try {
      const now = Date.now();

      if (!session) {
        try {
          session = await getActiveSession();
        } catch {
          console.error('[monitor] Cannot reach backend, will retry.');
          return;
        }
        if (!session) {
          console.log('[monitor] No active session - open the Monitor panel in the app and enable it.');
          return;
        }
        console.log(`[monitor] Session found: ${session.sessionId.slice(0, 8)}...`);
        currentWindow = null;
        windowStartTime = null;
        lastActiveAt = now;
      }

      const idleSeconds = await platformMonitor.getIdleSeconds();
      const locked = await platformMonitor.isScreenLocked(idleSeconds);
      if (locked) {
        if (currentWindow) {
          console.log('[monitor] Screen appears locked - flushing current window.');
          await flushCurrentWindow();
        }
        return;
      }

      if (idleSeconds < IDLE_BUFFER_SECONDS) {
        lastActiveAt = now;
      }

      let win;
      try {
        win = await platformMonitor.getActiveWindow();
      } catch (err) {
        console.error(`[monitor] Could not read active window: ${err.message}`);
        return;
      }

      if (platformMonitor.isLockWindow(win)) {
        if (currentWindow) {
          console.log('[monitor] Lock screen detected - flushing current window.');
          await flushCurrentWindow();
        }
        return;
      }

      const changed =
        !currentWindow ||
        win.appName !== currentWindow.appName ||
        win.windowTitle !== currentWindow.windowTitle;

      if (changed) {
        if (currentWindow && windowStartTime) {
          const effectiveEnd = lastActiveAt || now;
          await reportWindow(currentWindow, windowStartTime, effectiveEnd);
        }
        currentWindow = win;
        windowStartTime = now;
        lastActiveAt = idleSeconds < IDLE_BUFFER_SECONDS ? now : null;
        const domainStr = win.domain ? ` [${win.domain}]` : '';
        console.log(`[monitor] Active: ${win.appName}${domainStr}`);
        return;
      }

      if (currentWindow && windowStartTime) {
        const effectiveEnd = lastActiveAt || now;
        const durationSeconds = Math.floor((effectiveEnd - windowStartTime) / 1000);
        if (durationSeconds >= Math.max(MIN_REPORT_SECONDS, REPORT_CHUNK_SECONDS)) {
          await reportWindow(currentWindow, windowStartTime, effectiveEnd);
          windowStartTime = effectiveEnd;
          lastActiveAt = idleSeconds < IDLE_BUFFER_SECONDS ? now : effectiveEnd;
        }
      }
    } finally {
      polling = false;
    }
  }

  async function shutdown() {
    console.log('\n[monitor] Shutting down - flushing last window...');
    await flushCurrentWindow();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await poll();
  setInterval(poll, POLL_INTERVAL_MS);
}

main().catch((err) => {
  if (PROBE_MODE) {
    console.error(JSON.stringify({
      ok: false,
      platform: process.platform,
      timestamp: new Date().toISOString(),
      error: err.message,
    }));
  } else {
    console.error('[monitor] Fatal:', err.message);
  }
  process.exit(1);
});
