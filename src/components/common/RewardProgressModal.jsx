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

import { REWARD_MILESTONES, getLevelForMinutes, getRewardBounds, clamp01, formatMins } from '../../data/rewards';

export default function RewardProgressModal({ open, onClose, t, theme, stats }) {
  const panelRef = useRef(null);

  const level = useMemo(() => getLevelForMinutes(stats.focusScore), [stats.focusScore]);
  const rewardBounds = useMemo(() => getRewardBounds(stats.focusScore), [stats.focusScore]);
  const segProgress = useMemo(() => clamp01((stats.focusScore - rewardBounds.prev) / (rewardBounds.next - rewardBounds.prev)), [stats.focusScore, rewardBounds]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const remaining = Math.max(0, rewardBounds.next - stats.focusScore);
  const maxMilestone = REWARD_MILESTONES[REWARD_MILESTONES.length - 1];
  const overall = clamp01(stats.focusScore / maxMilestone);

  const rewards = [
    { at: 1000, title: 'Coupon', desc: 'Redeem for small perks', icon: Ticket },
    { at: 2000, title: 'Theme Pack', desc: 'Unlock UI skins', icon: Trophy },
    { at: 3000, title: 'Mascot Upgrade', desc: 'New celebration animation', icon: Trophy },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={panelRef} className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${t.bgPanel} ${t.border} p-5 animate-fade-in`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className={`text-lg font-black ${t.textMain}`}>Rewards</h3>
            <p className={`text-xs mt-1 ${t.textMuted}`}>Progress is measured in focus minutes · Level: <span className={`font-bold ${t.textMain}`}>{level.name}</span></p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${t.secondaryBtn}`} aria-label="Close rewards">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Next reward */}
        <div className={`mt-5 p-4 rounded-2xl border ${t.bgCard} ${t.border}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>Next reward</span>
            <span className={`text-xs font-black ${t.textMain}`}>{formatMins(rewardBounds.next)}</span>
          </div>

          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <p className={`text-3xl font-black tracking-tight ${t.textMain}`}>{formatMins(stats.focusScore)}</p>
              <p className={`text-xs ${t.textMuted}`}>{formatMins(remaining)} to go</p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-bold ${t.textMuted}`}>This segment</p>
              <p className={`text-lg font-black ${t.textMain}`}>{Math.round(segProgress * 100)}%</p>
            </div>
          </div>

          <div className={`mt-4 h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
            <div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${Math.round(segProgress * 100)}%` }} />
          </div>
        </div>

        {/* Milestones bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>Upcoming milestones</span>
            <span className={`text-[10px] font-bold ${t.textMuted}`}>0 → {formatMins(maxMilestone)}</span>
          </div>

          <div className={`relative h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/60 to-fuchsia-500/60" style={{ width: `${Math.round(overall * 100)}%` }} />
            {REWARD_MILESTONES.map((m) => {
              const left = clamp01(m / maxMilestone) * 100;
              const hit = stats.focusScore >= m;
              return (
                <div key={m} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${left}%` }}>
                  <div className={`w-3 h-3 rounded-full border ${hit ? 'bg-emerald-500 border-emerald-400' : (theme === 'dark' ? 'bg-[#1c202a] border-white/20' : 'bg-white border-slate-300')}`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Rewards list */}
        <div className="mt-5 space-y-2">
          {rewards.map((r) => {
            const unlocked = stats.focusScore >= r.at;
            const Icon = r.icon;
            return (
              <div key={r.at} className={`p-3 rounded-2xl border flex items-center justify-between ${t.bgCard} ${t.border}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${unlocked ? (theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700') : (theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700')}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-sm font-black ${t.textMain}`}>{r.title} <span className={`text-xs ${t.textMuted}`}>· {formatMins(r.at)}</span></p>
                    <p className={`text-xs ${t.textMuted}`}>{r.desc}</p>
                  </div>
                </div>

                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${unlocked ? (theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700') : (theme === 'dark' ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-600')}`}>
                  {unlocked ? 'UNLOCKED' : 'LOCKED'}
                </span>
              </div>
            );
          })}
        </div>

        <p className={`mt-4 text-xs ${t.textMuted}`}>
          Tip: To reduce ADHD friction, set the next session to a single action (e.g., “open the PDF and highlight 3 lines”).
        </p>
      </div>
    </div>
  );
}

