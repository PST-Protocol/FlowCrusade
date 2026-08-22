import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRecoveryProposal,
  buildRecoveryContext,
  clonePlan,
  validateRecoveryProposal,
} from '../src/utils/replan.js';
import {
  buildDeterministicReplan,
  normalizeModelProposal,
  normalizeReplanRequest,
} from '../server/replan.js';

function fixture() {
  return {
    id: 'root',
    title: 'Submit the demo',
    status: 'pending',
    progress: 30,
    planVersion: 2,
    children: [
      { id: 'done', title: 'Define scope', status: 'done', progress: 100, completedAt: '2026-08-22T10:00:00Z', estimatedMinutes: 20, children: [] },
      {
        id: 'build', title: 'Build recovery flow', status: 'pending', progress: 0, estimatedMinutes: 45, priority: 1,
        children: [
          { id: 'api', title: 'Add API', status: 'pending', progress: 0, estimatedMinutes: 25, priority: 1, children: [] },
        ],
      },
      { id: 'polish', title: 'Polish slides', status: 'pending', progress: 0, estimatedMinutes: 30, priority: 3, children: [] },
    ],
  };
}

test('buildRecoveryContext creates a compact, versioned snapshot', () => {
  const context = buildRecoveryContext(fixture(), { activeTaskId: 'api', availableMinutes: 50, delayMinutes: 30 });
  assert.equal(context.rootTask.nodes.length, 5);
  assert.equal(context.planVersion, 2);
  assert.equal(context.availableMinutes, 50);
  assert.equal(context.preserveCompleted, true);
});

test('applyRecoveryProposal updates nested nodes without mutating completed work', () => {
  const root = fixture();
  const before = clonePlan(root.children[0]);
  const proposal = {
    proposalId: 'proposal-1',
    basePlanVersion: 2,
    changes: [
      { operation: 'update', targetId: 'api', patch: { estimatedMinutes: 10 }, reason: 'Ship the smallest endpoint.' },
      { operation: 'defer', targetId: 'polish', patch: { deferredUntil: '2026-08-23' }, reason: 'Protect the demo.' },
    ],
    nextStepId: 'api',
  };
  const updated = applyRecoveryProposal(root, proposal);
  assert.deepEqual(updated.children[0], before);
  assert.equal(updated.children[1].children[0].estimatedMinutes, 10);
  assert.equal(updated.children[2].deferredUntil, '2026-08-23');
  assert.equal(updated.planVersion, 3);
  assert.equal(root.children[1].children[0].estimatedMinutes, 25);
});

test('validation rejects completed-node mutations and stale proposals', () => {
  const proposal = {
    basePlanVersion: 1,
    changes: [{ operation: 'update', targetId: 'done', patch: { estimatedMinutes: 5 } }],
    nextStepId: 'api',
  };
  const result = validateRecoveryProposal(fixture(), proposal, 2);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('stale')));
  assert.ok(result.errors.some((error) => error.includes('completed')));
});

test('deterministic fallback compresses and defers until the plan fits', () => {
  const request = normalizeReplanRequest(buildRecoveryContext(fixture(), {
    activeTaskId: 'api',
    availableMinutes: 25,
    delayMinutes: 40,
  }));
  const proposal = buildDeterministicReplan(request);
  assert.equal(proposal.provider, 'local-rules');
  assert.ok(proposal.changes.length > 0);
  assert.ok(proposal.changes.length <= 5);
  assert.equal(new Set(proposal.changes.map((change) => change.targetId)).size, proposal.changes.length);
  assert.equal(proposal.feasible, true);
  assert.ok(proposal.remainingMinutes <= proposal.availableMinutes);
});

test('deterministic fallback reports infeasible must-keep constraints', () => {
  const request = normalizeReplanRequest(buildRecoveryContext(fixture(), {
    activeTaskId: 'api',
    availableMinutes: 5,
    mustKeepTaskIds: ['build', 'api', 'polish'],
  }));
  const proposal = buildDeterministicReplan(request);
  assert.equal(proposal.feasible, false);
  assert.match(proposal.summary, /still needs/);
});

test('model proposal normalization rejects deferring must-keep work', () => {
  const request = normalizeReplanRequest(buildRecoveryContext(fixture(), {
    activeTaskId: 'api',
    availableMinutes: 30,
    mustKeepTaskIds: ['polish'],
  }));
  assert.throws(() => normalizeModelProposal({
    changes: [{ operation: 'defer', targetId: 'polish', patch: { deferredUntil: '2026-08-23' } }],
    nextStepId: 'api',
    feasible: true,
  }, request), /must-keep/);
});

test('model feasibility is recomputed from the patch instead of trusted', () => {
  const request = normalizeReplanRequest(buildRecoveryContext(fixture(), {
    activeTaskId: 'api',
    availableMinutes: 5,
  }));
  const proposal = normalizeModelProposal({
    changes: [],
    nextStepId: 'api',
    remainingMinutes: 1,
    feasible: true,
  }, request);
  assert.equal(proposal.feasible, false);
  assert.ok(proposal.remainingMinutes > proposal.availableMinutes);
});
