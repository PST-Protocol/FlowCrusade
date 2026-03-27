import { Request, Response } from 'express';
import { FocusService } from '../services/focus.service';

/**
 * Controller for starting a focus session
 */
export const startFocusSession = async (req: Request, res: Response) => {
    try {
        // req.user is populated by the auth middleware
        const userId = (req as any).user.id;
        const { taskId } = req.body;

        const session = await FocusService.startSession(userId, taskId);

        return res.status(201).json({
            message: "Focus session started",
            session
        });

    } catch (error: any) {
        console.error("Error starting session:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Controller for ending a focus session
 */
export const endFocusSession = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { sessionId, distractions, status } = req.body;

        // Basic validation
        if (!sessionId || !status) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const result = await FocusService.endSession(userId, sessionId, distractions, status);

        // Return clean JSON for the frontend
        return res.status(200).json({
            message: "Focus session ended successfully",
            session: result.updatedSession,
            rewards: result.rewards,
            user: {
                xp: result.updatedUser.xp,
                level: result.updatedUser.level,
                coins: result.updatedUser.coins
            }
        });

    } catch (error: any) {
        console.error("Error ending session:", error);
        
        // Handle specific errors
        if (error.message === "Session not found" || error.message === "Unauthorized") {
            return res.status(404).json({ error: error.message });
        }

        return res.status(500).json({ error: "Internal Server Error" });
    }
};
