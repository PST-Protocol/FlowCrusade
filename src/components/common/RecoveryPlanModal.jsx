import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Clock3, RotateCcw, Sparkles, X } from 'lucide-react';

const REASONS = [
  { value: 'task_overrun', label: '当前步骤超时' },
  { value: 'interruption', label: '临时被打断' },
  { value: 'skipped_task', label: '跳过了关键步骤' },
  { value: 'changed_scope', label: '目标或范围变化' },
];

function operationLabel(operation) {
  if (operation === 'defer') return '延后';
  if (operation === 'insert') return '新增';
  return '调整';
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
      setError(generationError.message || '暂时无法生成恢复方案。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} aria-label="关闭恢复方案" />
      <section className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl ${t.bgPanel} ${t.border}`}>
        <header className={`sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-5 border-b ${t.bgPanel} ${t.border}`}>
          <div>
            <div className="flex items-center gap-2 text-indigo-500 text-xs font-bold tracking-widest uppercase mb-2">
              <Sparkles className="w-4 h-4" /> Adaptive Recovery
            </div>
            <h2 className={`text-2xl font-black ${t.textMain}`}>{proposal ? '恢复方案' : '计划被打乱了？'}</h2>
            <p className={`text-sm mt-1 ${t.textMuted}`}>保留已完成内容，只调整受影响的部分。</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl ${t.secondaryBtn}`}><X className="w-5 h-5" /></button>
        </header>

        {!proposal ? (
          <div className="p-6 space-y-6">
            <div>
              <label className={`text-sm font-bold ${t.textMain}`}>发生了什么？</label>
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
                <span className={`flex items-center gap-2 text-sm font-bold ${t.textMain}`}><Clock3 className="w-4 h-4 text-amber-500" /> 比计划晚了多久</span>
                <div className="flex gap-2 mt-3">
                  {[15, 30, 60].map((minutes) => <button type="button" key={minutes} onClick={() => setDelayMinutes(minutes)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${delayMinutes === minutes ? 'bg-amber-500 text-white' : t.secondaryBtn}`}>{minutes} 分钟</button>)}
                </div>
                <input type="number" min="0" max="480" value={delayMinutes} onChange={(event) => setDelayMinutes(event.target.value)} className={`mt-3 w-full rounded-xl border px-3 py-2 outline-none ${t.bgInput} ${t.border} ${t.textMain}`} />
              </label>
              <label className={`block rounded-2xl border p-4 ${t.bgCard} ${t.border}`}>
                <span className={`text-sm font-bold ${t.textMain}`}>现在还剩多少可用时间</span>
                <input type="number" min="5" max="1440" value={availableMinutes} onChange={(event) => setAvailableMinutes(event.target.value)} className={`mt-3 w-full rounded-xl border px-3 py-2 outline-none ${t.bgInput} ${t.border} ${t.textMain}`} />
                <span className={`block text-xs mt-2 ${t.textMuted}`}>用于判断当前计划是否仍然可行。</span>
              </label>
            </div>

            <label className="block">
              <span className={`text-sm font-bold ${t.textMain}`}>截止日期（可选）</span>
              <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none ${t.bgInput} ${t.border} ${t.textMain}`} />
            </label>

            {pendingTasks.length > 0 && (
              <div>
                <span className={`text-sm font-bold ${t.textMain}`}>必须保留的步骤（可选）</span>
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
              {canUndo ? <button onClick={onUndo} className={`px-4 py-3 rounded-xl font-bold flex items-center gap-2 ${t.secondaryBtn}`}><RotateCcw className="w-4 h-4" /> 撤销上次恢复</button> : <span />}
              <button disabled={loading} onClick={generate} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold flex items-center gap-2">
                {loading ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? '正在修复计划…' : '生成恢复方案'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className={`rounded-2xl border p-5 ${proposal.feasible ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
              <div className={`text-sm font-black ${proposal.feasible ? 'text-emerald-500' : 'text-amber-500'}`}>{proposal.feasible ? '可以恢复' : '当前约束下仍不可行'}</div>
              <p className={`mt-2 leading-relaxed ${t.textMain}`}>{proposal.summary}</p>
              <div className={`mt-3 text-xs ${t.textMuted}`}>剩余计划约 {proposal.remainingMinutes} 分钟 · 可用 {proposal.availableMinutes} 分钟 · {proposal.provider === 'local-rules' ? '本地规则方案' : 'AI 方案'}</div>
            </div>

            <div className="space-y-3">
              {proposal.changes.map((change, index) => (
                <div key={`${change.targetId}-${index}`} className={`rounded-2xl border p-4 flex items-start gap-4 ${t.bgCard} ${t.border}`}>
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 text-xs font-black">{operationLabel(change.operation)}</span>
                  <div className="min-w-0">
                    <div className={`font-bold ${t.textMain}`}>{pendingTasks.find((task) => task.id === change.targetId)?.title || rootTask.title}</div>
                    <p className={`text-sm mt-1 ${t.textMuted}`}>{change.reason}</p>
                    {change.patch?.estimatedMinutes && <div className="text-xs text-indigo-500 font-bold mt-2">调整为 {change.patch.estimatedMinutes} 分钟</div>}
                  </div>
                </div>
              ))}
              {!proposal.changes.length && <div className={`rounded-2xl border p-5 text-sm ${t.bgCard} ${t.border} ${t.textMuted}`}>现有计划无需调整，可以直接回到下一步。</div>}
            </div>

            <div className={`rounded-2xl border p-4 ${t.bgCard} ${t.border}`}>
              <div className={`text-xs font-bold uppercase tracking-wider ${t.textMuted}`}>新的下一步</div>
              <div className={`mt-2 flex items-center gap-3 font-black ${t.textMain}`}><Check className="w-5 h-5 text-emerald-500" />{pendingTasks.find((task) => task.id === proposal.nextStepId)?.title || '继续当前步骤'}</div>
            </div>

            {error && <div className="text-sm text-rose-500">{error}</div>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setProposal(null)} className={`px-5 py-3 rounded-xl font-bold ${t.secondaryBtn}`}>重新设置</button>
              <button disabled={!proposal.feasible} onClick={() => onApply(proposal, { reason, delayMinutes, availableMinutes, deadline, mustKeepTaskIds })} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold flex items-center gap-2">接受并回到下一步 <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
