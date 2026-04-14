import { Request, Response } from 'express';
import { MonitorService } from '../services/monitor.service';

/**
 * POST /monitor/events — log a focus or distraction event
 * Body: { type: "focus"|"distract", description: string, source?: string, durationSec?: number }
 */
export const logEvent = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { type, description, source, durationSec } = req.body;

        if (!type || !['focus', 'distract'].includes(type)) {
            return res.status(400).json({ error: "type must be 'focus' or 'distract'" });
        }
        if (!description) {
            return res.status(400).json({ error: "description is required" });
        }

        const event = await MonitorService.logEvent(userId, {
            type, description, source, durationSec
        });

        return res.status(201).json({ message: "Event logged", event });
    } catch (error: any) {
        console.error("Error logging event:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * GET /monitor/timeline — get today's activity timeline
 * Query params: ?startDate=2026-02-25&endDate=2026-02-25 (optional)
 */
export const getTimeline = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { startDate, endDate } = req.query;

        let events;
        if (startDate && endDate) {
            events = await MonitorService.getTimeline(
                userId,
                new Date(startDate as string),
                new Date(endDate as string)
            );
        } else {
            events = await MonitorService.getTodayTimeline(userId);
        }

        return res.status(200).json({ events });
    } catch (error: any) {
        console.error("Error fetching timeline:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * GET /monitor/distractions — get today's distraction summary
 */
export const getDistractionSummary = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const summary = await MonitorService.getDistractionSummary(userId);

        return res.status(200).json(summary);
    } catch (error: any) {
        console.error("Error fetching distraction summary:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
