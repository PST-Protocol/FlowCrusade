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

// ==========================================
// 1. MOCK DATA & TYPES
// ==========================================

const INITIAL_TASKS = [
  {
    id: 't1', title: 'Assignment 1: History Essay', progress: 40, status: 'pending', date: '2026-02-25',
    desc: 'Complete the final draft for the History 101 assignment covering the industrial revolution. Must include at least 5 primary sources and follow Chicago formatting.',
    children: [
      {
        id: 't1-1', title: 'Research primary sources', progress: 100, status: 'done',
        desc: 'Find at least 3 primary sources from the university library database regarding textile factories and labor conditions.',
        children: []
      },
      {
        id: 't1-2', title: 'Draft body paragraphs', progress: 20, status: 'pending',
        desc: 'Write 3 paragraphs focusing on social impact, economic shift, and technological advancements during the 18th century.',
        children: [
           { id: 't1-2-1', title: 'Outline social impact', progress: 0, status: 'pending', desc: 'Detail the shift from agrarian lifestyle to urban slums. Mention the working class struggles.' },
           { id: 't1-2-2', title: 'Draft economic shift section', progress: 0, status: 'pending', desc: 'Focus on the transition to mass production and the rise of factory owners. 250 words minimum.' },
           { id: 't1-2-3', title: 'Review flow and transitions', progress: 0, status: 'pending', desc: 'Ensure paragraph 1 seamlessly connects to paragraph 2 using appropriate transition words.' }
        ]
      },
      {
        id: 't1-3', title: 'Proofread & Format', progress: 0, status: 'pending',
        desc: 'Run through Grammarly, check Chicago style citations, and generate the final bibliography page.',
        children: []
      }
    ]
  },
  {
    id: 't2', title: 'Team Sync Preparation', progress: 60, status: 'pending', date: '2026-02-26',
    desc: 'Prepare the slide deck and discussion points for the weekly marketing sync.',
    children: []
  },
  {
    id: 't3', title: 'Read Chapter 3', progress: 0, status: 'pending', date: '2026-02-24',
    desc: 'Read chapter 3 of the Biology textbook regarding cellular respiration.',
    children: []
  },
  {
    id: 't4', title: 'Study for Math Midterm', progress: 15, status: 'pending', date: '2026-03-02',
    desc: 'Review all calculus notes from week 1 to 5. Practice integration problems.',
    children: []
  }
];

const INITIAL_STATS = {
  focusTimeToday: 185, // minutes
  sessions: 4,
  avgSession: 46, // minutes
  completionRate: 78, // percent
  topDistractions: ['Instagram', 'TikTok', 'Email'],
  distractCount: 5,
  distractTime: 25, // minutes
  peakFocusTime: '10:00 AM - 12:00 PM',
  streak: 12, // days
  focusScore: 600,
  maxScore: 1000
};

const INITIAL_EVENTS = [
  { id: 1, time: '09:00 AM', type: 'focus', desc: 'Started Focus Session' },
  { id: 2, time: '10:15 AM', type: 'distract', desc: 'Distracted → Instagram (5m)' },
  { id: 3, time: '10:20 AM', type: 'focus', desc: 'Back to Focus' },
  { id: 4, time: '11:45 AM', type: 'distract', desc: 'Distracted → Email (10m)' },
  { id: 5, time: '11:55 AM', type: 'focus', desc: 'Back to Focus' },
];

