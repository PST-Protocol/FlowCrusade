import express from 'express';
import { startFocusSession, endFocusSession } from './controllers/focus.controller';

const app = express();
app.use(express.json());

const requireAuth = (req: any, res: any, next: any) => {
    req.user = { id: 1 };
    next();
};

app.post('/focus/start', requireAuth, startFocusSession);
app.post('/focus/end', requireAuth, endFocusSession);

app.get('/stats/me/dashboard', requireAuth, (req, res) => {
    res.json({ message: "Dashboard stats goes here" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 ADHD Productivity Backend running on http://localhost:${PORT}`);
});

export default app;
