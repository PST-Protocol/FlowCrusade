import { addDistractionEvent, addFocusSession } from '../statsStore.js';
import { broadcast } from './stream.js';

export async function writeDistractionIncrement(monitorEvent, session) {
  try {
    const minutes = Math.max(1, Math.ceil((monitorEvent.durationSeconds || 0) / 60));
    const updatedStats = addDistractionEvent({
      appName: monitorEvent.appName,
      minutes,
      timestamp: monitorEvent.timestamp,
      sessionId: monitorEvent.sessionId,
    });
    broadcast('stats.updated', updatedStats);
    return true;
  } catch (err) {
    console.error('[statsBridge.distraction.failed]', err.message);
    return false;
  }
}

export async function writeFocusIncrement(monitorEvent, session) {
  try {
    const minutes = Math.max(1, Math.ceil((monitorEvent.durationSeconds || 0) / 60));
    const updatedStats = addFocusSession({
      taskId: session.linkedTaskId || 'standalone',
      taskTitle: session.linkedTaskTitle || 'Standalone Focus Session',
      minutes,
      startedAt: monitorEvent.timestamp,
      endedAt: monitorEvent.timestamp,
      sessionId: monitorEvent.sessionId,
    });
    broadcast('stats.updated', updatedStats);
    return true;
  } catch (err) {
    console.error('[statsBridge.focus.failed]', err.message);
    return false;
  }
}
