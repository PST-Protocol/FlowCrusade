import crypto from 'node:crypto';

const MAX_CHANGES = 5;
const ALLOWED_OPERATIONS = new Set(['update', 'defer', 'insert']);

function safeMinutes(value, fallback = 10) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

export function normalizeReplanRequest(body = {}) {
  const rootTask = body.rootTask;
  if (!rootTask?.id || !Array.isArray(rootTask.nodes)) throw new Error('A root task snapshot is required.');
  const knownIds = new Set(rootTask.nodes.map((node) => node.id));
  if (!knownIds.has(body.activeTaskId)) throw new Error('The active task is not part of this plan.');
  const availableMinutes = safeMinutes(body.availableMinutes, 60);
  if (availableMinutes > 24 * 60) throw new Error('Available time is outside the supported range.');

  return {
    rootTask: {
      id: String(rootTask.id),
      title: String(rootTask.title || 'Untitled goal').slice(0, 120),
      desc: String(rootTask.desc || '').slice(0, 1000),
      planVersion: safeMinutes(rootTask.planVersion, 1),
      nodes: rootTask.nodes.slice(0, 100).map((node) => ({
        id: String(node.id),
        parentId: node.parentId == null ? null : String(node.parentId),
        title: String(node.title || 'Untitled task').slice(0, 120),
        desc: String(node.desc || '').slice(0, 500),
        status: node.status === 'done' ? 'done' : 'pending',
        estimatedMinutes: safeMinutes(node.estimatedMinutes),
        priority: safeMinutes(node.priority, 3),
        deferredUntil: node.deferredUntil || null,
      })),
    },
    activeTaskId: String(body.activeTaskId),
    currentTime: body.currentTime || new Date().toISOString(),
    deadline: body.deadline || null,
    delayMinutes: Math.max(0, safeMinutes(body.delayMinutes, 0)),
    availableMinutes,
    reason: String(body.reason || 'interruption').slice(0, 80),
    mustKeepTaskIds: Array.isArray(body.mustKeepTaskIds)
      ? body.mustKeepTaskIds.filter((id) => knownIds.has(id)).slice(0, 20)
      : [],
    preserveCompleted: true,
    planVersion: safeMinutes(body.planVersion, rootTask.planVersion || 1),
  };
}

function pendingNodes(request) {
  return request.rootTask.nodes.filter((node) =>
    node.id !== request.rootTask.id && node.status !== 'done' && !node.deferredUntil
  );
}

export function buildDeterministicReplan(request) {
  const pending = pendingNodes(request);
  const mustKeep = new Set(request.mustKeepTaskIds);
  const changes = [];
  let remaining = pending.reduce((sum, node) => sum + node.estimatedMinutes, 0);

  const flexible = [...pending]
    .filter((node) => !mustKeep.has(node.id))
    .sort((a, b) => b.estimatedMinutes - a.estimatedMinutes);

  for (const node of flexible) {
    if (remaining <= request.availableMinutes || changes.length >= MAX_CHANGES) break;
    const minimum = Math.min(node.estimatedMinutes, 10);
    if (node.estimatedMinutes > minimum) {
      changes.push({
        operation: 'update',
        targetId: node.id,
        patch: { estimatedMinutes: minimum },
        reason: 'Reduce this step to its smallest useful deliverable.',
      });
      remaining -= node.estimatedMinutes - minimum;
    }
  }

  const deferrable = [...pending]
    .filter((node) => !mustKeep.has(node.id))
    .sort((a, b) => b.priority - a.priority);
  for (const node of deferrable) {
    if (remaining <= request.availableMinutes || changes.length >= MAX_CHANGES) break;
    const compressionIndex = changes.findIndex((change) => change.targetId === node.id && change.operation === 'update');
    if (compressionIndex >= 0) {
      remaining -= Math.min(node.estimatedMinutes, 10);
      changes.splice(compressionIndex, 1);
    } else {
      remaining -= node.estimatedMinutes;
    }
    changes.push({
      operation: 'defer',
      targetId: node.id,
      patch: { deferredUntil: request.deadline ? request.deadline.slice(0, 10) : 'next-session' },
      reason: 'Defer this lower-priority step to protect the core deliverable.',
    });
  }

  const deferredIds = new Set(changes.filter((change) => change.operation === 'defer').map((change) => change.targetId));
  const next = pending.find((node) => !deferredIds.has(node.id));
  const feasible = remaining <= request.availableMinutes;

  return {
    proposalId: crypto.randomUUID(),
    basePlanVersion: request.planVersion,
    summary: feasible
      ? 'Completed work is preserved while affected steps are shortened or deferred so you can restart with one clear action.'
      : `The plan still needs ${remaining - request.availableMinutes} more minutes. Extend the deadline or reduce the required scope.`,
    assumptions: ['Completed tasks will not be changed.', 'User-selected must-keep tasks are protected first.'],
    changes,
    nextStepId: next?.id || request.activeTaskId,
    remainingMinutes: Math.max(0, remaining),
    availableMinutes: request.availableMinutes,
    feasible,
    provider: 'local-rules',
  };
}

