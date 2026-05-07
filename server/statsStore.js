import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const STATS_FILE = path.join(__dirname, 'data', 'stats.json');

export function ensureStatsFile() {
  const dataDir = path.dirname(STATS_FILE);
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(STATS_FILE)) {
    fs.writeFileSync(
      STATS_FILE,
      JSON.stringify({ focusSessions: [], completedTasks: [], distractionEvents: [] }, null, 2),
      'utf8'
    );
  }
}

export function readStatsData() {
  ensureStatsFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    return {
      focusSessions: Array.isArray(parsed.focusSessions) ? parsed.focusSessions : [],
      completedTasks: Array.isArray(parsed.completedTasks) ? parsed.completedTasks : [],
      distractionEvents: Array.isArray(parsed.distractionEvents) ? parsed.distractionEvents : [],
    };
  } catch {
    return { focusSessions: [], completedTasks: [], distractionEvents: [] };
  }
}

export function writeStatsData(data) {
  ensureStatsFile();
  fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function isSameLocalDay(iso, date = new Date()) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}

export function getDayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function computeStreak(focusSessions = []) {
  const activeDays = new Set(
    focusSessions.map((s) => getDayKey(s.endedAt || s.startedAt)).filter(Boolean)
  );
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  while (true) {
    const key = getDayKey(cursor.toISOString());
    if (!activeDays.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computePeakFocusTime(focusSessions = []) {
  const buckets = new Array(24).fill(0);
  focusSessions.forEach((s) => {
    const d = new Date(s.endedAt || s.startedAt);
    if (!Number.isNaN(d.getTime())) buckets[d.getHours()] += toSafeNumber(s.minutes);
  });
  const max = Math.max(...buckets);
  if (max <= 0) return '';
  const hour = buckets.findIndex((v) => v === max);
  return `${String(hour).padStart(2, '0')}:00 - ${String((hour + 1) % 24).padStart(2, '0')}:00`;
}

export function computeStats(data) {
  const today = new Date();
  const todayFocus = data.focusSessions.filter((s) => isSameLocalDay(s.endedAt || s.startedAt, today));
  const todayCompleted = data.completedTasks.filter((t) => isSameLocalDay(t.completedAt, today));
  const todayDistractions = data.distractionEvents.filter((e) => isSameLocalDay(e.timestamp, today));

  const focusTimeToday = todayFocus.reduce((sum, s) => sum + toSafeNumber(s.minutes), 0);
  const taskCompletionMinutes = todayCompleted.reduce((sum, t) => sum + toSafeNumber(t.estimatedMinutes, 10), 0);
  const distractTime = todayDistractions.reduce((sum, e) => sum + toSafeNumber(e.minutes), 0);
  const weightedCredit = Math.round(focusTimeToday * 0.6 + taskCompletionMinutes * 0.4);

  const sourceMinutes = new Map();
  todayDistractions.forEach((e) => {
    const src = e.appName || e.source || 'Unknown';
    sourceMinutes.set(src, (sourceMinutes.get(src) || 0) + toSafeNumber(e.minutes));
  });
  const topDistractions = Array.from(sourceMinutes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([src]) => src);

  const completionRate =
    todayCompleted.length || todayFocus.length
      ? Math.round((todayCompleted.length / Math.max(1, todayCompleted.length + todayFocus.length)) * 100)
      : 0;

  return {
    focusTimeToday,
    taskCompletionMinutes,
    weightedCredit,
    focusScore: weightedCredit,
    sessions: todayFocus.length,
    avgSession: todayFocus.length ? Math.round(focusTimeToday / todayFocus.length) : 0,
    completionRate,
    topDistractions,
    distractCount: todayDistractions.length,
    distractTime,
    peakFocusTime: computePeakFocusTime(todayFocus),
    streak: computeStreak(data.focusSessions),
    maxScore: 1000,
    raw: {
      focusSessions: data.focusSessions,
      completedTasks: data.completedTasks,
      distractionEvents: data.distractionEvents,
    },
  };
}

export function addDistractionEvent({ appName, minutes, timestamp, sessionId }) {
  const data = readStatsData();
  data.distractionEvents.push({
    id: crypto.randomUUID(),
    appName: appName || 'Unknown',
    minutes: Math.max(1, toSafeNumber(minutes, 1)),
    timestamp: timestamp || new Date().toISOString(),
    ...(sessionId ? { sessionId } : {}),
  });
  writeStatsData(data);
  return computeStats(data);
}

export function addFocusSession({ taskId, taskTitle, minutes, startedAt, endedAt, sessionId }) {
  const data = readStatsData();
  data.focusSessions.push({
    id: crypto.randomUUID(),
    taskId: taskId || 'standalone',
    taskTitle: taskTitle || 'Standalone Focus Session',
    minutes: Math.max(0, toSafeNumber(minutes, 0)),
    startedAt: startedAt || new Date().toISOString(),
    endedAt: endedAt || new Date().toISOString(),
    ...(sessionId ? { sessionId } : {}),
  });
  writeStatsData(data);
  return computeStats(data);
}