// Monitor Events: 从 localStorage 读取
const loadEvents = () => {
  try {
    const saved = localStorage.getItem('fc_events');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return INITIAL_EVENTS;
};
const loadTasks = () => {
  try {
    const saved = localStorage.getItem('fc_tasks');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return INITIAL_TASKS;
};
const loadNotes = () => {
  try {
    const saved = localStorage.getItem('fc_notes');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return [
    { id: 'n1', text: 'Ask professor about the extension for the essay.', time: '10:00 AM' },
    { id: 'n2', text: 'Buy milk and coffee beans later.', time: '11:30 AM' }
  ];
};

// ==========================================
// 2. THEME DEFINITIONS
// ==========================================

const THEMES = {
  dark: {
    bgApp: 'bg-[#0f1115]',
    bgPanel: 'bg-[#161920]',
    bgCard: 'bg-[#1c202a]',
    bgInput: 'bg-[#161920]',
    border: 'border-white/5',
    borderFocus: 'border-indigo-500/50',
    textMain: 'text-gray-100',
    textMuted: 'text-gray-400',
    accentHover: 'hover:bg-indigo-500/10 hover:text-indigo-400',
    accentActive: 'bg-indigo-500/15 text-indigo-400',
    primaryBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    secondaryBtn: 'bg-white/5 hover:bg-white/10 text-gray-300',
    glow: 'shadow-[0_0_15px_rgba(99,102,241,0.15)]'
  },
  light: {
    bgApp: 'bg-slate-50',
    bgPanel: 'bg-white',
    bgCard: 'bg-white',
    bgInput: 'bg-slate-50',
    border: 'border-slate-200',
    borderFocus: 'border-indigo-400',
    textMain: 'text-slate-900',
    textMuted: 'text-slate-500',
    accentHover: 'hover:bg-indigo-50 hover:text-indigo-600',
    accentActive: 'bg-indigo-50 text-indigo-600',
    primaryBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm',
    secondaryBtn: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    glow: 'shadow-lg shadow-indigo-100'
  }
};

// ==========================================
// 2.5 LEVELS & REWARDS (Demo Logic)
// ==========================================

const LEVELS = [
  { key: 'newbie', name: 'Newbie', min: 0, max: 199 },
  { key: 'bronze', name: 'Bronze', min: 200, max: 499 },
  { key: 'silver', name: 'Silver', min: 500, max: 999 },
  { key: 'gold', name: 'Gold', min: 1000, max: 1999 },
  { key: 'diamond', name: 'Diamond', min: 2000, max: Infinity },
];

const REWARD_MILESTONES = [1000, 2000, 3000];

function getLevelForMinutes(mins) {
  const v = Number(mins) || 0;
  return LEVELS.find(l => v >= l.min && v <= l.max) || LEVELS[0];
}

function getRewardBounds(totalMins) {
  const v = Number(totalMins) || 0;
  let prev = 0;
  for (const m of REWARD_MILESTONES) {
    if (v >= m) prev = m;
  }
  const next = REWARD_MILESTONES.find(m => m > v) ?? (Math.ceil((v + 1) / 1000) * 1000);
  return { prev, next };
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function formatMins(m) { const v = Math.max(0, Math.round(Number(m) || 0)); return `${v}m`; }


// ==========================================
// 3. MAIN APP COMPONENT
// ==========================================

export default function FlowCrusadeApp() {
  // Global States
  // Default to Day theme (user request)
  const [theme, setTheme] = useState('light');
  const t = THEMES[theme];
  
  const [tasks, setTasks] = useState(loadTasks);
  const [activeTaskId, setActiveTaskId] = useState(null); // Which root task is active
  const [path, setPath] = useState([]); // Subtask drill-down path: [taskId, subtaskId, ...]
  
  const [stats, setStats] = useState(INITIAL_STATS);
  const [events, setEvents] = useState(loadEvents);

  // Monitor Events: 每次变化自动保存
  useEffect(() => {
    localStorage.setItem('fc_events', JSON.stringify(events));
  }, [events]);
  const [notes, setNotes] = useState(loadNotes);
  const [isNotesOpen, setIsNotesOpen] = useState(false); // mobile / tablet drawer
  const [isNotesSidebarOpen, setIsNotesSidebarOpen] = useState(true); // desktop sidebar
  const [notesSidebarWidth, setNotesSidebarWidth] = useState(320); // default 320px, resizable
  const [navWidth, setNavWidth] = useState(180); // left nav width, resizable
  const [navCollapsed, setNavCollapsed] = useState(false); // 左侧导航折叠

  // Tasks: 每次变化自动保存到 localStorage
  useEffect(() => {
    localStorage.setItem('fc_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Quick Notes: 每次 notes 变化自动保存到 localStorage
  useEffect(() => {
    localStorage.setItem('fc_notes', JSON.stringify(notes));
  }, [notes]);
  const [settings, setSettings] = useState({
    theme: 'light',
    monitorEnabled: true,
    distractThreshold: 5,
    storagePath: '/Users/local/flow-crusade/data',
    apiKey: 'sk-mock-123456',
    notifications: true
  });

  // UI States
  const [activePanel, setActivePanel] = useState(null); // 'calendar'|'stats'|'monitor'|'settings'
  const [isFocusedMode, setIsFocusedMode] = useState(false); // Collapses sidebars
  const [toast, setToast] = useState(null);
  const [isRewardsOpen, setIsRewardsOpen] = useState(false);

  // Sync settings theme to state
  useEffect(() => { setTheme(settings.theme); }, [settings.theme]);

  // Rewards + level are measured in "focus minutes" (demo).
  const rewardBounds = getRewardBounds(stats.focusScore);
  const rewardProgress = clamp01((stats.focusScore - rewardBounds.prev) / (rewardBounds.next - rewardBounds.prev));
  const nearReward = rewardProgress >= 0.9;
  const userLevel = getLevelForMinutes(stats.focusScore);


  // Determine App State
  // State A: !activeTaskId
  // State B: activeTaskId && path.length === 0
  // State C/E: activeTaskId && path.length > 0
  // State D is handled inline when a specific subtask is actively being focused (local state inside ViewCE)
  
  const activeRootTask = tasks.find(tsk => tsk.id === activeTaskId);
  
  // Helpers
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  };
  const openRewards = () => setIsRewardsOpen(true);
  const closeRewards = () => setIsRewardsOpen(false);

  const requestAIBreakdown = async (taskTitle, taskDesc = '') => {
    const response = await fetch('http://localhost:8787/api/breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: taskTitle,
        context: taskDesc,
      }),
    });

    if (!response.ok) {
      let err = {};
      try {
        err = await response.json();
      } catch {
        err = { error: 'AI breakdown failed' };
      }
      throw new Error(err.error || 'AI breakdown failed');
    }

    return response.json();
  };

  const convertAiStepsToChildren = (steps, parentId, source = 'ai') => {
    return steps.map((step, index) => ({
      id: `${parentId}-ai-${index + 1}`,
      title: step.title,
      progress: 0,
      status: step.status || 'pending',
      desc: `${step.desc || ''}${step.estimatedMinutes ? ` (${step.estimatedMinutes} min)` : ''}`,
      estimatedMinutes: step.estimatedMinutes || 10,
      priority: step.priority || index + 1,
      aiSource: source,
      children: Array.isArray(step.children) ? step.children : [],
    }));
  };

  const createNewTask = (title, date) => {
    const d = date || new Date().toISOString().split('T')[0];
    const newTask = {
      id: `task_${Date.now()}`,
      title,
      progress: 0,
      status: 'pending',
      date: d,
      desc: 'No description provided.',
      children: []
    };
    setTasks([...tasks, newTask]);
    showToast('Task added successfully');
    return newTask;
  };

  const deleteTask = (taskId) => {
    setTasks(tasks.filter(tk => tk.id !== taskId));
    if (activeTaskId === taskId) setActiveTaskId(null);
    showToast('Task deleted');
  };

  const toggleTask = (taskId) => {
    setTasks(tasks.map(tk => 
      tk.id === taskId ? { ...tk, status: tk.status === 'done' ? 'pending' : 'done', progress: tk.status === 'done' ? 0 : 100 } : tk
    ));
  };

  const handleBreakdown = async (taskIdToBreakdown) => {
    try {
      const findTaskById = (list, id) => {
        for (const item of list) {
          if (item.id === id) return item;
          if (item.children?.length) {
            const found = findTaskById(item.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      const root = tasks.find(t => t.id === activeTaskId) || tasks.find(t => t.id === taskIdToBreakdown);
      if (!root) return;

      const targetNode = taskIdToBreakdown === root.id ? root : findTaskById(root.children || [], taskIdToBreakdown);
      if (!targetNode) return;

      showToast('Generating AI breakdown...');

      const result = await requestAIBreakdown(targetNode.title, targetNode.desc || '');
      const aiChildren = convertAiStepsToChildren(result.steps || [], targetNode.id, result.source || 'ai');

      const updateNodeChildren = (list, id, newChildren) => {
        return list.map(item => {
          if (item.id === id) {
            return {
              ...item,
              children: newChildren,
            };
          }
          if (item.children?.length) {
            return {
              ...item,
              children: updateNodeChildren(item.children, id, newChildren),
            };
          }
          return item;
        });
      };

      setTasks(prev =>
        prev.map(task => {
          if (task.id !== root.id) return task;
          if (targetNode.id === root.id) {
            return {
              ...task,
              children: aiChildren,
            };
          }
          return {
            ...task,
            children: updateNodeChildren(task.children || [], targetNode.id, aiChildren),
          };
        })
      );

      if (targetNode.id === root.id) {
        setPath([root.id]);
      } else {
        setPath(prev => [...prev, targetNode.id]);
      }

      setIsFocusedMode(true);
      showToast('AI breakdown generated');
    } catch (error) {
      console.error(error);
      showToast('AI breakdown failed', 'warning');
    }
  };

  const handleReturnToRoot = () => {
    setPath([]);
    setIsFocusedMode(false);
  };

  const handleSimulateDistraction = (source = 'Reddit') => {
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    setEvents([{ id: Date.now(), time, type: 'distract', desc: `Distracted → ${source}`, source }, ...events]);
    setStats(prev => ({
      ...prev,
      distractCount: prev.distractCount + 1,
      distractTime: prev.distractTime + 2
    }));
    showToast(`Distraction: ${source}`, 'warning');
  };

  const addFocusEvent = () => {
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    setEvents([{ id: Date.now(), time, type: 'focus', desc: 'Back to Focus' }, ...events]);
    showToast('Back to focus!');
  };

  const deleteEvent = (eventId) => {
    setEvents(events.filter(ev => ev.id !== eventId));
  };

  const clearAllEvents = () => {
    setEvents([]);
    showToast('Timeline cleared');
  };

  return (
    <div className={`flex h-screen w-full font-sans overflow-hidden selection:bg-indigo-500/30 transition-colors duration-300 ${t.bgApp} ${t.textMain}`}>
      
      {/* ================= LEFT SIDEBAR ================= */}
      <nav className={`flex flex-col items-center py-6 ${t.bgPanel} ${t.border} border-r transition-colors duration-300 z-40 shrink-0 relative`}
        style={{ width: isFocusedMode ? 64 : navCollapsed ? 56 : navWidth }}>
        
        {/* 右侧拖拽条 */}
        {!isFocusedMode && !navCollapsed && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 group"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = navWidth;
              const onMove = (ev) => {
                const diff = ev.clientX - startX;
                setNavWidth(Math.max(60, Math.min(280, startW + diff)));
              };
              const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          >
            <div className={`w-0.5 h-full mx-auto transition-colors group-hover:bg-indigo-500/50 ${t.border}`}></div>
          </div>
        )}
        {/* Logo + 折叠按钮 */}
        <div className={`flex items-center mb-8 px-3 w-full ${navCollapsed || isFocusedMode ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center gap-2 ${t.textMain}`}>
            <img src="/logo.png" alt="FlowCrusade" className="w-8 h-8 shrink-0 object-contain" />
            {!navCollapsed && !isFocusedMode && navWidth > 130 && <span className="text-base font-bold tracking-tight whitespace-nowrap">FlowCrusade</span>}
          </div>
          {!isFocusedMode && !navCollapsed && navWidth > 130 && (
            <button onClick={() => setNavCollapsed(true)} className={`p-1.5 rounded-lg transition-colors text-indigo-400 hover:bg-indigo-500/10`} title="Collapse menu">
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* 折叠时：hamburger 按钮展开 */}
        {navCollapsed && !isFocusedMode && (
          <button onClick={() => setNavCollapsed(false)} className="mb-4 p-2 rounded-lg transition-colors text-indigo-400 hover:bg-indigo-500/10" title="Expand menu">
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Nav Items */}
        <div className="flex flex-col gap-3 w-full px-3">
          <NavItem t={t} icon={<CalendarIcon/>} label="Calendar" active={activePanel === 'calendar'} isFocusedMode={isFocusedMode} showLabel={!navCollapsed && navWidth > 120} onClick={() => setActivePanel(activePanel === 'calendar' ? null : 'calendar')} />
          <NavItem t={t} icon={<BarChart2/>} label="Statistics" active={activePanel === 'stats'} isFocusedMode={isFocusedMode} showLabel={!navCollapsed && navWidth > 120} onClick={() => setActivePanel(activePanel === 'stats' ? null : 'stats')} />
          <NavItem t={t} icon={<Activity/>} label="Monitor" active={activePanel === 'monitor'} isFocusedMode={isFocusedMode} showLabel={!navCollapsed && navWidth > 120} onClick={() => setActivePanel(activePanel === 'monitor' ? null : 'monitor')} />
          <NavItem t={t} icon={<SettingsIcon/>} label="Settings" active={activePanel === 'settings'} isFocusedMode={isFocusedMode} showLabel={!navCollapsed && navWidth > 120} onClick={() => setActivePanel(activePanel === 'settings' ? null : 'settings')} />
        </div>

        <div className="flex-grow" />

        {/* Reward Progress Orb */}
        <div className="mb-4 flex flex-col items-center w-full px-2 overflow-hidden">
          <button
            type="button"
            onClick={openRewards}
            className={`group relative w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm transition-transform active:scale-95 mx-auto ${theme === 'dark' ? 'bg-[#1c202a] border-white/5' : 'bg-white border-slate-200'} ${nearReward ? 'ring-2 ring-indigo-500/25' : ''}`}
            title="Rewards progress"
          >
            <ProgressRing percent={rewardProgress} theme={theme} size={40} stroke={4} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'} ${nearReward ? 'drop-shadow-[0_0_10px_rgba(99,102,241,0.35)]' : ''}`} />
            </div>
          </button>

          {!isFocusedMode && !navCollapsed && navWidth > 130 && (
            <div className="text-center mt-2 text-xs font-bold text-indigo-500">
              {formatMins(stats.focusScore)} <span className={t.textMuted}>/ {formatMins(rewardBounds.next)}</span>
            </div>
          )}
          {!isFocusedMode && !navCollapsed && navWidth > 130 && (
            <div className={`text-center mt-1 text-[10px] font-semibold ${t.textMuted}`}>
              {userLevel.name}
            </div>
          )}
        </div>
      </nav>

      {/* LEFT PANELS OVERLAYS */}
      <LeftPanels 
        t={t} theme={theme} activePanel={activePanel} close={() => setActivePanel(null)} 
        stats={stats} events={events} tasks={tasks} settings={settings} setSettings={setSettings}
        onSimulateDistraction={handleSimulateDistraction}
        onAddFocusEvent={addFocusEvent}
        onDeleteEvent={deleteEvent}
        onClearEvents={clearAllEvents}
        onSelectTask={(id) => { setActiveTaskId(id); setPath([]); setIsFocusedMode(false); }}
        onCreateTask={(title, date) => createNewTask(title, date)}
        onDeleteTask={deleteTask}
        onToggleTask={toggleTask}
        activeTaskId={activeTaskId}
        showToast={showToast}
      />

      {/* ================= MAIN CANVAS ================= */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Top Header / Breadcrumbs */}
        {activeTaskId && (
          <header className={`h-16 flex items-center justify-between px-6 md:px-10 border-b ${t.border} ${theme === 'dark' ? 'bg-[#0f1115]/80' : 'bg-slate-50/80'} backdrop-blur-md z-10 shrink-0`}>
             <div className="flex items-center gap-2 text-sm font-medium">
                <button 
                  onClick={() => { setActiveTaskId(null); setPath([]); setIsFocusedMode(false); }} 
                  className={`flex items-center gap-1 ${t.textMuted} hover:text-indigo-500 transition-colors`}
                >
                  <Home className="w-4 h-4" /> Home
                </button>
                
                {path.length >= 0 && (
                  <>
                    <ChevronRight className={`w-4 h-4 ${t.textMuted}`} />
                    <button 
                      onClick={handleReturnToRoot}
                      className={`truncate max-w-[120px] transition-colors ${path.length === 0 ? 'text-indigo-500 font-bold' : `${t.textMuted} hover:text-indigo-500`}`}
                    >
                      {activeRootTask?.title}
                    </button>
                  </>
                )}

                {(path.length > 0 && path[0] === activeRootTask?.id ? path.slice(1) : path).map((stepId, index, normalizedPath) => {
                  let stepTitle = 'Subtask';
                  let list = activeRootTask?.children || [];
                  for (let i = 0; i <= index; i++) {
                    const node = list.find(n => n.id === normalizedPath[i]);
                    if (node) {
                      stepTitle = node.title;
                      list = node.children || [];
                    }
                  }
                  const isLast = index === normalizedPath.length - 1;
                  return (
                    <React.Fragment key={stepId}>
                      <ChevronRight className={`w-4 h-4 ${t.textMuted}`} />
                      <button 
                        onClick={() => {
                          const base = path.length > 0 && path[0] === activeRootTask?.id ? [activeRootTask.id] : [];
                          setPath([...base, ...normalizedPath.slice(0, index + 1)]);
                        }}
                        className={`truncate max-w-[150px] transition-colors ${isLast ? 'text-indigo-500 font-bold' : `${t.textMuted} hover:text-indigo-500`}`}
                      >
                        {stepTitle}
                      </button>
                    </React.Fragment>
                  );
                })}
             </div>

             <div className="flex items-center gap-3">
               <button onClick={() => {setActiveTaskId(null); setPath([]); setIsFocusedMode(false);}} className={`text-xs px-3 py-1.5 rounded-lg ${t.secondaryBtn}`}>
                 Clear Active Task
               </button>
             </div>
          </header>
        )}

        {/* Dynamic Views */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col relative custom-scrollbar">
          
          {/* STATE A: No Pending Task */}
          {!activeTaskId && (
            <ViewA t={t} theme={theme} onSubmit={(val) => {
              const newTask = createNewTask(val);
              setActiveTaskId(newTask.id);
            }} showToast={showToast} />
          )}

          {/* STATE B: Active Task Overview */}
          {activeTaskId && path.length === 0 && (
            <ViewB t={t} theme={theme} task={activeRootTask} onBreakdown={() => handleBreakdown(activeRootTask.id)} tasks={tasks} onSwitchTask={(id) => {setActiveTaskId(id); setPath([])}} showToast={showToast} />
          )}

          {/* STATE C & E: Breakdown & Focus Views */}
          {activeTaskId && path.length > 0 && (
            <ViewCE 
              t={t} theme={theme}
              rootTask={activeRootTask} 
              path={path}
              onBreakdown={handleBreakdown}
              showToast={showToast}
            />
          )}
        </div>
      </main>

      {/* ================= RIGHT SIDEBAR: QUICK NOTES ================= */}
      {isNotesSidebarOpen && !isFocusedMode && (
        <aside className={`flex-col border-l z-10 shrink-0 hidden lg:flex relative ${t.bgPanel} ${t.border}`}
          style={{ width: notesSidebarWidth }}
        >
          {/* 左边拖拽条 */}
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-20 group -ml-1"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = notesSidebarWidth;
              const onMove = (ev) => {
                const diff = startX - ev.clientX;
                const newW = Math.max(200, Math.min(500, startW + diff));
                setNotesSidebarWidth(newW);
              };
              const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          >
            <div className={`w-0.5 h-full mx-auto transition-colors group-hover:bg-indigo-500 ${t.border}`}></div>
          </div>
          <QuickNotesPanel t={t} theme={theme} notes={notes} setNotes={setNotes} onClose={() => setIsNotesSidebarOpen(false)} />
        </aside>
      )}
      {isFocusedMode && (
        <aside className={`flex flex-col border-l transition-all duration-300 z-10 shrink-0 w-16 cursor-pointer ${t.bgPanel} ${t.border} ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
               onClick={() => setIsFocusedMode(false)}>
          <div className={`flex flex-col items-center py-6 h-full ${t.textMuted}`}>
            <Edit3 className="w-5 h-5 mb-4" />
            <div className="writing-vertical-rl text-[10px] tracking-[0.2em] uppercase opacity-50">Quick Notes</div>
          </div>
        </aside>
      )}
      {/* Desktop: Quick Notes 关闭后的小按钮，点击重新打开 */}
      {!isNotesSidebarOpen && !isFocusedMode && (
        <button
          onClick={() => setIsNotesSidebarOpen(true)}
          className={`fixed top-4 right-4 z-30 hidden lg:flex p-2.5 rounded-xl shadow-lg border transition-colors ${t.bgPanel} ${t.border} ${t.textMuted} hover:text-indigo-400 hover:border-indigo-500/50`}
          title="Open Quick Notes"
        >
          <Edit3 className="w-4 h-4" />
        </button>
      )}

      {/* Mobile/Tablet: Quick Notes FAB + Drawer (so notes work below lg) */}
      <button
        onClick={() => setIsNotesOpen(true)}
        className={`fixed bottom-6 right-6 lg:hidden z-30 p-4 rounded-2xl shadow-xl border transition-colors ${t.bgPanel} ${t.border} ${t.textMain} hover:border-indigo-500/40 hover:bg-indigo-500/5`}
        aria-label="Open Quick Notes"
        title="Quick Notes"
      >
        <Edit3 className="w-5 h-5" />
      </button>

      {isNotesOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setIsNotesOpen(false)}
          />
          <div className={`absolute right-0 top-0 bottom-0 w-full max-w-md border-l shadow-2xl flex flex-col ${t.bgPanel} ${t.border} animate-slide-up`}>
            <div className={`p-6 flex items-center justify-between border-b ${t.border}`}>
              <h3 className={`font-bold text-lg ${t.textMain}`}>Quick Notes</h3>
              <button
                onClick={() => setIsNotesOpen(false)}
                className={`p-2 rounded-xl transition-colors ${t.textMuted} ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
                aria-label="Close Quick Notes"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              <QuickNotesPanel t={t} theme={theme} notes={notes} setNotes={setNotes} showHeader={false} />
            </div>
          </div>
        </div>
      )}

      <RewardProgressModal open={isRewardsOpen} onClose={closeRewards} t={t} theme={theme} stats={stats} />

      {/* Global Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 md:left-1/2 md:-translate-x-1/2 md:right-auto z-50 animate-fade-in">
          <div className={`px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${theme === 'dark' ? 'bg-[#2a2e38] border-white/10 text-white' : 'bg-gray-900 border-gray-800 text-white'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 text-amber-400" />}
            {toast.msg}
          </div>
        </div>
      )}

    </div>
  );
}

// ==========================================
// VIEW COMPONENTS
// ==========================================

// STATE A: No Task
function ViewA({ t, theme, onSubmit, showToast }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full animate-fade-in">
      <div className="text-center mb-12">
        <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center border ${theme === 'dark' ? 'bg-[#1c202a] border-white/10 shadow-[0_0_30px_rgba(99,102,241,0.1)]' : 'bg-white border-slate-200 shadow-xl shadow-indigo-100'}`}>
           <img src="/logo.png" alt="FlowCrusade" className="w-10 h-10 object-contain" />
        </div>
        <h1 className={`text-3xl md:text-4xl font-bold tracking-tight mb-4 ${t.textMain}`}>What are we crushing today?</h1>
        <p className={`text-lg ${t.textMuted}`}>Enter a task, drop an assignment, and let's break it down.</p>
      </div>

      <div className="w-full mt-4">
        <ChatInput t={t} theme={theme} onSubmit={onSubmit} onUploadClick={() => showToast('Mock Upload Triggered')} placeholder="e.g. Write a 5-page history essay by Friday..." />
      </div>

      <div className="flex flex-wrap justify-center gap-3 mt-10">
         <SuggestionBadge t={t} text="Study for Math Midterm" onClick={() => onSubmit("Study for Math Midterm")} />
         <SuggestionBadge t={t} text="Clean my room" onClick={() => onSubmit("Clean my room")} />
         <SuggestionBadge t={t} text="Read 2 chapters" onClick={() => onSubmit("Read 2 chapters")} />
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
function ViewB({ t, theme, task, tasks, onBreakdown, onSwitchTask, showToast }) {
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
                  <button key={tk.id} onClick={() => {onSwitchTask(tk.id); setShowSwitch(false);}} className={`w-full text-left px-4 py-3 text-sm hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors ${tk.id === task.id ? 'text-indigo-500 font-bold bg-indigo-500/5' : t.textMuted}`}>
                    {tk.title}
                  </button>
                ))}
              </div>
            )}
         </div>
      </div>

      <div className={`rounded-3xl p-8 md:p-12 shadow-2xl border relative overflow-hidden group ${t.bgCard} ${t.border}`}>
        {/* Decorative background glow in dark mode */}
        {theme === 'dark' && <div className="absolute -right-32 -top-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />}

        <div className="relative z-10">
          <h2 className={`text-3xl md:text-4xl font-bold mb-4 leading-tight ${t.textMain}`}>{task.title}</h2>
          
          <CollapsibleText t={t} text={task.desc} />
          
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

          <div className="flex items-center gap-4">
            <button 
              onClick={onBreakdown}
              className={`group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl overflow-hidden hover:bg-indigo-500 transition-all active:scale-95 shadow-[0_0_20px_rgba(99,102,241,0.3)]`}
            >
              <Zap className="w-5 h-5 relative z-10 fill-white/20" />
              <span className="relative z-10">Breakdown Task</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-12 w-full max-w-3xl mx-auto">
        <ChatInput t={t} theme={theme} onSubmit={() => showToast("Context added to task")} onUploadClick={() => showToast('Mock Upload')} placeholder="Add more context to this task before breaking it down..." />
      </div>
    </div>
  );
}

// STATE C & E: Breakdown List / Detail Handlers
function ViewCE({ t, theme, rootTask, path, onBreakdown, showToast }) {
  const [focusingSubtask, setFocusingSubtask] = useState(null); // Local state for State D

  // Resolve current context based on path
  let currentContext = rootTask;
  let contextList = rootTask.children || [];

  const normalizedPath =
    path.length > 0 && path[0] === rootTask.id ? path.slice(1) : path;

  for (let i = 0; i < normalizedPath.length; i++) {
    const node = contextList.find(n => n.id === normalizedPath[i]);
    if (node) {
      currentContext = node;
      contextList = node.children || [];
    }
  }

  // STATE D: Specific Focus View
  if (focusingSubtask) {
    const activeSubtask = contextList.find(n => n.id === focusingSubtask) || currentContext;
    return <FocusDetailView t={t} theme={theme} task={activeSubtask} onBack={() => setFocusingSubtask(null)} onComplete={() => {showToast("Subtask Completed!", 'success'); setFocusingSubtask(null);}} onFurtherBreakdown={() => { setFocusingSubtask(null); onBreakdown(activeSubtask.id); }} onRegenerate={() => { setFocusingSubtask(null); onBreakdown(activeSubtask.id); }} />
  }

  // STATE C / E: List View
  return (
    <div className="flex-1 max-w-4xl mx-auto w-full animate-fade-in pb-10">
      
      <div className={`mb-8 mt-2 flex justify-between items-end border-b pb-6 ${t.border}`}>
        <div>
          <h2 className={`text-2xl font-bold mb-2 ${t.textMain}`}>{currentContext.title}</h2>
          <p className={`text-sm ${t.textMuted}`}>Select a step to focus on, or break it down further.</p>
        </div>
        <button onClick={() => onBreakdown(currentContext.id)} className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${t.secondaryBtn}`}>
          <RefreshCw className="w-4 h-4" /> Regenerate
        </button>
      </div>

      <div className="space-y-4">
        {contextList.map((sub, index) => (
          <div key={sub.id} className={`rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all group flex flex-col md:flex-row md:items-start justify-between gap-6 animate-slide-up ${t.bgCard} ${t.border} hover:${t.borderFocus}`} style={{animationDelay: `${index * 0.05}s`}}>
            
            <div className="flex items-start gap-4 flex-1 pt-1">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0 mt-1 border border-indigo-500/20">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`text-lg font-bold transition-colors cursor-pointer hover:text-indigo-400 ${t.textMain}`} onClick={() => setFocusingSubtask(sub.id)}>
                    {sub.title}
                  </h3>
                  {sub.aiSource && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                        sub.aiSource === 'gemini'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}
                    >
                      {sub.aiSource === 'gemini' ? 'AI' : 'Local'}
                    </span>
                  )}
                </div>
                <div className="mt-2">
                   <CollapsibleText t={t} text={sub.desc} defaultExpanded={false} />
                </div>
                
                {sub.children && sub.children.length > 0 && (
                  <div className={`flex items-center gap-2 mt-4 text-xs font-semibold px-3 py-1.5 rounded-md w-fit ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'} ${t.textMuted}`}>
                     <ChevronRight className="w-3 h-3" />
                     {sub.children.length} deeper sub-steps available
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center bg-transparent p-1 rounded-xl">
              <button 
                onClick={() => onBreakdown(sub.id)}
                className={`p-2.5 rounded-lg transition-colors tooltip-trigger ${t.textMuted} hover:text-indigo-400 hover:bg-indigo-500/10`}
                title="Regenerate / Modify"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              
              <button 
                onClick={() => onBreakdown(sub.id)}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${t.secondaryBtn}`}
              >
                Breakdown
              </button>

              <button 
                onClick={() => setFocusingSubtask(sub.id)}
                className={`px-5 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${t.primaryBtn}`}
              >
                <Play className="w-4 h-4 fill-current" /> Focus
              </button>
            </div>
          </div>
        ))}

        {contextList.length === 0 && (
          <div className={`text-center py-16 border-2 border-dashed rounded-3xl ${t.border} ${t.bgCard}`}>
            <p className={`mb-6 text-lg ${t.textMuted}`}>No sub-steps yet. Need help starting?</p>
            <button onClick={() => onBreakdown(currentContext.id)} className={`px-8 py-3 font-bold rounded-xl transition-colors ${t.primaryBtn}`}>
              Auto-Breakdown via AI
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// STATE D: Focus Detail View
function FocusDetailView({ t, theme, task, onComplete, onBack, onFurtherBreakdown, onRegenerate }) {
  const initialMinutes = task?.estimatedMinutes || 25;
  const [selectedMinutes, setSelectedMinutes] = useState(initialMinutes);
  const [customMinutes, setCustomMinutes] = useState(String(initialMinutes));
  const [timeLeft, setTimeLeft] = useState(initialMinutes * 60);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const m = task?.estimatedMinutes || 25;
    setSelectedMinutes(m);
    setCustomMinutes(String(m));
    setTimeLeft(m * 60);
    setIsActive(false);
  }, [task?.id]);

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const updateMinutes = (m) => {
    const safeMinutes = Math.max(1, Math.min(180, Number(m) || 25));
    setSelectedMinutes(safeMinutes);
    setCustomMinutes(String(safeMinutes));
    setIsActive(false);
    setTimeLeft(safeMinutes * 60);
  };

  const applyCustomMinutes = () => {
    updateMinutes(customMinutes);
  };

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(selectedMinutes * 60);
  };
  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full animate-fade-in relative pt-2">
      
      <button onClick={onBack} className={`flex items-center gap-2 font-semibold mb-8 w-fit transition-colors ${t.textMuted} hover:text-indigo-400`}>
        <ChevronLeft className="w-5 h-5" /> Back to list
      </button>

      <div className={`rounded-3xl p-8 md:p-14 shadow-2xl border flex flex-col items-center text-center relative overflow-hidden ${t.bgCard} ${t.border}`}>
        
        {/* Radar Ping Animation for Focus */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] aspect-square rounded-full border-[2px] border-indigo-500/10 pointer-events-none transition-transform duration-1000 ${isActive ? 'scale-110 animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]' : 'scale-100 opacity-0'}`} />

        <div className="relative z-10 w-full">
          <span className="inline-block px-4 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-bold tracking-widest uppercase mb-6 border border-indigo-500/20">Hyper Focus Mode</span>
          <h2 className={`text-2xl md:text-3xl font-bold mb-6 leading-tight ${t.textMain}`}>{task.title}</h2>
          
          <div className="max-w-xl mx-auto mb-8">
            <p className={`text-base leading-relaxed ${t.textMuted}`}>
              {task.desc || "Focus on this single step. Eliminate distractions. You can do this."}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap mb-4">
            {[5, 10, 15, 25, 45].map((m) => (
              <button
                key={m}
                onClick={() => updateMinutes(m)}
                disabled={isActive}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                  selectedMinutes === m
                    ? 'bg-indigo-500 text-white border-indigo-500'
                    : `${t.secondaryBtn}`
                } ${isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {m} min
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 mb-8">
            <input
              type="number"
              min="1"
              max="180"
              value={customMinutes}
              disabled={isActive}
              onChange={(e) => setCustomMinutes(e.target.value)}
              className={`w-28 px-4 py-3 rounded-xl border text-center text-base font-semibold outline-none ${t.bgInput} ${t.border} ${t.textMain} ${isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="mins"
            />
            <button
              onClick={applyCustomMinutes}
              disabled={isActive}
              className={`px-4 py-3 rounded-xl font-bold transition-colors ${
                isActive
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-500 text-white hover:bg-indigo-400'
              }`}
            >
              Apply
            </button>
          </div>

          {/* Timer Display */}
          <div className={`text-7xl md:text-8xl font-black tracking-tighter mb-12 font-mono drop-shadow-lg ${t.textMain}`}>
            {formatTime(timeLeft)}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mb-10">
            <button onClick={resetTimer} className={`p-4 rounded-2xl transition-colors ${t.secondaryBtn}`} title="Reset Timer">
              <RotateCcw className="w-6 h-6" />
            </button>
            
            <button 
              onClick={toggleTimer}
              className={`flex items-center justify-center gap-3 px-10 py-5 rounded-2xl text-xl font-bold text-white transition-all active:scale-95 shadow-lg ${isActive ? 'bg-amber-500 shadow-amber-500/20 hover:bg-amber-400' : 'bg-indigo-600 shadow-indigo-600/30 hover:bg-indigo-500'}`}
            >
              {isActive ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
              {isActive ? 'Pause Focus' : 'Start Focus'}
            </button>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-3 items-center justify-center gap-4 mt-8 pt-8 border-t w-full ${t.border}`}>
            <button onClick={onFurtherBreakdown} className={`px-6 py-3 rounded-xl font-bold transition-colors w-full ${t.secondaryBtn}`}>
              Too hard? Breakdown further
            </button>
            <button onClick={onRegenerate} className="px-6 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-bold hover:bg-amber-100 transition-colors flex items-center justify-center gap-2 w-full">
              <RefreshCw className="w-5 h-5" /> Regenerate
            </button>
            <button onClick={onComplete} className="px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-2 w-full">
              <CheckCircle className="w-5 h-5" /> Mark Completed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// UI & UTILITY COMPONENTS
// ==========================================

function NavItem({ t, icon, label, active, isFocusedMode, onClick, showLabel = true }) {
  const hideLabel = isFocusedMode || !showLabel;
  return (
    <button 
      onClick={onClick}
      className={`relative flex items-center gap-3 p-3 rounded-xl transition-all group font-semibold text-sm ${active ? t.accentActive : `${t.textMuted} ${t.accentHover}`} ${hideLabel ? 'justify-center' : 'justify-start'}`}
      title={hideLabel ? label : undefined}
    >
      <div className="w-6 h-6 shrink-0">
        {icon}
      </div>
      {!hideLabel && <span className="whitespace-nowrap overflow-hidden">{label}</span>}
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
    </button>
  );
}

function ChatInput({ t, theme, onSubmit, onUploadClick, placeholder }) {
  const [val, setVal] = useState('');
  const disabledSendCls = theme === 'dark'
    ? 'bg-white/5 text-gray-500'
    : 'bg-slate-200 text-slate-400';
  
  return (
    <div className={`relative flex items-center border shadow-xl rounded-full p-2 focus-within:ring-2 focus-within:border-indigo-500 transition-all w-full max-w-3xl mx-auto ${t.bgInput} ${t.border}`}>
      <button onClick={onUploadClick} className={`p-3 rounded-full transition-colors shrink-0 ${t.textMuted} hover:bg-indigo-500/10 hover:text-indigo-400`} title="Upload File">
        <Paperclip className="w-5 h-5" />
      </button>
      
      <input 
        type="text" 
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if(e.key === 'Enter' && val.trim()) { onSubmit(val); setVal(''); } }}
        placeholder={placeholder}
        className={`flex-1 bg-transparent px-3 py-2 focus:outline-none text-base ${t.textMain}`}
      />
      
      <div className="flex items-center gap-1 shrink-0 pr-1">
        <button className={`p-3 rounded-full transition-colors hidden sm:block ${t.textMuted} hover:bg-indigo-500/10 hover:text-indigo-400`}>
          <Mic className="w-5 h-5" />
        </button>
        <button 
          onClick={() => { if(val.trim()) { onSubmit(val); setVal(''); } }}
          disabled={!val.trim()}
          className={`p-3 rounded-full transition-all flex items-center justify-center ${val.trim() ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-500 active:scale-95' : disabledSendCls}`}
        >
          <Send className={`w-5 h-5 ${val.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''}`} />
        </button>
      </div>
    </div>
  );
}

function CollapsibleText({ t, text, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  return (
    <div>
      <p className={`text-base leading-relaxed transition-all ${t.textMuted} ${!expanded ? 'line-clamp-2' : ''}`}>
        {text}
      </p>
      {text && text.length > 100 && (
        <button onClick={() => setExpanded(!expanded)} className="text-indigo-400 text-sm font-semibold mt-1 hover:text-indigo-300">
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

// ==========================================
// LEFT PANELS (Overlays)
// ==========================================


function ProgressRing({ percent, theme, size = 48, stroke = 5 }) {
  const p = clamp01(percent);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * p;
  const gap = c - dash;

  const track = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.12)';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
      <defs>
        <linearGradient id="orbGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(99,102,241)" />
          <stop offset="100%" stopColor="rgb(217,70,239)" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="url(#orbGradient)"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function RewardProgressModal({ open, onClose, t, theme, stats }) {
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

function LeftPanels({ t, theme, activePanel, close, stats, events, tasks, settings, setSettings, onSimulateDistraction, onAddFocusEvent, onDeleteEvent, onClearEvents, onSelectTask, onCreateTask, onDeleteTask, onToggleTask, activeTaskId, showToast }) {
  const [panelWidth, setPanelWidth] = useState(360);

  if (!activePanel) return null;

  return (
    <>
      {/* Mobile backdrop only */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm md:hidden z-30"
        onClick={close}
      />

      <div className={`border-r shadow-lg flex flex-col shrink-0 z-30 relative ${t.bgPanel} ${t.border}`} style={{ width: panelWidth }}>
        {/* 右侧拖拽条 */}
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-40 group -mr-1"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startW = panelWidth;
            const onMove = (ev) => {
              const diff = ev.clientX - startX;
              setPanelWidth(Math.max(260, Math.min(600, startW + diff)));
            };
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        >
          <div className={`w-0.5 h-full mx-auto transition-colors group-hover:bg-indigo-500 ${t.border}`}></div>
        </div>

        <div className={`p-6 flex items-center justify-between border-b ${t.border}`}>
          <h3 className={`font-bold text-lg capitalize ${t.textMain}`}>{activePanel}</h3>
          <button onClick={close} className={`p-2 rounded-xl transition-colors ${t.textMuted} ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          {activePanel === 'calendar' && <CalendarPanel t={t} tasks={tasks} onSelectTask={onSelectTask} onCreateTask={onCreateTask} activeTaskId={activeTaskId} onDeleteTask={onDeleteTask} onToggleTask={onToggleTask} />}
          {activePanel === 'stats' && <StatsPanel t={t} theme={theme} stats={stats} />}
          {activePanel === 'monitor' && <MonitorPanel t={t} theme={theme} events={events} onSimulate={onSimulateDistraction} onAddFocus={onAddFocusEvent} onDeleteEvent={onDeleteEvent} onClearEvents={onClearEvents} enabled={settings.monitorEnabled} onToggle={(v) => setSettings({...settings, monitorEnabled: v})} />}
          {activePanel === 'settings' && <SettingsPanel t={t} settings={settings} setSettings={setSettings} showToast={showToast} />}
        </div>
      </div>
    </>
  );
}

// Quick Notes content (used both in the right sidebar and the mobile drawer)
function QuickNotesPanel({ t, theme, notes, setNotes, showHeader = true, onClose }) {
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
function CalendarPanel({ t, tasks, onSelectTask, onCreateTask, activeTaskId, onDeleteTask, onToggleTask }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [selectedDay, setSelectedDay] = useState(null); // 点击日历选中的日期
  
  // 动态月份：可以前后翻页
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const prevMonth = () => {
    setSelectedDay(null);
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    setSelectedDay(null);
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  // 计算这个月第一天是星期几 和 总天数
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const days = Array.from({length: daysInMonth}, (_, i) => i + 1);

  // 构建日期字符串
  const makeDateStr = (day) => `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // 某天有哪些 task
  const getTaskForDay = (day) => tasks.filter(tk => tk.date === makeDateStr(day));

  // 判断是不是今天
  const todayStr = makeDateStr(today.getDate());
  const isToday = (day) => viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();

  // 点击某天：第一次选中，再点同一天弹出 Add Task（due date = 那天）
  const handleDayClick = (day) => {
    if (selectedDay === day) {
      setNewDate(makeDateStr(day));
      setShowAdd(true);
    } else {
      setSelectedDay(day);
      setShowAdd(false);
    }
  };

  // 当前显示的 task 列表（选中了某天就只显示那天的，否则显示整月）
  const displayTasks = selectedDay
    ? tasks.filter(tk => tk.date === makeDateStr(selectedDay))
    : tasks.filter(tk => {
        if (!tk.date) return false;
        const [y, m] = tk.date.split('-').map(Number);
        return y === viewYear && m === viewMonth + 1;
      });
  const sortedTasks = [...displayTasks].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // 导入 .ics 文件（Google Calendar / Apple Calendar 导出格式）
  const handleImportICS = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== 'string') return;
      // 简单解析 .ics VEVENT
      const events = text.split('BEGIN:VEVENT');
      let imported = 0;
      events.forEach(block => {
        const summaryMatch = block.match(/SUMMARY[^:]*:(.*)/);
        const dtMatch = block.match(/DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/);
        if (summaryMatch && dtMatch) {
          const title = summaryMatch[1].trim();
          const date = `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`;
          onCreateTask(title, date);
          imported++;
        }
      });
      if (imported > 0) {
        alert(`Imported ${imported} event${imported > 1 ? 's' : ''} successfully!`);
      } else {
        alert('No events found in this file. Make sure it\'s a valid .ics file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset input
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 月份导航 */}
      <div className="flex items-center justify-between">
        <h4 className={`font-bold text-lg ${t.textMain}`}>{monthNames[viewMonth]} {viewYear}</h4>
        <div className="flex gap-2">
          <button onClick={prevMonth} className={`p-1.5 rounded-lg border ${t.border} ${t.textMuted} hover:text-indigo-400 hover:border-indigo-500/50`}><ChevronLeft className="w-4 h-4"/></button>
          <button onClick={nextMonth} className={`p-1.5 rounded-lg border ${t.border} ${t.textMuted} hover:text-indigo-400 hover:border-indigo-500/50`}><ChevronRight className="w-4 h-4"/></button>
        </div>
      </div>

      {/* 日历网格 */}
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className={`text-xs font-bold pb-1 ${t.textMuted}`}>{d}</div>)}
        {Array.from({length: firstDayOfWeek}).map((_, i) => <div key={`pad-${i}`} className="aspect-square"></div>)}
        {days.map(d => {
           const dayTasks = getTaskForDay(d);
           const hasPending = dayTasks.some(tk => tk.status === 'pending');
           const hasDone = dayTasks.some(tk => tk.status === 'done');
           const isSelected = selectedDay === d;
           const isTodayDate = isToday(d);
           let dayClass = `${t.bgCard} ${t.border} ${t.textMain}`;
           if (isSelected) dayClass = 'bg-indigo-500 border-indigo-500 text-white font-bold';
           else if (isTodayDate) dayClass = 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-bold';
           return (
             <div key={d} onClick={() => handleDayClick(d)} className={`aspect-square flex flex-col items-center justify-center rounded-lg border text-sm relative transition-all cursor-pointer hover:border-indigo-500/50 ${dayClass}`}>
                {d}
                <div className="flex gap-0.5 mt-0.5 absolute bottom-0.5">
                  {hasDone && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : 'bg-emerald-500'}`}></span>}
                  {hasPending && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : 'bg-rose-500'}`}></span>}
                </div>
             </div>
           )
        })}
      </div>

      {/* 操作按钮行 */}
      <div className="flex gap-2">
        <button onClick={() => { setShowAdd(!showAdd); if (!showAdd) { setNewDate(selectedDay ? makeDateStr(selectedDay) : makeDateStr(today.getDate())); } }} className={`flex-1 py-2.5 rounded-xl font-bold border border-dashed flex items-center justify-center gap-2 transition-colors text-sm ${t.border} ${t.textMuted} hover:border-indigo-500/50 hover:text-indigo-400`}>
          <Plus className="w-4 h-4" /> Add Task
        </button>
        <label className={`py-2.5 px-3 rounded-xl font-bold border border-dashed flex items-center justify-center gap-2 transition-colors text-sm cursor-pointer ${t.border} ${t.textMuted} hover:border-indigo-500/50 hover:text-indigo-400`}>
          <CalendarIcon className="w-4 h-4" /> Import .ics
          <input type="file" accept=".ics" onChange={handleImportICS} className="hidden" />
        </label>
      </div>

      {showAdd && (
        <div className={`p-4 rounded-xl border ${t.bgCard} ${t.border} animate-slide-up space-y-3`}>
          <input type="text" placeholder="Task title..." value={newTitle} onChange={e=>setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTitle) { onCreateTask(newTitle, newDate || undefined); setNewTitle(''); setNewDate(''); setShowAdd(false); }}} className={`w-full bg-transparent border-b pb-2 focus:outline-none focus:border-indigo-500 text-sm ${t.border} ${t.textMain}`} />
          <div className="flex items-center gap-2">
            <label className={`text-xs ${t.textMuted}`}>Due date:</label>
            <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} className={`flex-1 bg-transparent border-b pb-1 focus:outline-none focus:border-indigo-500 text-sm ${t.border} ${t.textMain}`} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${t.secondaryBtn}`}>Cancel</button>
            <button onClick={() => { if(newTitle) { onCreateTask(newTitle, newDate || undefined); setNewTitle(''); setNewDate(''); setShowAdd(false); } }} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${t.primaryBtn}`}>Save</button>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      <div className="space-y-2">
        <h4 className={`font-bold text-xs uppercase tracking-wider mb-2 ${t.textMuted}`}>
          {selectedDay 
            ? `Tasks on ${monthNames[viewMonth]} ${selectedDay}` 
            : (sortedTasks.length > 0 ? `Tasks in ${monthNames[viewMonth]}` : `No tasks in ${monthNames[viewMonth]}`)}
        </h4>
        {sortedTasks.length === 0 && selectedDay && (
          <p className={`text-sm ${t.textMuted}`}>No tasks on this day. Click "+ Add Task" to create one.</p>
        )}
        {sortedTasks.map(tk => (
          <div key={tk.id} className={`p-3 rounded-xl border flex gap-3 cursor-pointer transition-all ${activeTaskId === tk.id ? 'border-indigo-500 bg-indigo-500/5' : `${t.bgCard} ${t.border} hover:border-indigo-500/30`}`}>
            <button 
              onClick={(e) => { e.stopPropagation(); if(onToggleTask) onToggleTask(tk.id); }}
              className={`w-4 h-4 mt-1 rounded-full shrink-0 border-2 flex items-center justify-center transition-colors ${tk.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-rose-400 hover:border-emerald-400'}`}
            >
              {tk.status === 'done' && <CheckCircle className="w-3 h-3 text-white" />}
            </button>
            <div className="flex-1 min-w-0" onClick={() => onSelectTask(tk.id)}>
              <h4 className={`font-bold text-sm ${tk.status === 'done' ? 'line-through opacity-50' : ''} ${activeTaskId === tk.id ? 'text-indigo-400' : t.textMain}`}>{tk.title}</h4>
              <div className="flex items-center gap-2 mt-1">
                <p className={`text-[10px] ${t.textMuted}`}>{tk.date}</p>
                {tk.date && tk.date !== todayStr && (() => {
                  const diff = Math.ceil((new Date(tk.date) - today.setHours(0,0,0,0)) / 86400000);
                  if (diff < 0) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-bold">Overdue</span>;
                  if (diff === 0) return null;
                  if (diff <= 3) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold">Due in {diff}d</span>;
                  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold">Due in {diff}d</span>;
                })()}
              </div>
            </div>
            {onDeleteTask && (
              <button onClick={(e) => { e.stopPropagation(); onDeleteTask(tk.id); }} className={`p-1 rounded-lg transition-colors ${t.textMuted} hover:text-rose-400`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 4.2 Stats Panel
function StatsPanel({ t, theme, stats }) {
  const [tab, setTab] = useState('overview'); // 'overview' | 'ranking'
  const [rankTab, setRankTab] = useState('friends'); // 'friends' | 'location'
  const [shareWithFriends, setShareWithFriends] = useState(true);
  const [shareAnonymously, setShareAnonymously] = useState(true);

  const level = useMemo(() => getLevelForMinutes(stats.focusScore), [stats.focusScore]);
  const rewardBounds = useMemo(() => getRewardBounds(stats.focusScore), [stats.focusScore]);
  const progressToNextReward = useMemo(() => clamp01((stats.focusScore - rewardBounds.prev) / (rewardBounds.next - rewardBounds.prev)), [stats.focusScore, rewardBounds]);

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
                  <p className={`text-xs mt-1 ${t.textMuted}`}>All scoring is measured in focus minutes</p>
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
            <StatBox t={t} title="Sessions" value={stats.sessions} />
            <StatBox t={t} title="Avg session" value={`${stats.avgSession}m`} />
            <StatBox t={t} title="Streak" value={`${stats.streak} days`} />
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
function MonitorPanel({ t, theme, events, onSimulate, onAddFocus, onDeleteEvent, onClearEvents, enabled, onToggle }) {
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
function SettingsPanel({ t, settings, setSettings, showToast }) {
  const handleChange = (k, v) => setSettings({...settings, [k]: v});

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Theme */}
      <div>
        <h4 className={`font-bold text-xs uppercase tracking-wider mb-3 ${t.textMuted}`}>Appearance</h4>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => handleChange('theme', 'dark')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.theme === 'dark' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : `${t.bgCard} ${t.border} ${t.textMuted}`}`}>
            <Moon className="w-5 h-5" />
            <span className="text-xs font-bold">Night</span>
          </button>
          <button onClick={() => handleChange('theme', 'light')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.theme === 'light' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : `${t.bgCard} ${t.border} ${t.textMuted}`}`}>
            <Sun className="w-5 h-5" />
            <span className="text-xs font-bold">Day</span>
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div>
        <h4 className={`font-bold text-xs uppercase tracking-wider mb-3 mt-8 ${t.textMuted}`}>Preferences</h4>
        <div className="space-y-3">
          <div className={`p-4 rounded-xl border flex items-center justify-between ${t.bgCard} ${t.border}`}>
             <div className="flex items-center gap-3">
               <Bell className={`w-4 h-4 ${t.textMuted}`} />
               <span className={`text-sm font-bold ${t.textMain}`}>Notifications</span>
             </div>
             <button onClick={() => handleChange('notifications', !settings.notifications)} className={`relative w-10 h-5 rounded-full transition-colors ${settings.notifications ? 'bg-indigo-500' : (settings.theme === 'dark' ? 'bg-gray-600' : 'bg-slate-300')}`}>
               <span className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${settings.notifications ? 'translate-x-5' : 'translate-x-0'}`} />
             </button>
          </div>
          
          <div className={`p-4 rounded-xl border flex items-center justify-between ${t.bgCard} ${t.border}`}>
             <span className={`text-sm font-bold ${t.textMain}`}>Distract Threshold (mins)</span>
             <input type="number" value={settings.distractThreshold} onChange={(e) => handleChange('distractThreshold', e.target.value)} className={`w-16 bg-transparent border-b text-center focus:outline-none focus:border-indigo-500 ${t.border} ${t.textMain}`} />
          </div>
        </div>
      </div>

      {/* Calendar Integration */}
      <div>
        <h4 className={`font-bold text-xs uppercase tracking-wider mb-3 mt-8 ${t.textMuted}`}>Calendar Integration</h4>
        <div className="space-y-3">
          <button onClick={() => showToast('Google Calendar integration coming soon! Use .ics import for now.', 'info')} className={`w-full p-4 rounded-xl border flex items-center gap-3 transition-all ${t.bgCard} ${t.border} hover:border-indigo-500/30`}>
            <CalendarIcon className={`w-5 h-5 ${t.textMuted}`} />
            <div className="text-left flex-1">
              <span className={`text-sm font-bold ${t.textMain}`}>Connect Google Calendar</span>
              <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>Sync events automatically via OAuth</p>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded-full font-bold border ${settings.theme === 'dark' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>Soon</span>
          </button>
          <button onClick={() => showToast('Apple Calendar integration coming soon! Use .ics import for now.', 'info')} className={`w-full p-4 rounded-xl border flex items-center gap-3 transition-all ${t.bgCard} ${t.border} hover:border-indigo-500/30`}>
            <CalendarIcon className={`w-5 h-5 ${t.textMuted}`} />
            <div className="text-left flex-1">
              <span className={`text-sm font-bold ${t.textMain}`}>Connect Apple Calendar</span>
              <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>Sync via iCloud CalDAV</p>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded-full font-bold border ${settings.theme === 'dark' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>Soon</span>
          </button>
        </div>
      </div>

      {/* Data & API */}
      <div>
        <h4 className={`font-bold text-xs uppercase tracking-wider mb-3 mt-8 ${t.textMuted}`}>Developer & Data</h4>
        <div className="space-y-4">
           <div>
             <label className={`block text-xs mb-2 flex items-center gap-2 ${t.textMuted}`}><Database className="w-3 h-3"/> Local Storage Path</label>
             <input type="text" value={settings.storagePath} onChange={(e) => handleChange('storagePath', e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:border-indigo-500 ${t.bgInput} ${t.border} ${t.textMain}`} />
           </div>
           <div>
             <label className={`block text-xs mb-2 flex items-center gap-2 ${t.textMuted}`}><Key className="w-3 h-3"/> AI API Key</label>
             <input type="password" value={settings.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:border-indigo-500 ${t.bgInput} ${t.border} ${t.textMain}`} />
           </div>
        </div>
      </div>

      {/* About */}
      <div className={`pt-6 mt-6 border-t ${t.border} text-center`}>
        <p className={`text-xs font-bold ${t.textMain}`}>Flow Crusade v2.0.1</p>
        <div className={`flex justify-center gap-4 mt-2 text-xs ${t.textMuted}`}>
          <a href="#" className="hover:text-indigo-400">Changelog</a>
          <a href="#" className="hover:text-indigo-400">Contact Us</a>
        </div>
      </div>

    </div>
  );
}

// ==========================================
// CSS INJECTIONS (Animations & Scrollbar)
// ==========================================
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-right { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fade-in-up { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
  @keyframes slide { 0% { background-position: 0 0; } 100% { background-position: 20px 20px; } }
  
  .animate-slide-right { animation: slide-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
  .animate-fade-in { animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  
  .writing-vertical-rl { writing-mode: vertical-rl; text-orientation: mixed; }
  
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.3); border-radius: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.5); }
`;
document.head.appendChild(style);