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


export default function CalendarPanel({ t, tasks, onSelectTask, onCreateTask, activeTaskId, onDeleteTask, onToggleTask }) {
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
