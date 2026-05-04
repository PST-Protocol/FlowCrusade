import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Play, X, Wifi, WifiOff } from 'lucide-react';
import {
  startMonitorSession,
  endMonitorSession,
  getActiveMonitorSession,
  postMonitorEvent,
  getSessionEvents,
  createMonitorSSE,
} from '../../services/monitorApi';
import { recordDistraction } from '../../services/statsApi';

const DISTRACTION_SOURCES = ['Instagram', 'TikTok', 'Reddit', 'YouTube', 'Email', 'Twitter/X', 'Other'];

export default function MonitorPanel({ t, theme, enabled, onToggle, showToast }) {
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const sseRef = useRef(null);

  // On mount: check for existing active session and load its events
  useEffect(() => {
    getActiveMonitorSession()
      .then(({ session: active }) => {
        if (active) {
          setSession(active);
          return getSessionEvents(active.sessionId).then(({ events: evts }) => setEvents(evts || []));
        }
      })
      .catch(() => {});

    // Connect to SSE stream
    const sse = createMonitorSSE();
    sseRef.current = sse;

    sse.addEventListener('connected', () => setSseConnected(true));
    sse.addEventListener('monitor.heartbeat', () => setSseConnected(true));
    sse.addEventListener('monitor.event', (e) => {
      const event = JSON.parse(e.data);
      setEvents((prev) => [event, ...prev]);
    });
    sse.addEventListener('monitor.session.ended', () => setSession(null));
    sse.onerror = () => setSseConnected(false);

    return () => sse.close();
  }, []);

  const handleToggle = async (turnOn) => {
    setLoading(true);
    try {
      if (turnOn) {
        const { session: newSession } = await startMonitorSession({ mode: 'standalone' });
        setSession(newSession);
        setEvents([]);
        onToggle(true);
        showToast?.('Monitor session started');
      } else {
        if (session) {
          await endMonitorSession(session.sessionId);
          setSession(null);
        }
        onToggle(false);
        showToast?.('Monitor session ended');
      }
    } catch (err) {
      showToast?.(`Monitor error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogDistraction = async (source) => {
    setShowPicker(false);
    const timestamp = new Date().toISOString();
    const durationSeconds = 120; // 2 min default

    try {
      if (session) {
        await postMonitorEvent({
          sessionId: session.sessionId,
          appName: source,
          timestamp,
          durationSeconds,
        });
        // event comes back via SSE
      } else {
        // no active session: write directly to stats
        await recordDistraction({ appName: source, minutes: 2, timestamp });
        showToast?.(`Distraction logged: ${source}`, 'warning');
      }
    } catch {
      showToast?.('Failed to log distraction', 'error');
    }
  };

  // Compute stats from current session events
  const focusEvents = events.filter((e) => e.classification === 'focus');
  const distractEvents = events.filter((e) => e.classification === 'distraction');
  const totalDistractMins = distractEvents.reduce(
    (sum, e) => sum + Math.ceil((e.durationSeconds || 0) / 60),
    0
  );

  const srcMap = {};
  distractEvents.forEach((e) => {
    const s = e.appName || 'Unknown';
    srcMap[s] = (srcMap[s] || 0) + 1;
  });
  const topSrc = Object.entries(srcMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const isDistracted = events[0]?.classification === 'distraction';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toggle */}
      <div className={`p-4 rounded-xl border flex items-center justify-between ${t.bgCard} ${t.border}`}>
        <div>
          <div className="flex items-center gap-2">
            <h4 className={`font-bold text-sm ${t.textMain}`}>Active Monitor</h4>
            {sseConnected ? (
              <Wifi className="w-3 h-3 text-emerald-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-rose-400" />
            )}
          </div>
          <p className={`text-[10px] mt-1 ${t.textMuted}`}>
            {session ? `Session active · ${events.length} events` : 'Track off-screen activity'}
          </p>
        </div>
        <button
          disabled={loading}
          onClick={() => handleToggle(!enabled)}
          className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? 'bg-indigo-500' : theme === 'dark' ? 'bg-gray-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`p-3 rounded-xl border text-center ${t.bgCard} ${t.border}`}>
          <p className="text-lg font-bold text-emerald-500">{focusEvents.length}</p>
          <p className={`text-[10px] ${t.textMuted}`}>Focus</p>
        </div>
        <div className={`p-3 rounded-xl border text-center ${t.bgCard} ${t.border}`}>
          <p className="text-lg font-bold text-rose-500">{distractEvents.length}</p>
          <p className={`text-[10px] ${t.textMuted}`}>Distractions</p>
        </div>
        <div className={`p-3 rounded-xl border text-center ${t.bgCard} ${t.border}`}>
          <p
            className={`text-lg font-bold ${
              totalDistractMins <= 5
                ? 'text-emerald-500'
                : totalDistractMins <= 20
                ? 'text-amber-500'
                : 'text-rose-500'
            }`}
          >
            {totalDistractMins}m
          </p>
          <p className={`text-[10px] ${t.textMuted}`}>Lost</p>
        </div>
      </div>

      {/* Top sources */}
      {topSrc.length > 0 && (
        <div className={`p-3 rounded-xl border ${t.bgCard} ${t.border}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${t.textMuted}`}>
            Top distractions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topSrc.map(([s, c]) => (
              <span
                key={s}
                className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-bold"
              >
                {s} ({c})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action button */}
      {isDistracted ? (
        <button
          onClick={() => session && postMonitorEvent({ sessionId: session.sessionId, appName: 'FocusBack', timestamp: new Date().toISOString(), durationSeconds: 0 }).catch(() => {})}
          className="w-full py-2.5 rounded-xl font-bold border flex items-center justify-center gap-2 text-sm transition-colors border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
        >
          <Play className="w-4 h-4" /> Back to Focus
        </button>
      ) : (
        <button
          onClick={() => setShowPicker(!showPicker)}
          className={`w-full py-2.5 rounded-xl font-bold border border-dashed flex items-center justify-center gap-2 text-sm transition-colors ${t.border} text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50`}
        >
          <ShieldAlert className="w-4 h-4" /> Log Distraction
        </button>
      )}

      {/* Source picker */}
      {showPicker && (
        <div className={`p-3 rounded-xl border ${t.bgCard} ${t.border} animate-slide-up`}>
          <p className={`text-xs font-bold mb-2 ${t.textMuted}`}>What distracted you?</p>
          <div className="flex flex-wrap gap-2">
            {DISTRACTION_SOURCES.map((s) => (
              <button
                key={s}
                onClick={() => handleLogDistraction(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${t.border} ${t.textMain} hover:border-rose-500/50 hover:text-rose-400`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className={`font-bold text-xs uppercase tracking-wider ${t.textMuted}`}>
            Activity Timeline
          </h4>
          {events.length > 0 && (
            <button
              onClick={() => setEvents([])}
              className={`text-[10px] font-bold ${t.textMuted} hover:text-rose-400 transition-colors`}
            >
              Clear
            </button>
          )}
        </div>

        {events.length === 0 ? (
          <p className={`text-sm ${t.textMuted}`}>
            {enabled ? 'Waiting for activity events…' : 'Enable monitor to start tracking.'}
          </p>
        ) : (
          <div className="relative">
            <div
              className={`absolute top-0 bottom-0 w-0.5 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`}
              style={{ left: '50%' }}
            />
            {events.map((ev) => {
              const isFocus = ev.classification === 'focus';
              const durationMins = Math.ceil((ev.durationSeconds || 0) / 60) || 1;
              const cardWidth = isFocus ? 62 : Math.min(82, Math.max(42, 34 + durationMins * 4));
              const cardHeight = isFocus ? 0 : Math.min(120, Math.max(0, durationMins * 6));
              const timeLabel = ev.timestamp
                ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div key={ev.id} className="relative mb-4 group">
                  <div
                    className={`absolute top-4 w-4 h-4 rounded-full border-[3px] z-10 -translate-x-1/2 ${
                      isFocus ? 'bg-emerald-500' : 'bg-rose-500'
                    } ${theme === 'dark' ? 'border-[#161920]' : 'border-white'}`}
                    style={{ left: '50%' }}
                  />
                  {isFocus ? (
                    <div
                      className={`ml-[56%] p-3 rounded-xl border shadow-sm ${t.bgCard} ${t.border} border-emerald-500/20`}
                      style={{ width: `${cardWidth}%` }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-emerald-500">Focus</span>
                        <span className={`text-[10px] font-bold ${t.textMuted}`}>{timeLabel}</span>
                      </div>
                      <p className={`text-xs ${t.textMain}`}>{ev.appName || ev.windowTitle || 'Focus activity'}</p>
                    </div>
                  ) : (
                    <div
                      className={`p-3 rounded-xl border shadow-sm ${t.bgCard} ${t.border} border-rose-500/20`}
                      style={{
                        width: `${cardWidth}%`,
                        minHeight: `${48 + cardHeight}px`,
                        marginLeft: `${Math.max(0, 48 - cardWidth)}%`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-rose-400">
                          Alert · {durationMins}m
                        </span>
                        <span className={`text-[10px] font-bold ${t.textMuted}`}>{timeLabel}</span>
                      </div>
                      <p className={`text-xs ${t.textMain}`}>{ev.appName || ev.windowTitle || 'Distraction'}</p>
                    </div>
                  )}
                  <button
                    onClick={() => setEvents((prev) => prev.filter((e) => e.id !== ev.id))}
                    className={`absolute right-0 top-1 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${t.textMuted} hover:text-rose-400`}
                  >
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
