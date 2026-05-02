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


export default function ChatInput({ t, theme, value, onChange, file, onFileSelect, onFileClear, onSubmit, placeholder, isSubmitting = false }) {
  const fileInputRef = useRef(null);
  const canSend = !!value.trim() || !!file;
  const disabledSendCls = theme === 'dark'
    ? 'bg-white/5 text-gray-500'
    : 'bg-slate-200 text-slate-400';

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className={`relative flex items-center border shadow-xl rounded-full p-2 focus-within:ring-2 focus-within:border-indigo-500 transition-all w-full ${t.bgInput} ${t.border}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.odt,.rtf,.txt,.md,.csv,.json,.xml,image/*"
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) onFileSelect(selected);
            e.target.value = '';
          }}
        />

        <button onClick={() => fileInputRef.current?.click()} className={`p-3 rounded-full transition-colors shrink-0 ${t.textMuted} hover:bg-indigo-500/10 hover:text-indigo-400`} title="Upload File">
          <Paperclip className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && canSend && !isSubmitting) onSubmit(); }}
          placeholder={placeholder}
          className={`flex-1 bg-transparent px-3 py-2 focus:outline-none text-base ${t.textMain}`}
        />

        <div className="flex items-center gap-1 shrink-0 pr-1">
          <button className={`p-3 rounded-full transition-colors hidden sm:block ${t.textMuted} hover:bg-indigo-500/10 hover:text-indigo-400`} type="button">
            <Mic className="w-5 h-5" />
          </button>
          <button
            onClick={() => canSend && !isSubmitting && onSubmit()}
            disabled={!canSend || isSubmitting}
            className={`p-3 rounded-full transition-all flex items-center justify-center ${canSend && !isSubmitting ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-500 active:scale-95' : disabledSendCls}`}
          >
            <Send className={`w-5 h-5 ${canSend && !isSubmitting ? 'translate-x-0.5 -translate-y-0.5' : ''}`} />
          </button>
        </div>
      </div>

      {file && (
        <div className={`mt-3 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className="min-w-0">
            <div className={`text-sm font-semibold truncate ${t.textMain}`}>{file.name}</div>
            <div className={`text-xs ${t.textMuted}`}>{file.type || 'Unknown type'} · {Math.max(1, Math.round((file.size || 0) / 1024))} KB</div>
          </div>
          <button
            type="button"
            onClick={onFileClear}
            className={`p-2 rounded-xl transition-colors ${t.textMuted} hover:bg-indigo-500/10 hover:text-indigo-500`}
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

