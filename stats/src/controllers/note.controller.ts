import { Request, Response } from 'express';
import { NoteService } from '../services/note.service';

/**
 * GET /notes — list all notes for the current user
 */
export const getNotes = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const notes = await NoteService.getNotes(userId);

        return res.status(200).json({ notes });
    } catch (error: any) {
        console.error("Error fetching notes:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * POST /notes — create a new quick note
 * Body: { text: string }
 */
export const createNote = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: "Note text is required" });
        }

        const note = await NoteService.createNote(userId, text.trim());
        return res.status(201).json({ message: "Note created", note });
    } catch (error: any) {
        console.error("Error creating note:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * DELETE /notes/:id — delete a note
 */
export const deleteNote = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const noteId = parseInt(req.params.id, 10);

        if (isNaN(noteId)) {
            return res.status(400).json({ error: "Invalid note ID" });
        }

        await NoteService.deleteNote(userId, noteId);
        return res.status(200).json({ message: "Note deleted" });
    } catch (error: any) {
        if (error.message === "Note not found") {
            return res.status(404).json({ error: error.message });
        }
        if (error.message === "Unauthorized") {
            return res.status(403).json({ error: error.message });
        }
        console.error("Error deleting note:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * PUT /notes/:id — update a note's text
 * Body: { text: string }
 */
export const updateNote = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const noteId = parseInt(req.params.id, 10);
        const { text } = req.body;

        if (isNaN(noteId)) {
            return res.status(400).json({ error: "Invalid note ID" });
        }
        if (!text || !text.trim()) {
            return res.status(400).json({ error: "Note text is required" });
        }

        const note = await NoteService.updateNote(userId, noteId, text.trim());
        return res.status(200).json({ message: "Note updated", note });
    } catch (error: any) {
        if (error.message === "Note not found") {
            return res.status(404).json({ error: error.message });
        }
        if (error.message === "Unauthorized") {
            return res.status(403).json({ error: error.message });
        }
        console.error("Error updating note:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
