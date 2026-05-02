import { INITIAL_EVENTS, INITIAL_TASKS, DEFAULT_NOTES } from '../data/initialData';

export function loadEvents() {
  try {
    const saved = localStorage.getItem('fc_events');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return INITIAL_EVENTS;
}

export function loadTasks() {
  try {
    const saved = localStorage.getItem('fc_tasks');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return INITIAL_TASKS;
}

export function loadNotes() {
  try {
    const saved = localStorage.getItem('fc_notes');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return DEFAULT_NOTES;
}


export function loadHistory() {
  try {
    const saved = localStorage.getItem('fc_task_history');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return [];
}

export function loadSettings() {
  try {
    const saved = localStorage.getItem('fc_settings');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return {
    theme: 'light',
    monitorEnabled: true,
    distractThreshold: 5,
    notifications: true
  };
}
