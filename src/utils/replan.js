const ALLOWED_OPERATIONS = new Set(['update', 'defer', 'insert']);
const ALLOWED_UPDATE_FIELDS = new Set([
  'title', 'desc', 'estimatedMinutes', 'priority', 'scheduledFor', 'deferredUntil',
]);

export const RECOVERY_HISTORY_KEY = 'fc_recovery_history';
export const MAX_RECOVERY_CHANGES = 5;

export function clonePlan(value) {
  return JSON.parse(JSON.stringify(value));
}

export function flattenTaskTree(rootTask) {
  const rows = [];
  const visit = (node, parentId = null) => {
    if (!node) return;
    rows.push({ node, parentId });
    (node.children || []).forEach((child) => visit(child, node.id));
  };
  visit(rootTask);
  return rows;
}

export function getRemainingMinutes(rootTask) {
  return flattenTaskTree(rootTask)
    .filter(({ node }) => node.id !== rootTask?.id && node.status !== 'done' && !node.deferredUntil)
    .reduce((sum, { node }) => sum + Math.max(1, Number(node.estimatedMinutes) || 10), 0);
}

export function buildRecoveryContext(rootTask, input = {}) {
  const nodes = flattenTaskTree(rootTask).map(({ node, parentId }) => ({
    id: node.id,
    parentId,
    title: node.title,
    desc: node.desc || '',
    status: node.status || 'pending',
    estimatedMinutes: Math.max(1, Number(node.estimatedMinutes) || 10),
    priority: Number(node.priority) || 3,
    deferredUntil: node.deferredUntil || null,
  }));

  return {
    rootTask: {
      id: rootTask.id,
      title: rootTask.title,
      desc: rootTask.desc || '',
      planVersion: Number(rootTask.planVersion) || 1,
      nodes,
    },
    activeTaskId: input.activeTaskId || rootTask.id,
    currentTime: input.currentTime || new Date().toISOString(),
    deadline: input.deadline || null,
    delayMinutes: Math.max(0, Number(input.delayMinutes) || 0),
    availableMinutes: Math.max(1, Number(input.availableMinutes) || 60),
    reason: input.reason || 'interruption',
    mustKeepTaskIds: Array.isArray(input.mustKeepTaskIds) ? input.mustKeepTaskIds : [],
    preserveCompleted: true,
    planVersion: Number(rootTask.planVersion) || 1,
  };
}

function validatePatch(patch = {}) {
  const keys = Object.keys(patch);
  if (!keys.length) return 'update patch cannot be empty';
  if (keys.some((key) => !ALLOWED_UPDATE_FIELDS.has(key))) return 'patch contains an unsupported field';
  if ('estimatedMinutes' in patch) {
    const minutes = Number(patch.estimatedMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) return 'estimatedMinutes must be an integer from 1 to 240';
  }
  return null;
}

export function validateRecoveryProposal(rootTask, proposal, expectedPlanVersion = Number(rootTask?.planVersion) || 1) {
  const errors = [];
  if (!rootTask?.id) errors.push('root task is required');
  if (!proposal || typeof proposal !== 'object') return { valid: false, errors: ['proposal is required'] };
  if (Number(proposal.basePlanVersion ?? expectedPlanVersion) !== Number(expectedPlanVersion)) errors.push('proposal is stale');

  const rows = flattenTaskTree(rootTask);
  const nodeMap = new Map(rows.map(({ node }) => [node.id, node]));
  const changes = Array.isArray(proposal.changes) ? proposal.changes : [];
  if (changes.length > MAX_RECOVERY_CHANGES) errors.push(`proposal cannot exceed ${MAX_RECOVERY_CHANGES} changes`);

  changes.forEach((change, index) => {
    const label = `change ${index + 1}`;
    if (!ALLOWED_OPERATIONS.has(change.operation)) {
      errors.push(`${label} uses an unsupported operation`);
      return;
    }
    const target = nodeMap.get(change.targetId);
    if (!target) {
      errors.push(`${label} targets an unknown task`);
      return;
    }
    if (target.status === 'done') errors.push(`${label} cannot modify a completed task`);
    if (change.targetId === rootTask.id && change.operation !== 'insert') errors.push(`${label} cannot modify the root task`);

    if (change.operation === 'update' || change.operation === 'defer') {
      const patchError = validatePatch(change.patch);
      if (patchError) errors.push(`${label}: ${patchError}`);
    }
    if (change.operation === 'defer' && !change.patch?.deferredUntil) errors.push(`${label} must include deferredUntil`);
    if (change.operation === 'insert') {
      if (!change.node?.title?.trim()) errors.push(`${label} must include a task title`);
      if (change.node?.status === 'done') errors.push(`${label} cannot insert completed work`);
    }
  });

  const next = proposal.nextStepId ? nodeMap.get(proposal.nextStepId) : null;
  const insertedNext = changes.find((change) => change.operation === 'insert' && change.node?.id === proposal.nextStepId)?.node;
  if (!next && !insertedNext) errors.push('nextStepId must identify a task in the active plan');
  if (next?.status === 'done' || next?.deferredUntil) errors.push('next step must be pending and available');
  const remainingMinutes = Number(proposal.remainingMinutes);
  const availableMinutes = Number(proposal.availableMinutes);
  if (proposal.feasible && Number.isFinite(remainingMinutes) && Number.isFinite(availableMinutes) && remainingMinutes > availableMinutes) {
    errors.push('proposal cannot be feasible when remaining time exceeds available time');
  }

  return { valid: errors.length === 0, errors };
}

function applyToNode(node, change, recoverySource) {
  if (node.id !== change.targetId) {
    return { ...node, children: (node.children || []).map((child) => applyToNode(child, change, recoverySource)) };
  }

  if (change.operation === 'insert') {
    const inserted = {
      id: change.node.id || `${node.id}-recovery-${Date.now()}`,
      title: change.node.title,
      desc: change.node.desc || '',
      estimatedMinutes: Math.max(1, Number(change.node.estimatedMinutes) || 10),
      priority: Number(change.node.priority) || 1,
      progress: 0,
      status: 'pending',
      children: [],
      recoverySource,
    };
    return { ...node, children: [...(node.children || []), inserted] };
  }

  return { ...node, ...change.patch, recoverySource };
}

export function applyRecoveryProposal(rootTask, proposal) {
  const currentVersion = Number(rootTask?.planVersion) || 1;
  const validation = validateRecoveryProposal(rootTask, proposal, currentVersion);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  let nextRoot = clonePlan(rootTask);
  proposal.changes.forEach((change) => {
    nextRoot = applyToNode(nextRoot, change, proposal.proposalId || 'local-recovery');
  });
  return {
    ...nextRoot,
    planVersion: currentVersion + 1,
    lastRecoveryAt: new Date().toISOString(),
  };
}

export function createRecoveryRecord(rootTask, proposal, input = {}) {
  return {
    id: proposal.proposalId || `recovery-${Date.now()}`,
    rootTaskId: rootTask.id,
    createdAt: new Date().toISOString(),
    reason: input.reason || 'interruption',
    proposal: clonePlan(proposal),
    beforeSnapshot: clonePlan(rootTask),
    appliedPlanVersion: (Number(rootTask.planVersion) || 1) + 1,
  };
}

export function appendRecoveryHistory(history, record) {
  return [record, ...(Array.isArray(history) ? history : [])]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 10);
}

export function loadRecoveryHistory() {
  try {
    const value = localStorage.getItem(RECOVERY_HISTORY_KEY);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}
