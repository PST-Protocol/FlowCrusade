import React, { useEffect } from 'react';
import { Trophy, Flame, Sparkles, Star, Zap } from 'lucide-react';

export default function CompletionCelebration({ open, onClose, taskTitle, gained = 10, streak = 0, levelName = 'Rookie', theme = 'light' }) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, 2200);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  if (!open) return null;

  const dark = theme === 'dark';
  return (
    <div className="fixed inset-0 z-[80] pointer-events-none flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in" />
      {Array.from({ length: 26 }).map((_, i) => (
        <div key={i} className="fc-confetti" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 70}ms` }} />
      ))}
      <div className={`relative pointer-events-auto max-w-sm w-[90%] rounded-[2rem] border p-6 text-center shadow-2xl fc-pop ${dark ? 'bg-[#171923] border-white/10 text-white' : 'bg-white border-indigo-100 text-slate-900'}`}>
        <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-300 via-pink-400 to-indigo-500 flex items-center justify-center shadow-xl fc-pulse">
          <Trophy className="w-10 h-10 text-white" />
        </div>
        <div className="mt-4 flex items-center justify-center gap-1 text-amber-400">
          <Star className="w-4 h-4 fill-current" /><Star className="w-5 h-5 fill-current" /><Star className="w-4 h-4 fill-current" />
        </div>
        <h2 className="mt-2 text-3xl font-black tracking-tight">Task Complete!</h2>
        <p className={`mt-2 text-sm line-clamp-2 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{taskTitle}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className={`rounded-2xl p-3 border ${dark ? 'bg-white/5 border-white/10' : 'bg-indigo-50 border-indigo-100'}`}><Zap className="w-4 h-4 mx-auto text-indigo-500"/><p className="text-xs font-bold mt-1">+{gained} XP</p></div>
          <div className={`rounded-2xl p-3 border ${dark ? 'bg-white/5 border-white/10' : 'bg-orange-50 border-orange-100'}`}><Flame className="w-4 h-4 mx-auto text-orange-500"/><p className="text-xs font-bold mt-1">{streak} streak</p></div>
          <div className={`rounded-2xl p-3 border ${dark ? 'bg-white/5 border-white/10' : 'bg-emerald-50 border-emerald-100'}`}><Sparkles className="w-4 h-4 mx-auto text-emerald-500"/><p className="text-xs font-bold mt-1">{levelName}</p></div>
        </div>
        <button onClick={onClose} className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black pointer-events-auto">Keep going!</button>
      </div>
    </div>
  );
}
