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

import { LEVELS, getLevelForMinutes, getRewardBounds, clamp01, formatMins } from '../../data/rewards';

export default function StatsPanel({ t, theme, stats }) {
  const [tab, setTab] = useState('overview'); // 'overview' | 'ranking'
  const [rankTab, setRankTab] = useState('friends'); // 'friends' | 'location'
  const [shareWithFriends, setShareWithFriends] = useState(true);
  const [shareAnonymously, setShareAnonymously] = useState(true);

  const level = useMemo(() => getLevelForMinutes(stats.focusScore), [stats.focusScore]);
  const rewardBounds = useMemo(() => getRewardBounds(stats.focusScore), [stats.focusScore]);
  const progressToNextReward = useMemo(() => clamp01((stats.focusScore - rewardBounds.prev) / (rewardBounds.next - rewardBounds.prev)), [stats.focusScore, rewardBounds]);

  const weightedCredit = stats.weightedCredit ?? stats.focusScore;
  const taskCompletionMinutes = stats.taskCompletionMinutes || 0;

  const coach = useMemo(() => {
    const focus = stats.focusTimeToday;
    const distractionMins = stats.distractTime;
    const completion = stats.completionRate;

    let headline = "Coach Note";
    let message = "Pick one small step and start. Momentum beats motivation.";
    let chips = [];

    if (completion >= 80 && distractionMins <= 20) {
      headline = "You're in flow";
      message = "Your consistency is paying off. Keep sessions short and stack wins.";
      chips = ["Maintain your streak", "Keep phone out of reach", "Reward yourself after the next milestone"];
    } else if (focus >= 120 && distractionMins <= 30) {
      headline = "Strong focus day";
      message = "Nice work. Try one 'deep' session next: 25 minutes + 5 minute break.";
      chips = ["One more deep session", "Write a 1-line plan", "Turn on Monitor for social apps"];
    } else if (distractionMins > 30) {
      headline = "Distractions detected";
      message = "No shame—ADHD brains are novelty-seeking. Let's reduce friction, not willpower.";
      chips = ["Close 1 tab now", "Start with a 5-minute warm-up task", "Use a visual timer"];
    } else {
      headline = "Warm start";
      message = "Start with an easy win (2–5 minutes). Once started, keep going for 10.";
      chips = ["Make the first step tiny", "Silence notifications", "Prepare your workspace"];
    }

    return { headline, message, chips };
  }, [stats]);

  const friendsRaw = useMemo(() => {
    const base = [
      { id: 'f1', name: 'Ava', minutes: 920 },
      { id: 'f2', name: 'Kai', minutes: 540 },
      { id: 'f3', name: 'Mina', minutes: 1250 },
      { id: 'f4', name: 'Leo', minutes: 310 },
      { id: 'f5', name: 'Noah', minutes: 720 },
    ];
    const me = { id: 'me', name: 'You', minutes: stats.focusScore, isMe: true };

    const list = shareWithFriends ? [me, ...base] : base;
    return list.map(u => ({ ...u, level: getLevelForMinutes(u.minutes) }));
  }, [stats.focusScore, shareWithFriends]);

  const friendsGrouped = useMemo(() => {
    const order = ['diamond', 'gold', 'silver', 'bronze', 'newbie'];
    const groups = {};
    for (const u of friendsRaw) {
      groups[u.level.key] = groups[u.level.key] || [];
      groups[u.level.key].push(u);
    }
    for (const k of Object.keys(groups)) {
      groups[k].sort((a, b) => b.minutes - a.minutes);
    }
    return order
      .filter(k => groups[k] && groups[k].length)
      .map(k => ({ key: k, name: (LEVELS.find(l => l.key === k) || { name: k }).name, users: groups[k] }));
  }, [friendsRaw]);

  const city = 'Irvine';
  const locationRaw = useMemo(() => {
    const pool = [
      { id: 'a1', name: 'User 3F9', minutes: 610 },
      { id: 'a2', name: 'User 1A2', minutes: 880 },
      { id: 'a3', name: 'User 7C0', minutes: 540 },
      { id: 'a4', name: 'User 4D1', minutes: 760 },
      { id: 'a5', name: 'User 9B8', minutes: 990 },
      { id: 'a6', name: 'User 0E7', minutes: 450 },
      { id: 'a7', name: 'User 6A4', minutes: 1130 },
      { id: 'a8', name: 'User 2C9', minutes: 2300 },
    ];

    const anonMe = { id: 'me_anon', name: 'You (Anonymous)', minutes: stats.focusScore, isMe: true };
    const list = shareAnonymously ? [anonMe, ...pool] : pool;

    return list
      .map(u => ({ ...u, level: getLevelForMinutes(u.minutes) }))
      .filter(u => u.level.key === level.key)
      .sort((a, b) => b.minutes - a.minutes);
  }, [stats.focusScore, shareAnonymously, level.key]);

  const switchBase = `${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'} ${t.border}`;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Mood / Coach Note */}
      <div className={`p-5 rounded-2xl border ${t.bgCard} ${t.border}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>{coach.headline}</p>
            <p className={`mt-2 text-sm leading-relaxed ${t.textMain}`}>{coach.message}</p>
          </div>
          <div className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold border ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
            {level.name}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {coach.chips.map((c) => (
            <span key={c} className={`text-[11px] px-2.5 py-1 rounded-full border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-white border-slate-200 text-slate-700'}`}>
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Tab Switch */}
      <div className="flex items-center justify-between gap-3">
        <div className={`inline-flex p-1 rounded-xl border ${switchBase}`}>
          <button onClick={() => setTab('overview')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${tab === 'overview' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white text-indigo-700 shadow-sm') : t.textMuted}`}>
            Overview
          </button>
          <button onClick={() => setTab('ranking')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${tab === 'ranking' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white text-indigo-700 shadow-sm') : t.textMuted}`}>
            Ranking
          </button>
        </div>

        <div className={`hidden sm:flex items-center gap-2 text-xs font-bold ${t.textMuted}`}>
          <Trophy className="w-4 h-4" />
          {formatMins(stats.focusScore)} total
        </div>
      </div>

      {tab === 'overview' ? (
        <div className="space-y-6">
          {/* Focus Score Card */}
          <div className={`p-6 rounded-2xl border relative overflow-hidden ${t.bgCard} ${t.border} ${t.glow}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10 pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
                  <h3 className={`font-bold ${t.textMain}`}>Reward Progress</h3>
                </div>
                <span className={`text-xs font-bold ${t.textMuted}`}>Next: {formatMins(rewardBounds.next)}</span>
              </div>

              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className={`text-4xl font-black tracking-tight ${t.textMain}`}>{formatMins(stats.focusScore)}</p>
                  <p className={`text-xs mt-1 ${t.textMuted}`}>Credit = 60% focus duration + 40% completed-task duration</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${t.textMuted}`}>Level</p>
                  <p className={`text-lg font-black ${t.textMain}`}>{level.name}</p>
                </div>
              </div>

              <div className={`mt-6 h-3 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                  style={{ width: `${Math.round(progressToNextReward * 100)}%` }}
                />
              </div>

              <p className={`text-xs mt-2 ${t.textMuted}`}>
                {formatMins(Math.max(0, rewardBounds.next - stats.focusScore))} to the next reward
              </p>
            </div>
          </div>

          {/* Core Stats */}
          <div className="grid grid-cols-2 gap-4">
            <StatBox t={t} title="Focus time today" value={`${stats.focusTimeToday}m`} />
            <StatBox t={t} title="Task time completed" value={`${taskCompletionMinutes}m`} />
            <StatBox t={t} title="Weighted credit" value={`${weightedCredit}m`} />
            <StatBox t={t} title="Sessions" value={stats.sessions} />
            <StatBox t={t} title="Avg session" value={`${stats.avgSession}m`} />
            <StatBox t={t} title="Streak" value={`${stats.streak} days`} />
          </div>

          <div className={`p-4 rounded-xl border text-xs leading-relaxed ${t.bgCard} ${t.border} ${t.textMuted}`}>
            <span className={`font-bold ${t.textMain}`}>Credit formula:</span> ({stats.focusTimeToday}m × 0.6) + ({taskCompletionMinutes}m × 0.4) = <span className="font-bold text-indigo-400">{weightedCredit}m</span>.
          </div>

          {/* Completion & Distraction */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className={`p-5 rounded-xl border ${t.bgCard} ${t.border}`}>
              <h4 className={`font-bold ${t.textMain} mb-2`}>Completion Rate</h4>
              <p className={`text-xs ${t.textMuted}`}>Tasks completed vs. started this week</p>
              <div className="mt-4">
                <div className={`h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                  <div className="h-full bg-emerald-500" style={{ width: `${stats.completionRate}%` }} />
                </div>
                <p className={`text-xs font-bold mt-2 ${t.textMain}`}>{stats.completionRate}%</p>
              </div>
            </div>

            <div className={`p-5 rounded-xl border ${t.bgCard} ${t.border}`}>
              <h4 className={`font-bold ${t.textMain} mb-2`}>Distraction Report</h4>
              <div className="flex justify-between mt-3">
                <div>
                  <p className={`text-xs ${t.textMuted}`}>Interruptions</p>
                  <p className={`text-xl font-black ${t.textMain}`}>{stats.distractCount}</p>
                </div>
                <div>
                  <p className={`text-xs ${t.textMuted}`}>Time lost</p>
                  <p className={`text-xl font-black ${t.textMain}`}>{stats.distractTime}m</p>
                </div>
              </div>
              <div className="mt-4">
                <span className={`text-xs font-bold uppercase ${t.textMuted} block mb-2`}>Top triggers</span>
                <div className="flex flex-wrap gap-2">
                  {stats.topDistractions.map(d => (
                    <span key={d} className={`text-xs px-2 py-1 rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20`}>{d}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Ranking Tabs */}
          <div className={`p-4 rounded-2xl border ${t.bgCard} ${t.border}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className={`inline-flex p-1 rounded-xl border ${switchBase}`}>
                <button onClick={() => setRankTab('friends')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${rankTab === 'friends' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white text-indigo-700 shadow-sm') : t.textMuted}`}>
                  <Users className="w-4 h-4" /> Friends
                </button>
                <button onClick={() => setRankTab('location')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${rankTab === 'location' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white text-indigo-700 shadow-sm') : t.textMuted}`}>
                  <MapPin className="w-4 h-4" /> {city}
                </button>
              </div>

            </div>

            {/* Privacy toggles */}
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-xs font-bold ${t.textMain}`}>Share with friends</span>
                <button
                  onClick={() => setShareWithFriends(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${shareWithFriends ? 'bg-indigo-500' : (theme === 'dark' ? 'bg-gray-600' : 'bg-slate-300')}`}
                >
                  <span className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${shareWithFriends ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-xs font-bold ${t.textMain}`}>Share anonymously</span>
                <button
                  onClick={() => setShareAnonymously(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${shareAnonymously ? 'bg-indigo-500' : (theme === 'dark' ? 'bg-gray-600' : 'bg-slate-300')}`}
                >
                  <span className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${shareAnonymously ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {rankTab === 'friends' ? (
            <div className="space-y-4">
              {friendsGrouped.map(group => (
                <div key={group.key} className={`p-4 rounded-2xl border ${t.bgCard} ${t.border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-black tracking-wider ${t.textMain}`}>{group.name}</span>
                    <span className={`text-[10px] font-bold ${t.textMuted}`}>{group.users.length} users</span>
                  </div>

                  <div className="space-y-2">
                    {group.users.map((u, idx) => (
                      <div key={u.id} className={`p-3 rounded-xl border flex items-center justify-between ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm border ${u.isMe ? (theme === 'dark' ? 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700') : (theme === 'dark' ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-white border-slate-200 text-slate-800')}`}>
                            {u.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${t.textMain}`}>{u.name}{u.isMe ? ' (You)' : ''}</p>
                            <p className={`text-[11px] ${t.textMuted}`}>{u.level.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-black ${t.textMain}`}>{formatMins(u.minutes)}</p>
                          <p className={`text-[10px] font-bold ${t.textMuted}`}>#{idx + 1} in {group.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {!shareWithFriends && (
                <div className={`p-4 rounded-2xl border ${t.bgCard} ${t.border}`}>
                  <p className={`text-sm ${t.textMain}`}>
                    You're currently hidden from friends ranking. Turn on “Share with friends” to appear and receive social feedback.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className={`p-4 rounded-2xl border ${t.bgCard} ${t.border}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className={`text-sm font-bold ${t.textMain}`}>{city} · Anonymous Leaderboard</p>
                  <p className={`text-xs ${t.textMuted}`}>Only {level.name} users are shown (level-matched)</p>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold border ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {locationRaw.length} users
                </div>
              </div>

              {shareAnonymously ? (
                <div className="space-y-2">
                  {locationRaw.map((u, idx) => (
                    <div key={u.id} className={`p-3 rounded-xl border flex items-center justify-between ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm border ${u.isMe ? (theme === 'dark' ? 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700') : (theme === 'dark' ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-white border-slate-200 text-slate-800')}`}>
                          {u.name.slice(5, 6) || '#'}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${t.textMain}`}>{u.name}{u.isMe ? ' (You)' : ''}</p>
                          <p className={`text-[11px] ${t.textMuted}`}>{u.level.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${t.textMain}`}>{formatMins(u.minutes)}</p>
                        <p className={`text-[10px] font-bold ${t.textMuted}`}>#{idx + 1} in {level.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-sm ${t.textMain}`}>
                    You're not participating in location ranking. Turn on “Share anonymously” to compare with others in {city}.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ t, title, value }) {
  return (
    <div className={`p-4 rounded-xl border ${t.bgCard} ${t.border}`}>
      <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${t.textMuted}`}>{title}</h4>
      <p className={`text-xl font-bold ${t.textMain}`}>{value}</p>
    </div>
  )
}

// 4.3 Monitor Panel