export function buildReplanPrompt(request) {
  return `You are the adaptive replanning engine for FocusTrail. Repair the existing plan after a disruption.

Return compact VALID JSON only. Never use markdown.
Rules:
- Preserve completed nodes exactly.
- Never change existing IDs or the root node.
- Make the smallest useful adjustment, at most ${MAX_CHANGES} changes.
- Allowed operations: update, defer, insert.
- update/defer patches may only use title, desc, estimatedMinutes, priority, scheduledFor, deferredUntil.
- Do not delete tasks.
- Never invent more available time.
- mustKeepTaskIds cannot be deferred.
- If the plan cannot fit, set feasible=false and state the time deficit.
- nextStepId must be a pending, non-deferred node.

Output shape:
{"summary":"string","assumptions":["string"],"changes":[{"operation":"update|defer|insert","targetId":"existing id","patch":{},"node":{"id":"unique id","title":"string","desc":"string","estimatedMinutes":10,"priority":1},"reason":"string"}],"nextStepId":"id","remainingMinutes":60,"availableMinutes":60,"feasible":true}

Plan context:
${JSON.stringify(request)}`;
}

export function normalizeModelProposal(parsed, request) {
  if (!parsed || !Array.isArray(parsed.changes)) throw new Error('Model response does not contain changes.');
  const nodeMap = new Map(request.rootTask.nodes.map((node) => [node.id, node]));
  const mustKeep = new Set(request.mustKeepTaskIds);
  if (parsed.changes.length > MAX_CHANGES) throw new Error('Model returned too many changes.');

  const changes = parsed.changes.map((change, index) => {
    if (!ALLOWED_OPERATIONS.has(change.operation)) throw new Error(`Change ${index + 1} uses an unsupported operation.`);
    const target = nodeMap.get(change.targetId);
    if (!target || target.status === 'done' || target.id === request.rootTask.id && change.operation !== 'insert') {
      throw new Error(`Change ${index + 1} has an invalid target.`);
    }
    if (change.operation === 'defer' && mustKeep.has(change.targetId)) throw new Error('A must-keep task cannot be deferred.');
    const patch = { ...(change.patch || {}) };
    if ('estimatedMinutes' in patch) patch.estimatedMinutes = safeMinutes(patch.estimatedMinutes);
    if (change.operation === 'defer' && !patch.deferredUntil) throw new Error('Deferred tasks require deferredUntil.');
    return {
      operation: change.operation,
      targetId: change.targetId,
      ...(change.operation === 'insert' ? { node: change.node } : { patch }),
      reason: String(change.reason || 'Adjust this step to recover the plan.').slice(0, 240),
    };
  });

  const deferredIds = new Set(changes.filter((change) => change.operation === 'defer').map((change) => change.targetId));
  const next = nodeMap.get(parsed.nextStepId);
  if (!next || next.status === 'done' || next.deferredUntil || deferredIds.has(next.id)) throw new Error('Model returned an invalid next step.');

  let remainingMinutes = pendingNodes(request).reduce((sum, node) => sum + node.estimatedMinutes, 0);
  changes.forEach((change) => {
    const target = nodeMap.get(change.targetId);
    if (change.operation === 'update' && change.patch?.estimatedMinutes) {
      remainingMinutes += change.patch.estimatedMinutes - target.estimatedMinutes;
    } else if (change.operation === 'defer') {
      remainingMinutes -= target.estimatedMinutes;
    } else if (change.operation === 'insert') {
      remainingMinutes += safeMinutes(change.node?.estimatedMinutes);
    }
  });
  remainingMinutes = Math.max(0, remainingMinutes);
  const feasible = remainingMinutes <= request.availableMinutes;

  return {
    proposalId: crypto.randomUUID(),
    basePlanVersion: request.planVersion,
    summary: String(parsed.summary || 'The plan was repaired around the current constraints.').slice(0, 500),
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.slice(0, 5).map(String) : [],
    changes,
    nextStepId: parsed.nextStepId,
    remainingMinutes,
    availableMinutes: request.availableMinutes,
    feasible,
    provider: 'gemma',
  };
}
