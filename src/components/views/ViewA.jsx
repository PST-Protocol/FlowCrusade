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

import ChatInput from '../common/ChatInput';

export default function ViewA({ t, theme, value, onValueChange, file, onFileSelect, onFileClear, onSubmit, isSubmitting }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full animate-fade-in">
      <div className="text-center mb-12">
        <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center border ${theme === 'dark' ? 'bg-[#1c202a] border-white/10 shadow-[0_0_30px_rgba(99,102,241,0.1)]' : 'bg-white border-slate-200 shadow-xl shadow-indigo-100'}`}>
           <img src="/logo.svg" alt="FocusTrail" className="w-10 h-10 object-contain" />
        </div>
        <h1 className={`text-3xl md:text-4xl font-bold tracking-tight mb-4 ${t.textMain}`}>What are we crushing today?</h1>
        <p className={`text-lg ${t.textMuted}`}>Type a task, upload Word/PDF, or add a screenshot or handwritten photo.</p>
      </div>

      <div className="w-full mt-4">
        <ChatInput
          t={t}
          theme={theme}
          value={value}
          onChange={onValueChange}
          file={file}
          onFileSelect={onFileSelect}
          onFileClear={onFileClear}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          placeholder="e.g. Write a 5-page history essay by Friday..."
        />
      </div>

      <div className="flex flex-wrap justify-center gap-3 mt-10">
         <SuggestionBadge t={t} text="Study for Math Midterm" onClick={() => onSubmit('Study for Math Midterm')} />
         <SuggestionBadge t={t} text="Clean my room" onClick={() => onSubmit('Clean my room')} />
         <SuggestionBadge t={t} text="Read 2 chapters" onClick={() => onSubmit('Read 2 chapters')} />
      </div>
    </div>
  );
}

function SuggestionBadge({ t, text, onClick }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 border rounded-full text-sm transition-all shadow-sm ${t.bgCard} ${t.border} ${t.textMuted} hover:border-indigo-500/50 hover:text-indigo-400`}>
      {text}
    </button>
  );
}

// STATE B: Active Task Overview
