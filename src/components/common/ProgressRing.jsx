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

import { clamp01 } from '../../data/rewards';

export default function ProgressRing({ percent, theme, size = 48, stroke = 5 }) {
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

