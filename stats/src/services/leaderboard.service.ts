import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const LeaderboardService = {
    async getGlobalLeaderboard() {
        const topUsers = await prisma.user.findMany({
            take: 50,
            orderBy: { xp: 'desc' },
            select: { id: true, username: true, level: true, xp: true, currentStreak: true }
        });
        return topUsers.map((user, index) => ({ rank: index + 1, ...user }));
    },

    async getFriendsLeaderboard(userId: number) {
        const friendships = await prisma.friendship.findMany({
            where: {
                status: 'ACCEPTED',
                OR: [{ userId: userId }, { friendId: userId }]
            },
            include: {
                user: { select: { id: true, username: true, level: true, xp: true } },
                friend: { select: { id: true, username: true, level: true, xp: true } }
            }
        });

        const friendsList = friendships.map(f => f.userId === userId ? f.friend : f.user);
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, level: true, xp: true }
        });

        if (currentUser) friendsList.push(currentUser);
        friendsList.sort((a, b) => b.xp - a.xp);

        return friendsList.map((user, index) => ({ rank: index + 1, ...user }));
    }
};
