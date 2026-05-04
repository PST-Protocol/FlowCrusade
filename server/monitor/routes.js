import { Router } from 'express';
import { readPrivacyConfig, writePrivacyConfig, takePrivacySnapshot, isBlacklisted } from './privacy.js';
import { classify } from './classifier.js';
import { createSession, endSession, getActiveSession, updateSessionLastSeen, addMonitorEvent, getSessionEvents } from './store.js';
import { writeDistractionIncrement, writeFocusIncrement } from './statsBridge.js';
import { addClient, broadcast } from './stream.js';

const router = Router();

// SSE stream
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  addClient(res);
  res.write(`event: connected\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
});

// Get active session
router.get('/session/active', (req, res) => {
  const session = getActiveSession();
  res.json({ session });
});

// Start a new session
router.post('/session/start', (req, res) => {
  const { mode, linkedTaskId, linkedTaskTitle } = req.body ?? {};
  const privacySnapshot = takePrivacySnapshot();

  const session = createSession({
    mode: mode || 'standalone',
    linkedTaskId: linkedTaskId || null,
    linkedTaskTitle: linkedTaskTitle || null,
    privacySnapshot,
  });

  broadcast('monitor.session.started', {
    sessionId: session.sessionId,
    mode: session.mode,
    linkedTaskTitle: session.linkedTaskTitle,
    startTime: session.startTime,
  });

  res.json({ session });
});

// End a session
router.post('/session/end', async (req, res) => {
  const { sessionId } = req.body ?? {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  const ended = endSession(sessionId);
  if (!ended) return res.status(404).json({ error: 'Session not found' });

  broadcast('monitor.session.ended', {
    sessionId: ended.sessionId,
    endTime: ended.endTime,
    summary: ended.summary,
  });

  // Focus stats are already written incrementally per event; nothing extra needed here.

  res.json({ session: ended });
});

// Receive an activity event
router.post('/event', async (req, res) => {
  const { sessionId, appName, windowTitle, domain, timestamp, durationSeconds } = req.body ?? {};

  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  const session = getActiveSession();
  if (!session || session.sessionId !== sessionId) {
    return res.status(404).json({ error: 'No active session matches this sessionId' });
  }

  const eventPayload = { appName, windowTitle, domain, timestamp, durationSeconds };

  // Privacy filter
  if (isBlacklisted(eventPayload, session.privacySnapshot)) {
    console.log(`[monitor.privacy.skip] blacklisted activity skipped`);
    updateSessionLastSeen(sessionId);
    return res.json({ skipped: true });
  }

  // Classify
  const taskContext = session.linkedTaskTitle || null;
  const classResult = classify(eventPayload, taskContext);

  // Store event
  const monitorEvent = addMonitorEvent({
    sessionId,
    appName,
    windowTitle,
    domain,
    durationSeconds,
    timestamp,
    classification: classResult.classification,
    confidence: classResult.confidence,
    method: classResult.method,
    reason: classResult.reason,
  });

  // Update session heartbeat
  updateSessionLastSeen(sessionId);

  // Broadcast to frontend
  broadcast('monitor.event', monitorEvent);

  // Async: write stats (non-blocking) for focus and distraction events
  let statsWritten = false;
  if (classResult.classification === 'distraction') {
    statsWritten = await writeDistractionIncrement(monitorEvent, session).catch(() => false);
  } else if (classResult.classification === 'focus') {
    statsWritten = await writeFocusIncrement(monitorEvent, session).catch(() => false);
  }

  res.json({ monitorEvent, statsWritten });
});

// Get all events for a session
router.get('/events/:sessionId', (req, res) => {
  const events = getSessionEvents(req.params.sessionId);
  res.json({ events });
});

// Privacy config
router.get('/privacy/config', (req, res) => {
  res.json(readPrivacyConfig());
});

router.post('/privacy/config', (req, res) => {
  const { blockedApps, blockedDomains, blockedKeywords } = req.body ?? {};
  const config = {
    blockedApps: Array.isArray(blockedApps) ? blockedApps : [],
    blockedDomains: Array.isArray(blockedDomains) ? blockedDomains : [],
    blockedKeywords: Array.isArray(blockedKeywords) ? blockedKeywords : [],
  };
  writePrivacyConfig(config);
  res.json(config);
});

export default router;
