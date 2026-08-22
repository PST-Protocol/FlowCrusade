function compactTitle(value, fallback = 'New goal') {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean;
}

function step(id, title, desc, estimatedMinutes, priority) {
  return { id, title, desc, estimatedMinutes, priority, status: 'pending', children: [] };
}

export function createDemoBreakdown(payload = {}) {
  const mode = payload.mode || 'initial';
  if (mode === 'breakdown-node') {
    const title = compactTitle(payload.targetNode?.title, 'this step');
    return {
      steps: [
        step('demo-child-1', `Define the outcome for ${title}`, 'Write down the smallest clear result this step must produce.', 5, 1),
        step('demo-child-2', `Complete the core work`, `Work only on the essential action required for ${title}.`, 15, 2),
        step('demo-child-3', `Check and close the step`, 'Review the result, fix the largest gap, and mark it complete.', 5, 3),
      ],
      source: 'web-demo-rules',
      contextId: payload.contextId || crypto.randomUUID(),
      requestId: crypto.randomUUID(),
    };
  }

  if (mode === 'regenerate-node') {
    return {
      step: step(
        payload.targetNode?.id || 'demo-regenerated',
        `Refine: ${compactTitle(payload.targetNode?.title, 'next step')}`,
        'Narrow the scope to one visible result you can complete now.',
        Number(payload.targetNode?.estimatedMinutes) || 10,
        1,
      ),
      source: 'web-demo-rules',
      requestId: crypto.randomUUID(),
    };
  }

  const input = String(payload.taskInput || '').trim();
  const fileName = payload.file?.name || '';
  const goal = compactTitle(input || fileName.replace(/\.[^.]+$/, ''), 'Uploaded task');
  return {
    rootTitle: goal,
    rootDescription: input || `Create an actionable execution plan from ${fileName || 'the uploaded material'}.`,
    steps: [
      step('demo-step-1', 'Clarify the finish line', 'Define the required outcome, constraints, and what “done” looks like.', 10, 1),
      step('demo-step-2', 'Prepare the essential inputs', 'Collect only the information, files, or tools needed to begin.', 15, 2),
      step('demo-step-3', 'Produce the first deliverable', 'Complete one visible output, then review the next best action.', 20, 3),
    ],
    source: 'web-demo-rules',
    contextId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
  };
}

export function createDemoRecovery(request) {
  const pending = request.rootTask.nodes.filter((node) =>
    node.id !== request.rootTask.id && node.status !== 'done' && !node.deferredUntil
  );
  const mustKeep = new Set(request.mustKeepTaskIds || []);
  const changes = [];
  let remaining = pending.reduce((sum, node) => sum + Math.max(1, Number(node.estimatedMinutes) || 10), 0);

  for (const node of [...pending].filter((item) => !mustKeep.has(item.id)).sort((a, b) => b.priority - a.priority)) {
    if (remaining <= request.availableMinutes || changes.length >= 5) break;
    remaining -= Math.max(1, Number(node.estimatedMinutes) || 10);
    changes.push({
      operation: 'defer',
      targetId: node.id,
      patch: { deferredUntil: request.deadline ? String(request.deadline).slice(0, 10) : 'next-session' },
      reason: 'Defer this lower-priority step to protect the core deliverable.',
    });
  }

  const deferred = new Set(changes.map((change) => change.targetId));
  const next = pending.find((node) => !deferred.has(node.id));
  const feasible = remaining <= request.availableMinutes;
  return {
    proposalId: crypto.randomUUID(),
    basePlanVersion: request.planVersion,
    summary: feasible
      ? 'The affected plan was repaired around the time you still have available.'
      : `The plan still needs ${remaining - request.availableMinutes} more minutes. Extend the deadline or reduce the required scope.`,
    assumptions: ['Completed work is protected.', 'Must-keep steps remain in the plan.'],
    changes,
    nextStepId: next?.id || request.activeTaskId,
    remainingMinutes: Math.max(0, remaining),
    availableMinutes: request.availableMinutes,
    feasible,
    provider: 'web-demo-rules',
    requestId: crypto.randomUUID(),
  };
}

