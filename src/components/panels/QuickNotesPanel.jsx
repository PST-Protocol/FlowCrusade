import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, BarChart2, Activity, Plus, Mic, Send, 
  ChevronRight, Home, CheckCircle, Clock, RefreshCw, 
  X, Edit3, Trash2, Zap, Play, Pause, RotateCcw,
  Paperclip, ArrowLeft, Settings as SettingsIcon,
  Moon, Sun, Bell, Database, Key, ShieldAlert,
  ChevronDown, ChevronUp, ChevronLeft, Users, MapPin, Trophy, Ticket,
  Menu, PanelLeftClose
} from 'lucide-react';


export default function QuickNotesPanel({ t, theme, notes, setNotes, showHeader = true, onClose }) {
  const [val, setVal] = useState('');

  const addNote = () => {
    const text = val.trim();
    if (!text) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const note = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, text, time };
    setNotes([note, ...notes]);
    setVal('');
  };

  const removeNote = (id) => setNotes(notes.filter(n => n.id !== id));

  return (
    <div className="flex flex-col h-full">
      {showHeader && (
        <div className={`p-6 border-b ${t.border}`}>
          <div className="flex items-center justify-between">
            <h3 className={`font-bold text-lg ${t.textMain}`}>Quick Notes</h3>
            {onClose && (
              <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${t.textMuted} ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`} title="Close Quick Notes">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className={`text-xs mt-1 ${t.textMuted}`}>Scratchpad for passing thoughts. Auto-saved locally.</p>
        </div>
      )}

      <div className={`p-6 flex-1 overflow-y-auto custom-scrollbar ${showHeader ? '' : 'pt-0'}`}>
        {notes.length === 0 ? (
          <div className={`rounded-xl border p-4 text-sm ${t.bgCard} ${t.border} ${t.textMuted}`}>
            No notes yet. Capture a thought before it slips.
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((n) => (
              <div key={n.id} className={`rounded-xl border p-3 ${t.bgCard} ${t.border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-[10px] font-bold ${t.textMuted}`}>{n.time}</div>
                    <div className={`text-sm mt-1 break-words ${t.textMain}`}>{n.text}</div>
                  </div>
                  <button
                    onClick={() => removeNote(n.id)}
                    className={`p-2 rounded-lg transition-colors ${t.textMuted} ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
                    title="Remove"
                    aria-label="Remove note"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`p-4 border-t ${t.border}`}>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${t.bgInput} ${t.border}`}>
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
            placeholder="Type a quick note and press Enter"
            className={`flex-1 bg-transparent focus:outline-none text-sm ${t.textMain}`}
          />
          <button
            onClick={addNote}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${val.trim() ? t.primaryBtn : t.secondaryBtn}`}
            disabled={!val.trim()}
            title="Add"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// 4.1 Calendar Panel
