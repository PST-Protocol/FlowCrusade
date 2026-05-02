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


export default function NavItem({ t, icon, label, active, isFocusedMode, onClick, showLabel = true }) {
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

