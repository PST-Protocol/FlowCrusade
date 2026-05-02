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


export default function CollapsibleText({ t, text, defaultExpanded = false }) {
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


