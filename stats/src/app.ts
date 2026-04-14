import express from 'express';
import cors from 'cors';

// Tracy's controllers
import { startFocusSession, endFocusSession } from './controllers/focus.controller';

// Stella's controllers
import { getNotes, createNote, deleteNote, updateNote } from './controllers/note.controller';
import { getTasks, getTaskById, createTask, updateTask, deleteTask } from './controllers/calendar.controller';
import { logEvent, getTimeline, getDistractionSummary } from './controllers/monitor.controller';

const app = express();
app.use(express.json());
app.use(cors());

// ==========================================
// Auth middleware (mock — replace with real auth later)
// ==========================================
const requireAuth = (req: any, res: any, next: any) => {
    req.user = { id: 1 };
    next();
};

// ==========================================
// Tracy's routes: Focus Sessions & Stats
// ==========================================
app.post('/focus/start', requireAuth, startFocusSession);
app.post('/focus/end', requireAuth, endFocusSession);
app.get('/stats/me/dashboard', requireAuth, (req, res) => {
    res.json({ message: "Dashboard stats goes here" });
});

// ==========================================
// Stella's routes: Quick Notes
// ==========================================
app.get('/notes', requireAuth, getNotes);
app.post('/notes', requireAuth, createNote);
app.put('/notes/:id', requireAuth, updateNote);
app.delete('/notes/:id', requireAuth, deleteNote);

// ==========================================
// Stella's routes: Calendar (Task scheduling)
// ==========================================
app.get('/calendar/tasks', requireAuth, getTasks);
app.get('/calendar/tasks/:id', requireAuth, getTaskById);
app.post('/calendar/tasks', requireAuth, createTask);
app.put('/calendar/tasks/:id', requireAuth, updateTask);
app.delete('/calendar/tasks/:id', requireAuth, deleteTask);

// ==========================================
// Stella's routes: Monitor (Activity timeline)
// ==========================================
app.post('/monitor/events', requireAuth, logEvent);
app.get('/monitor/timeline', requireAuth, getTimeline);
app.get('/monitor/distractions', requireAuth, getDistractionSummary);

// ==========================================
// Start server
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Flow Crusade Backend running on http://localhost:${PORT}`);
});

export default app;
