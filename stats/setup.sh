#!/bin/bash

echo "🚀 开始生成 ADHD 效率平台后端项目结构和文件..."

# 创建文件夹结构
mkdir -p src/controllers src/services src/utils prisma

# ==========================================
# 1. 生成 README.md
# ==========================================
echo "📄 生成 README.md..."
cat << 'EOF' > README.md
# ADHD Productivity Platform - Backend Architecture

## 📁 6. Backend Structure
src/
├── prisma/               # Prisma client instantiation
├── routes/               # Express route definitions
├── controllers/          # HTTP Layer
├── services/             # Business Logic Layer
├── utils/                # Helper functions
└── app.ts                # Main Express application setup

## 🔌 4. API Design & 🔗 7. Frontend Integration
### Focus & Stats (Example Integration)
**Endpoint:** `POST /focus/start`
**Endpoint:** `POST /focus/end`
EOF

# ==========================================
# 2. 生成 prisma/schema.prisma
# ==========================================
echo "📄 生成 prisma/schema.prisma..."
cat << 'EOF' > prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            Int      @id @default(autoincrement())
  email         String   @unique
  passwordHash  String
  username      String   @unique
  level         Int      @default(1)
  xp            Int      @default(0)
  coins         Int      @default(0)
  currentStreak Int      @default(0)
  highestStreak Int      @default(0)
  createdAt     DateTime @default(now())

  tasks               Task[]
  focusSessions       FocusSession[]
  dailyStats          UserStatsDaily[]
  rewards             UserReward[]
  leaderboardScores   LeaderboardScore[]
  friendsAdded        Friendship[] @relation("UserFriends")
  friendsAddedBy      Friendship[] @relation("FriendUsers")
}

model Task {
  id          Int      @id @default(autoincrement())
  userId      Int
  title       String
  isCompleted Boolean  @default(false)
  parentId    Int?
  parent      Task?    @relation("SubTasks", fields: [parentId], references: [id])
  subTasks    Task[]   @relation("SubTasks")
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
  sessions    FocusSession[]
}

model FocusSession {
  id              Int      @id @default(autoincrement())
  userId          Int
  taskId          Int?
  startTime       DateTime @default(now())
  endTime         DateTime?
  durationMinutes Int      @default(0)
  distractions    Int      @default(0)
  status          String   @default("ONGOING")
  user            User     @relation(fields: [userId], references: [id])
  task            Task?    @relation(fields: [taskId], references: [id])
}

model UserStatsDaily {
  id             Int      @id @default(autoincrement())
  userId         Int
  date           DateTime @db.Date
  focusMinutes   Int      @default(0)
  sessionsCount  Int      @default(0)
  tasksCompleted Int      @default(0)
  distractions   Int      @default(0)
  user           User     @relation(fields: [userId], references: [id])
  @@unique([userId, date])
}

model UserReward {
  id           Int      @id @default(autoincrement())
  userId       Int
  source       String
  xpAwarded    Int      @default(0)
  coinsAwarded Int      @default(0)
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id])
}

model Friendship {
  id        Int      @id @default(autoincrement())
  userId    Int
  friendId  Int
  status    String   @default("PENDING")
  createdAt DateTime @default(now())
  user      User     @relation("UserFriends", fields: [userId], references: [id])
  friend    User     @relation("FriendUsers", fields: [friendId], references: [id])
  @@unique([userId, friendId])
}

model LeaderboardScore {
  id             Int      @id @default(autoincrement())
  userId         Int
  weekStartDate  DateTime @db.Date
  xpEarned       Int      @default(0)
  rank           Int?
  user           User     @relation(fields: [userId], references: [id])
  @@unique([userId, weekStartDate])
}
EOF

# ==========================================
# 3. 生成 src/app.ts
# ==========================================
echo "📄 生成 src/app.ts..."
cat << 'EOF' > src/app.ts
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
EOF

# ==========================================
# 4. 生成 src/utils/gamification.ts
# ==========================================
echo "📄 生成 src/utils/gamification.ts..."
cat << 'EOF' > src/utils/gamification.ts
const XP_PER_SESSION = 10;
const XP_PER_TASK = 15;
const XP_PER_SUBTASK = 8;
const COINS_PER_10_MINUTES = 5;

export const calculateSessionRewards = (durationMinutes: number, isInterrupted: boolean) => {
    if (isInterrupted) return { xp: 0, coins: 0 };
    const xp = XP_PER_SESSION;
    const coinIntervals = Math.floor(durationMinutes / 10);
    const coins = coinIntervals * COINS_PER_10_MINUTES;
    return { xp, coins };
};

export const calculateLevel = (totalXp: number): number => {
    if (totalXp < 0) return 1;
    return Math.floor(Math.sqrt(totalXp / 100)) + 1;
};

export const hasLeveledUp = (oldXp: number, newXp: number): boolean => {
    return calculateLevel(newXp) > calculateLevel(oldXp);
};
EOF

# ==========================================
# 5. 生成 src/services/focus.service.ts
# ==========================================
echo "📄 生成 src/services/focus.service.ts..."
cat << 'EOF' > src/services/focus.service.ts
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
EOF

# ==========================================
# 6. 生成 src/controllers/focus.controller.ts
# ==========================================
echo "📄 生成 src/controllers/focus.controller.ts..."
cat << 'EOF' > src/controllers/focus.controller.ts
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
EOF

# ==========================================
# 7. 生成 src/services/leaderboard.service.ts
# ==========================================
echo "📄 生成 src/services/leaderboard.service.ts..."
cat << 'EOF' > src/services/leaderboard.service.ts
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
EOF

echo "✅ 所有文件生成完毕！你可以运行 npm init -y && npm install express prisma @prisma/client typescript 等命令开始开发了。"
