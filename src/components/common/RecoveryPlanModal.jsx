import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Clock3, RotateCcw, Sparkles, X } from 'lucide-react';

const REASONS = [
  { value: 'task_overrun', label: 'A step took longer' },
  { value: 'interruption', label: 'I was interrupted' },
  { value: 'skipped_task', label: 'I skipped a key step' },
  { value: 'changed_scope', label: 'The goal or scope changed' },
];

function operationLabel(operation) {
  if (operation === 'defer') return 'Defer';
  if (operation === 'insert') return 'Add';
  return 'Adjust';
}

export default function RecoveryPlanModal({ open, rootTask, activeTaskId, t, onClose, onGenerate, onApply, onUndo, canUndo }) {
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [availableMinutes, setAvailableMinutes] = useState(60);
  const [reason, setReason] = useState('task_overrun');
  const [deadline, setDeadline] = useState(rootTask?.date || '');
  const [mustKeepTaskIds, setMustKeepTaskIds] = useState([]);
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pendingTasks = useMemo(() => {
    const result = [];
    const visit = (node) => {
      if (node.id !== rootTask?.id && node.status !== 'done' && !node.deferredUntil) result.push(node);
      (node.children || []).forEach(visit);
    };
    if (rootTask) visit(rootTask);
    return result;
  }, [rootTask]);

  if (!open || !rootTask) return null;

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await onGenerate({
        activeTaskId,
        delayMinutes: Number(delayMinutes),
        availableMinutes: Number(availableMinutes),
        reason,
        deadline: deadline || null,
        mustKeepTaskIds,
      });
      setProposal(next);
    } catch (generationError) {
      setError(generationError.message || 'A recovery plan could not be generated right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} aria-label="Close recovery plan" />
      <section className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl ${t.bgPanel} ${t.border}`}>
        <header className={`sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-5 border-b ${t.bgPanel} ${t.border}`}>
          <div>
            <div className="flex items-center gap-2 text-indigo-500 text-xs font-bold tracking-widest uppercase mb-2">
              <Sparkles className="w-4 h-4" /> Adaptive Recovery
            </div>
            <h2 className={`text-2xl font-black ${t.textMain}`}>{proposal ? 'Recovery plan' : 'Did your plan change?'}</h2>
            <p className={`text-sm mt-1 ${t.textMuted}`}>Keep completed work and repair only what was affected.</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl ${t.secondaryBtn}`}><X className="w-5 h-5" /></button>
        </header>

        {!proposal ? (
          <div className="p-6 space-y-6">
            <div>
              <label className={`text-sm font-bold ${t.textMain}`}>What happened?</label>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {REASONS.map((item) => (
                  <button key={item.value} onClick={() => setReason(item.value)} className={`px-4 py-3 text-left rounded-xl border text-sm font-semibold transition-colors ${reason === item.value ? 'bg-indigo-500 text-white border-indigo-500' : `${t.bgCard} ${t.border} ${t.textMain}`}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className={`block rounded-2xl border p-4 ${t.bgCard} ${t.border}`}>
                <span className={`flex items-center gap-2 text-sm font-bold ${t.textMain}`}><Clock3 className="w-4 h-4 text-amber-500" /> How far behind are you?</span>
                <div className="flex gap-2 mt-3">
                  {[15, 30, 60].map((minutes) => <button type="button" key={minutes} onClick={() => setDelayMinutes(minutes)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${delayMinutes === minutes ? 'bg-amber-500 text-white' : t.secondaryBtn}`}>{minutes} min</button>)}
                </div>
                <input type="number" min="0" max="480" value={delayMinutes} onChange={(event) => setDelayMinutes(event.target.value)} className={`mt-3 w-full rounded-xl border px-3 py-2 outline-none ${t.bgInput} ${t.border} ${t.textMain}`} />
              </label>
              <label className={`block rounded-2xl border p-4 ${t.bgCard} ${t.border}`}>
                <span className={`text-sm font-bold ${t.textMain}`}>How much time is left?</span>
                <input type="number" min="5" max="1440" value={availableMinutes} onChange={(event) => setAvailableMinutes(event.target.value)} className={`mt-3 w-full rounded-xl border px-3 py-2 outline-none ${t.bgInput} ${t.border} ${t.textMain}`} />
                <span className={`block text-xs mt-2 ${t.textMuted}`}>Used to check whether the remaining plan still fits.</span>
              </label>
            </div>

            <label className="block">
              <span className={`text-sm font-bold ${t.textMain}`}>Deadline (optional)</span>
              <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none ${t.bgInput} ${t.border} ${t.textMain}`} />
            </label>

            {pendingTasks.length > 0 && (
              <div>
                <span className={`text-sm font-bold ${t.textMain}`}>Steps that must stay (optional)</span>
                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                  {pendingTasks.map((task) => (
                    <label key={task.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer ${t.bgCard} ${t.border}`}>
                      <input type="checkbox" checked={mustKeepTaskIds.includes(task.id)} onChange={(event) => setMustKeepTaskIds((current) => event.target.checked ? [...current, task.id] : current.filter((id) => id !== task.id))} />
                      <span className={`text-sm font-semibold flex-1 ${t.textMain}`}>{task.title}</span>
                      <span className={`text-xs ${t.textMuted}`}>{task.estimatedMinutes || 10} min</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="flex gap-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 text-sm"><AlertTriangle className="w-5 h-5 shrink-0" />{error}</div>}

            <div className="flex items-center justify-between gap-3 pt-2">
              {canUndo ? <button onClick={onUndo} className={`px-4 py-3 rounded-xl font-bold flex items-center gap-2 ${t.secondaryBtn}`}><RotateCcw className="w-4 h-4" /> Undo last recovery</button> : <span />}
              <button disabled={loading} onClick={generate} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold flex items-center gap-2">
                {loading ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? 'Repairing your plan…' : 'Generate recovery plan'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className={`rounded-2xl border p-5 ${proposal.feasible ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
              <div className={`text-sm font-black ${proposal.feasible ? 'text-emerald-500' : 'text-amber-500'}`}>{proposal.feasible ? 'Recovery is possible' : 'The plan still does not fit'}</div>
              <p className={`mt-2 leading-relaxed ${t.textMain}`}>{proposal.summary}</p>
              <div className={`mt-3 text-xs ${t.textMuted}`}>About {proposal.remainingMinutes} min remaining · {proposal.availableMinutes} min available · {proposal.provider === 'local-rules' ? 'Local recovery rules' : 'AI recovery'}</div>
            </div>

            <div className="space-y-3">
              {proposal.changes.map((change, index) => (
                <div key={`${change.targetId}-${index}`} className={`rounded-2xl border p-4 flex items-start gap-4 ${t.bgCard} ${t.border}`}>
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 text-xs font-black">{operationLabel(change.operation)}</span>
                  <div className="min-w-0">
                    <div className={`font-bold ${t.textMain}`}>{pendingTasks.find((task) => task.id === change.targetId)?.title || rootTask.title}</div>
                    <p className={`text-sm mt-1 ${t.textMuted}`}>{change.reason}</p>
                    {change.patch?.estimatedMinutes && <div className="text-xs text-indigo-500 font-bold mt-2">Adjusted to {change.patch.estimatedMinutes} min</div>}
                  </div>
                </div>
              ))}
              {!proposal.changes.length && <div className={`rounded-2xl border p-5 text-sm ${t.bgCard} ${t.border} ${t.textMuted}`}>No changes are needed. You can return to the next step.</div>}
            </div>

            <div className={`rounded-2xl border p-4 ${t.bgCard} ${t.border}`}>
              <div className={`text-xs font-bold uppercase tracking-wider ${t.textMuted}`}>Your new next step</div>
              <div className={`mt-2 flex items-center gap-3 font-black ${t.textMain}`}><Check className="w-5 h-5 text-emerald-500" />{pendingTasks.find((task) => task.id === proposal.nextStepId)?.title || 'Continue the current step'}</div>
            </div>

            {error && <div className="text-sm text-rose-500">{error}</div>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setProposal(null)} className={`px-5 py-3 rounded-xl font-bold ${t.secondaryBtn}`}>Change inputs</button>
              <button disabled={!proposal.feasible} onClick={() => onApply(proposal, { reason, delayMinutes, availableMinutes, deadline, mustKeepTaskIds })} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold flex items-center gap-2">Accept and start next step <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
