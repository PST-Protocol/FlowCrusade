import { Request, Response } from 'express';
import { CalendarService } from '../services/calendar.service';

/**
 * GET /calendar/tasks — list all top-level tasks
 * Query params: ?year=2026&month=2 (optional, filters by month)
 */
export const getTasks = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { year, month } = req.query;

        let tasks;
        if (year && month) {
            tasks = await CalendarService.getTasksByMonth(
                userId,
                parseInt(year as string, 10),
                parseInt(month as string, 10)
            );
        } else {
            tasks = await CalendarService.getTasks(userId);
        }

        return res.status(200).json({ tasks });
    } catch (error: any) {
        console.error("Error fetching tasks:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * GET /calendar/tasks/:id — get a single task with subtasks
 */
export const getTaskById = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const taskId = parseInt(req.params.id, 10);

        if (isNaN(taskId)) {
            return res.status(400).json({ error: "Invalid task ID" });
        }

        const task = await CalendarService.getTaskById(userId, taskId);
        return res.status(200).json({ task });
    } catch (error: any) {
        if (error.message === "Task not found") {
            return res.status(404).json({ error: error.message });
        }
        if (error.message === "Unauthorized") {
            return res.status(403).json({ error: error.message });
        }
        console.error("Error fetching task:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * POST /calendar/tasks — create a new task
 * Body: { title: string, description?: string, dueDate?: string }
 */
export const createTask = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { title, description, dueDate } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: "Task title is required" });
        }

        const task = await CalendarService.createTask(userId, title.trim(), description, dueDate);
        return res.status(201).json({ message: "Task created", task });
    } catch (error: any) {
        console.error("Error creating task:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * PUT /calendar/tasks/:id — update a task
 * Body: { title?, description?, dueDate?, isCompleted? }
 */
export const updateTask = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const taskId = parseInt(req.params.id, 10);

        if (isNaN(taskId)) {
            return res.status(400).json({ error: "Invalid task ID" });
        }

        const task = await CalendarService.updateTask(userId, taskId, req.body);
        return res.status(200).json({ message: "Task updated", task });
    } catch (error: any) {
        if (error.message === "Task not found") {
            return res.status(404).json({ error: error.message });
        }
        if (error.message === "Unauthorized") {
            return res.status(403).json({ error: error.message });
        }
        console.error("Error updating task:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * DELETE /calendar/tasks/:id — delete a task and its subtasks
 */
export const deleteTask = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const taskId = parseInt(req.params.id, 10);

        if (isNaN(taskId)) {
            return res.status(400).json({ error: "Invalid task ID" });
        }

        await CalendarService.deleteTask(userId, taskId);
        return res.status(200).json({ message: "Task deleted" });
    } catch (error: any) {
        if (error.message === "Task not found") {
            return res.status(404).json({ error: error.message });
        }
        if (error.message === "Unauthorized") {
            return res.status(403).json({ error: error.message });
        }
        console.error("Error deleting task:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
