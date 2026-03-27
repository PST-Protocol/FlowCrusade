import { PrismaClient } from '@prisma/client';
import { calculateSessionRewards, calculateLevel } from '../utils/gamification';

const prisma = new PrismaClient();

export const FocusService = {
    async startSession(userId: number, taskId?: number) {
        return await prisma.focusSession.create({
            data: { userId, taskId, status: 'ONGOING', startTime: new Date() }
        });
    },

    async endSession(userId: number, sessionId: number, distractions: number, status: 'COMPLETED' | 'INTERRUPTED') {
        const session = await prisma.focusSession.findUnique({ where: { id: sessionId } });
        if (!session) throw new Error("Session not found");
        if (session.userId !== userId) throw new Error("Unauthorized");
        if (session.status !== 'ONGOING') throw new Error("Session already ended");

        const endTime = new Date();
        const durationMinutes = Math.floor((endTime.getTime() - session.startTime.getTime()) / (1000 * 60));
        const rewards = calculateSessionRewards(durationMinutes, status === 'INTERRUPTED');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return await prisma.$transaction(async (tx) => {
            const updatedSession = await tx.focusSession.update({
                where: { id: sessionId },
                data: { endTime, durationMinutes, distractions, status }
            });

            const user = await tx.user.findUnique({ where: { id: userId } });
            if (!user) throw new Error("User not found");

            const newXp = user.xp + rewards.xp;
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: { xp: newXp, coins: { increment: rewards.coins }, level: calculateLevel(newXp) }
            });

            if (rewards.xp > 0 || rewards.coins > 0) {
                await tx.userReward.create({
                    data: { userId, source: 'FOCUS_SESSION', xpAwarded: rewards.xp, coinsAwarded: rewards.coins }
                });
            }

            await tx.userStatsDaily.upsert({
                where: { userId_date: { userId, date: today } },
                update: { focusMinutes: { increment: durationMinutes }, sessionsCount: { increment: 1 }, distractions: { increment: distractions } },
                create: { userId, date: today, focusMinutes: durationMinutes, sessionsCount: 1, distractions, tasksCompleted: 0 }
            });

            return { updatedSession, updatedUser, rewards };
        });
    }
};
