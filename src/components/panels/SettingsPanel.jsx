import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
Calendar as CalendarIcon, Moon, Sun, Bell
} from 'lucide-react';


export default function SettingsPanel({ t, settings, setSettings, showToast }) {
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

      {/* Local config note */}
      <div className={`p-4 rounded-xl border ${t.bgCard} ${t.border}`}>
        <h4 className={`font-bold text-xs uppercase tracking-wider mb-2 ${t.textMuted}`}>Local Config</h4>
        <p className={`text-xs leading-relaxed ${t.textMuted}`}>
          Developer/data controls were removed from the UI. To change database or LLM API settings, edit the local <code className="px-1 py-0.5 rounded bg-black/10">config.json</code> file instead of storing those settings in the app screen.
        </p>
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
