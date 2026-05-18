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

import CollapsibleText from '../common/CollapsibleText';

export default function ViewB({ t, theme, task, tasks, onBreakdown, onSwitchTask, isWorking, onOpenMonitor }) {
  if (!task) return null;
  const [showSwitch, setShowSwitch] = useState(false);

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full animate-fade-in pb-20">
      <div className="mt-6 mb-8 flex items-center justify-between">
         <span className={`inline-block px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-md text-xs font-bold tracking-wider uppercase border border-indigo-500/20`}>Active Mission</span>

         <div className="relative">
            <button onClick={() => setShowSwitch(!showSwitch)} className={`text-sm px-4 py-2 rounded-xl border flex items-center gap-2 transition-colors ${t.bgCard} ${t.border} ${t.textMain} hover:border-indigo-500/50`}>
              Switch Task <ChevronDown className="w-4 h-4" />
            </button>
            {showSwitch && (
              <div className={`absolute right-0 top-full mt-2 w-64 rounded-xl border shadow-2xl z-20 py-2 animate-slide-up ${t.bgPanel} ${t.border}`}>
                {tasks.map(tk => (
                  <button key={tk.id} onClick={() => { onSwitchTask(tk.id); setShowSwitch(false); }} className={`w-full text-left px-4 py-3 text-sm hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors ${tk.id === task.id ? 'text-indigo-500 font-bold bg-indigo-500/5' : t.textMuted}`}>
                    {tk.title}
                  </button>
                ))}
              </div>
            )}
         </div>
      </div>

      <div className={`rounded-3xl p-8 md:p-12 shadow-2xl border relative overflow-hidden group ${t.bgCard} ${t.border}`}>
        {theme === 'dark' && <div className="absolute -right-32 -top-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />}

        <div className="relative z-10">
          <h2 className={`text-3xl md:text-4xl font-bold mb-4 leading-tight ${t.textMain}`}>{task.title}</h2>
          <CollapsibleText t={t} text={task.desc} />

          <div className="mt-6 flex flex-wrap gap-3">
            {task?.sourceContext?.fileName && (
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                File: {task.sourceContext.fileName}
              </span>
            )}
            {task?.sourceContext?.originalTaskInput && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                Prompt saved for later regenerate / deeper breakdown
              </span>
            )}
          </div>

          <div className="mt-10 mb-10">
            <div className={`flex justify-between text-sm font-semibold mb-3 ${t.textMuted}`}>
              <span>Overall Progress</span>
              <span className="text-indigo-400">{task.progress}%</span>
            </div>
            <div className={`w-full h-4 rounded-full overflow-hidden border ${theme === 'dark' ? 'bg-[#0f1115] border-white/5' : 'bg-slate-100 border-slate-200'}`}>
              <div className="h-full bg-indigo-500 transition-all duration-1000 ease-out relative" style={{ width: `${task.progress}%` }}>
                 <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:20px_20px] animate-[slide_1s_linear_infinite]" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={onBreakdown}
              disabled={isWorking}
              className={`group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl overflow-hidden transition-all active:scale-95 shadow-[0_0_20px_rgba(99,102,241,0.3)] ${isWorking ? 'opacity-60 cursor-not-allowed' : 'hover:bg-indigo-500'}`}
            >
              <Zap className="w-5 h-5 relative z-10 fill-white/20" />
              <span className="relative z-10">{isWorking ? 'Working...' : 'Breakdown Task'}</span>
            </button>
            {onOpenMonitor && (
              <button
                onClick={onOpenMonitor}
                className={`inline-flex items-center justify-center gap-2 px-6 py-4 font-bold rounded-xl transition-all active:scale-95 border ${t.bgCard} ${t.border} ${t.textMain} hover:border-indigo-500/50 hover:text-indigo-400`}
              >
                <Play className="w-4 h-4" />
                <span>Start Focus Session</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// STATE C & E: Breakdown List / Detail Handlers
