import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const CalendarService = {
    /**
     * Get all top-level tasks for a user (no parentId), ordered by dueDate
     */
    async getTasks(userId: number) {
        return await prisma.task.findMany({
            where: { userId, parentId: null },
            include: { subTasks: true },
            orderBy: { dueDate: 'asc' }
        });
    },

    /**
     * Get tasks for a specific month (e.g. 2026-02)
     */
    async getTasksByMonth(userId: number, year: number, month: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // last day of month

        return await prisma.task.findMany({
            where: {
                userId,
                parentId: null,
                dueDate: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: { subTasks: true },
            orderBy: { dueDate: 'asc' }
        });
    },

    /**
     * Create a new task with optional dueDate
     */
    async createTask(userId: number, title: string, description?: string, dueDate?: string) {
        return await prisma.task.create({
            data: {
                userId,
                title,
                description: description ?? null,
                dueDate: dueDate ? new Date(dueDate) : null
            }
        });
    },

    /**
     * Update a task (title, description, dueDate, isCompleted)
     */
    async updateTask(userId: number, taskId: number, data: {
        title?: string;
        description?: string;
        dueDate?: string | null;
        isCompleted?: boolean;
    }) {
        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) throw new Error("Task not found");
        if (task.userId !== userId) throw new Error("Unauthorized");

        return await prisma.task.update({
            where: { id: taskId },
            data: {
                ...(data.title !== undefined && { title: data.title }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
                ...(data.isCompleted !== undefined && { isCompleted: data.isCompleted }),
            },
            include: { subTasks: true }
        });
    },

    /**
     * Delete a task and all its subtasks
     */
    async deleteTask(userId: number, taskId: number) {
        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) throw new Error("Task not found");
        if (task.userId !== userId) throw new Error("Unauthorized");

        // Delete subtasks first, then the parent
        await prisma.task.deleteMany({ where: { parentId: taskId } });
        return await prisma.task.delete({ where: { id: taskId } });
    },

    /**
     * Get a single task with its full subtask tree
     */
    async getTaskById(userId: number, taskId: number) {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                subTasks: {
                    include: {
                        subTasks: true // 2 levels deep
                    }
                }
            }
        });
        if (!task) throw new Error("Task not found");
        if (task.userId !== userId) throw new Error("Unauthorized");
        return task;
    }
};
