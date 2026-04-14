import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const NoteService = {
    /**
     * Get all notes for a user, newest first
     */
    async getNotes(userId: number) {
        return await prisma.note.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
    },

    /**
     * Create a new quick note
     */
    async createNote(userId: number, text: string) {
        return await prisma.note.create({
            data: { userId, text }
        });
    },

    /**
     * Delete a note (only if it belongs to the user)
     */
    async deleteNote(userId: number, noteId: number) {
        const note = await prisma.note.findUnique({ where: { id: noteId } });
        if (!note) throw new Error("Note not found");
        if (note.userId !== userId) throw new Error("Unauthorized");

        return await prisma.note.delete({ where: { id: noteId } });
    },

    /**
     * Update a note's text
     */
    async updateNote(userId: number, noteId: number, text: string) {
        const note = await prisma.note.findUnique({ where: { id: noteId } });
        if (!note) throw new Error("Note not found");
        if (note.userId !== userId) throw new Error("Unauthorized");

        return await prisma.note.update({
            where: { id: noteId },
            data: { text }
        });
    }
};
