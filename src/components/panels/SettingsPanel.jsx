import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, Moon, Sun, Bell, RotateCcw, Save
} from 'lucide-react';

import {
  getClassificationConfig,
  updateClassificationConfig,
  resetClassificationConfig,
} from '../../services/monitorApi';

const CLASSIFICATION_FIELDS = [
  ['focusApps', 'Focus Apps'],
  ['focusDomains', 'Focus Domains'],
  ['distractionApps', 'Distraction Apps'],
  ['distractionDomains', 'Distraction Domains'],
];

function listToText(list = []) {
  return list.join('\n');
}

function textToList(text = '') {
  return Array.from(
    new Set(
      text
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export default function SettingsPanel({ t, settings, setSettings, showToast }) {
  const handleChange = (k, v) => setSettings({...settings, [k]: v});
  const [classification, setClassification] = useState(null);
  const [savingClassification, setSavingClassification] = useState(false);

  useEffect(() => {
    getClassificationConfig()
      .then((config) => {
        setClassification({
          focusApps: listToText(config.focusApps),
          focusDomains: listToText(config.focusDomains),
          distractionApps: listToText(config.distractionApps),
          distractionDomains: listToText(config.distractionDomains),
        });
      })
      .catch(() => {});
  }, []);

  const handleClassificationChange = (key, value) => {
    setClassification((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const saveClassification = async () => {
    if (!classification) return;
    setSavingClassification(true);
    try {
      const saved = await updateClassificationConfig({
        focusApps: textToList(classification.focusApps),
        focusDomains: textToList(classification.focusDomains),
        distractionApps: textToList(classification.distractionApps),
        distractionDomains: textToList(classification.distractionDomains),
      });
      setClassification({
        focusApps: listToText(saved.focusApps),
        focusDomains: listToText(saved.focusDomains),
        distractionApps: listToText(saved.distractionApps),
        distractionDomains: listToText(saved.distractionDomains),
      });
      showToast?.('Monitor classification rules saved');
    } catch (error) {
      showToast?.(`Save failed: ${error.message}`, 'error');
    } finally {
      setSavingClassification(false);
    }
  };

  const resetClassification = async () => {
    setSavingClassification(true);
    try {
      const defaults = await resetClassificationConfig();
      setClassification({
        focusApps: listToText(defaults.focusApps),
        focusDomains: listToText(defaults.focusDomains),
        distractionApps: listToText(defaults.distractionApps),
        distractionDomains: listToText(defaults.distractionDomains),
      });
      showToast?.('Monitor classification rules reset');
    } catch (error) {
      showToast?.(`Reset failed: ${error.message}`, 'error');
    } finally {
      setSavingClassification(false);
    }
  };

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

      {/* Monitor Classification */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3 mt-8">
          <h4 className={`font-bold text-xs uppercase tracking-wider ${t.textMuted}`}>Monitor Classification</h4>
          <div className="flex items-center gap-2">
            <button
              disabled={savingClassification || !classification}
              onClick={resetClassification}
              className={`p-2 rounded-lg border transition-colors disabled:opacity-50 ${t.border} ${t.textMuted} hover:text-amber-400`}
              title="Reset defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={savingClassification || !classification}
              onClick={saveClassification}
              className="p-2 rounded-lg border border-indigo-500/40 text-indigo-400 bg-indigo-500/10 transition-colors disabled:opacity-50 hover:bg-indigo-500/20"
              title="Save rules"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {CLASSIFICATION_FIELDS.map(([key, label]) => (
            <label key={key} className={`block p-4 rounded-xl border ${t.bgCard} ${t.border}`}>
              <span className={`block text-xs font-bold mb-2 ${t.textMain}`}>{label}</span>
              <textarea
                rows={4}
                value={classification?.[key] || ''}
                onChange={(e) => handleClassificationChange(key, e.target.value)}
                className={`w-full resize-y rounded-lg border px-3 py-2 text-xs leading-relaxed outline-none transition-colors ${t.border} ${t.textMain} ${settings.theme === 'dark' ? 'bg-black/20 focus:border-indigo-500' : 'bg-white focus:border-indigo-400'}`}
              />
            </label>
          ))}
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
          Developer/data controls were removed from the UI. To change database or local Gemma settings, edit the local <code className="px-1 py-0.5 rounded bg-black/10">config.json</code> file instead of storing those settings in the app screen.
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
