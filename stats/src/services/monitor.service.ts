import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const MonitorService = {
    /**
     * Log a monitor event (focus start, distraction detected, back to focus)
     */
    async logEvent(userId: number, data: {
        type: string;        // "focus" | "distract"
        description: string; // e.g. "Started Focus Session", "Distracted → Instagram (5m)"
        source?: string;     // e.g. "Instagram", "Email"
        durationSec?: number;
    }) {
        return await prisma.monitorEvent.create({
            data: {
                userId,
                type: data.type,
                description: data.description,
                source: data.source ?? null,
                durationSec: data.durationSec ?? null
            }
        });
    },

    /**
     * Get today's activity timeline for a user
     */
    async getTodayTimeline(userId: number) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        return await prisma.monitorEvent.findMany({
            where: {
                userId,
                createdAt: { gte: todayStart }
            },
            orderBy: { createdAt: 'asc' }
        });
    },

    /**
     * Get timeline for a specific date range
     */
    async getTimeline(userId: number, startDate: Date, endDate: Date) {
        return await prisma.monitorEvent.findMany({
            where: {
                userId,
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { createdAt: 'asc' }
        });
    },

    /**
     * Get distraction summary for today
     * Returns: total distraction count, total distraction time, top sources
     */
    async getDistractionSummary(userId: number) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const distractions = await prisma.monitorEvent.findMany({
            where: {
                userId,
                type: 'distract',
                createdAt: { gte: todayStart }
            }
        });

        const totalCount = distractions.length;
        const totalDurationSec = distractions.reduce((sum, d) => sum + (d.durationSec ?? 0), 0);

        // Count by source
        const sourceCounts: Record<string, number> = {};
        for (const d of distractions) {
            const src = d.source ?? 'Unknown';
            sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
        }
        const topSources = Object.entries(sourceCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([source, count]) => ({ source, count }));

        return {
            totalCount,
            totalDurationMinutes: Math.round(totalDurationSec / 60),
            topSources
        };
    }
};
