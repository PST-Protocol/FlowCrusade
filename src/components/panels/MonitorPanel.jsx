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


export default function MonitorPanel({ t, theme, events, onSimulate, onAddFocus, onDeleteEvent, onClearEvents, enabled, onToggle }) {
  const [showPicker, setShowPicker] = useState(false);
  const sources = ['Instagram', 'TikTok', 'Reddit', 'YouTube', 'Email', 'Twitter/X', 'Other'];

  const focusCount = events.filter(e => e.type === 'focus').length;
  const distractCount = events.filter(e => e.type === 'distract').length;
  const isDistracted = events[0]?.type === 'distract';

  // Top distraction sources
  const srcMap = {};
  events.filter(e => e.type === 'distract').forEach(e => {
    const s = e.source || e.desc?.match(/→\s*(.+)/)?.[1] || 'Unknown';
    srcMap[s] = (srcMap[s] || 0) + 1;
  });
  const topSrc = Object.entries(srcMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toggle */}
      <div className={`p-4 rounded-xl border flex items-center justify-between ${t.bgCard} ${t.border}`}>
        <div>
          <h4 className={`font-bold text-sm ${t.textMain}`}>Active Monitor</h4>
          <p className={`text-[10px] mt-1 ${t.textMuted}`}>Track off-screen activity</p>
        </div>
        <button onClick={() => onToggle(!enabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-indigo-500' : (theme === 'dark' ? 'bg-gray-600' : 'bg-slate-300')}`}>
          <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`p-3 rounded-xl border text-center ${t.bgCard} ${t.border}`}>
          <p className="text-lg font-bold text-emerald-500">{focusCount}</p>
          <p className={`text-[10px] ${t.textMuted}`}>Focus</p>
        </div>
        <div className={`p-3 rounded-xl border text-center ${t.bgCard} ${t.border}`}>
          <p className="text-lg font-bold text-rose-500">{distractCount}</p>
          <p className={`text-[10px] ${t.textMuted}`}>Distractions</p>
        </div>
        <div className={`p-3 rounded-xl border text-center ${t.bgCard} ${t.border}`}>
          <p className={`text-lg font-bold ${distractCount === 0 ? 'text-emerald-500' : distractCount <= 3 ? 'text-amber-500' : 'text-rose-500'}`}>
            {distractCount === 0 ? 'A+' : distractCount <= 2 ? 'A' : distractCount <= 4 ? 'B' : 'C'}
          </p>
          <p className={`text-[10px] ${t.textMuted}`}>Score</p>
        </div>
      </div>

      {/* Top sources */}
      {topSrc.length > 0 && (
        <div className={`p-3 rounded-xl border ${t.bgCard} ${t.border}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${t.textMuted}`}>Top distractions</p>
          <div className="flex flex-wrap gap-1.5">
            {topSrc.map(([s, c]) => (
              <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-bold">{s} ({c})</span>
            ))}
          </div>
        </div>
      )}

      {/* Action button */}
      {isDistracted ? (
        <button onClick={onAddFocus} className="w-full py-2.5 rounded-xl font-bold border flex items-center justify-center gap-2 text-sm transition-colors border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10">
          <Play className="w-4 h-4" /> Back to Focus
        </button>
      ) : (
        <button onClick={() => setShowPicker(!showPicker)} className={`w-full py-2.5 rounded-xl font-bold border border-dashed flex items-center justify-center gap-2 text-sm transition-colors ${t.border} text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50`}>
          <ShieldAlert className="w-4 h-4" /> Log Distraction
        </button>
      )}

      {/* Source picker */}
      {showPicker && (
        <div className={`p-3 rounded-xl border ${t.bgCard} ${t.border} animate-slide-up`}>
          <p className={`text-xs font-bold mb-2 ${t.textMuted}`}>What distracted you?</p>
          <div className="flex flex-wrap gap-2">
            {sources.map(s => (
              <button key={s} onClick={() => { onSimulate(s); setShowPicker(false); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${t.border} ${t.textMain} hover:border-rose-500/50 hover:text-rose-400`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className={`font-bold text-xs uppercase tracking-wider ${t.textMuted}`}>Activity Timeline</h4>
          {events.length > 0 && (
            <button onClick={onClearEvents} className={`text-[10px] font-bold ${t.textMuted} hover:text-rose-400 transition-colors`}>Clear all</button>
          )}
        </div>
        {events.length === 0 ? (
          <p className={`text-sm ${t.textMuted}`}>No activity yet.</p>
        ) : (
          <div className={`relative`}>
            {/* 竖线放在右侧 70% 位置 */}
            <div className={`absolute top-0 bottom-0 w-0.5 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} style={{left: '70%'}} />
            {events.map(ev => {
              const isFocus = ev.type === 'focus';
              return (
                <div key={ev.id} className="relative mb-4 group">
                  {/* Dot on the line */}
                  <div className={`absolute top-4 w-4 h-4 rounded-full border-[3px] z-10 -translate-x-1/2 ${isFocus ? 'bg-emerald-500' : 'bg-rose-500'} ${theme === 'dark' ? 'border-[#161920]' : 'border-white'}`} style={{left: '70%'}} />
                  
                  {isFocus ? (
                    /* Focus: 卡片居中在线附近 */
                    <div className={`ml-[15%] mr-[5%] p-3 rounded-xl border shadow-sm ${t.bgCard} ${t.border} border-emerald-500/20`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-emerald-500">Focus</span>
                        <span className={`text-[10px] font-bold ${t.textMuted}`}>{ev.time}</span>
                      </div>
                      <p className={`text-xs ${t.textMain}`}>{ev.desc}</p>
                    </div>
                  ) : (
                    /* Distraction: 卡片偏到最左边，远离线 */
                    <div className={`mr-[38%] p-3 rounded-xl border shadow-sm ${t.bgCard} ${t.border} border-rose-500/20`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-rose-400">Alert</span>
                        <span className={`text-[10px] font-bold ${t.textMuted}`}>{ev.time}</span>
                      </div>
                      <p className={`text-xs ${t.textMain}`}>{ev.desc}</p>
                    </div>
                  )}

                  <button onClick={() => onDeleteEvent(ev.id)} className={`absolute right-0 top-1 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${t.textMuted} hover:text-rose-400`}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// 4.4 Settings Panel
