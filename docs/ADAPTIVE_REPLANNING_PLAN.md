# FocusTrail Adaptive Replanning Plan

## 1. Goal

Build a recovery loop that helps a user repair an existing plan after a delay,
interruption, skipped task, or changed time constraint. The feature must preserve
completed work, make the smallest useful set of changes, explain those changes,
and return the user to one concrete next action.

The MVP is user-triggered. Automatic deviation detection is intentionally out of
scope until the recovery workflow has been validated with users.

## 2. MVP User Story

1. A user opens an active task or focus session and selects **Plan disrupted**.
2. The user reports what changed:
   - delay: 15, 30, 60, or custom minutes;
   - reason: task overrun, interruption, skipped task, or other;
   - remaining available time and deadline;
   - optional must-keep tasks.
3. FocusTrail creates a recovery proposal from the current task tree.
4. The proposal shows what will be kept, shortened, deferred, updated, or added,
   plus the recommended next step and an explanation.
5. The user accepts, edits, or rejects the proposal.
6. On acceptance, FocusTrail saves a pre-change snapshot, applies the proposal,
   persists it, and navigates to the new next step.
7. The user can undo the most recently applied recovery.

## 3. Product Principles

- Repair the current plan; do not silently replace it.
- Completed tasks are immutable.
- Existing task IDs remain stable.
- Limit an MVP proposal to at most five changes.
- Require confirmation before changing user data.
- When the remaining plan is infeasible, state the deficit and ask the user to
  reduce scope or extend the deadline.
- Always provide a deterministic fallback when the model is unavailable or its
  output is invalid.

## 4. Data Contract

### Request: `POST /api/replan`

```json
{
  "rootTask": {},
  "activeTaskId": "task-2",
  "currentTime": "2026-08-22T18:30:00.000Z",
  "deadline": "2026-08-22T20:00:00.000Z",
  "delayMinutes": 40,
  "availableMinutes": 90,
  "reason": "task_overrun",
  "mustKeepTaskIds": ["task-3"],
  "preserveCompleted": true,
  "planVersion": 2
}
```

### Response

```json
{
  "requestId": "uuid",
  "proposalId": "uuid",
  "summary": "Keep completed work, shorten research, and defer reflection.",
  "assumptions": ["The deadline is fixed at 8:00 PM."],
  "changes": [
    {
      "operation": "update",
      "targetId": "task-2",
      "patch": { "estimatedMinutes": 15 },
      "reason": "Limit research to the three highest-value sources."
    },
    {
      "operation": "defer",
      "targetId": "task-4",
      "patch": { "deferredUntil": "2026-08-23" },
      "reason": "Reflection is useful but not required for today's deliverable."
    }
  ],
  "nextStepId": "task-2",
  "remainingMinutes": 80,
  "availableMinutes": 90,
  "feasible": true,
  "provider": "gemma"
}
```

### Allowed MVP operations

- `update`: change title, description, estimate, priority, or scheduled time.
- `defer`: keep the task but move it outside the current execution window.
- `insert`: add a concrete recovery step under an existing parent.

Deletion and mutation of completed nodes are not permitted in the MVP.

## 5. Task Model Extensions

Add fields only when needed so existing local data remains compatible:

```js
{
  estimatedMinutes: 20,
  priority: "high",
  scheduledFor: "2026-08-22T19:00:00.000Z",
  deferredUntil: null,
  planVersion: 3,
  recoverySource: "proposal-id"
}
```

Store recovery history separately under `fc_recovery_history`:

```js
{
  id: "recovery-id",
  rootTaskId: "root-id",
  createdAt: "ISO timestamp",
  reason: "task_overrun",
  proposal: {},
  beforeSnapshot: {},
  appliedPlanVersion: 3
}
```

Keep a bounded history of the latest 10 recoveries per root task.

## 6. Validation and Merge Rules

`validateRecoveryProposal()` must reject a proposal when:

- a target ID does not exist;
- an operation targets a completed node;
- a proposal changes a node ID or the root ID;
- more than five changes are returned;
- an inserted node has no valid parent;
- estimates are negative, non-numeric, or unreasonable;
- `nextStepId` is missing, completed, deferred, or outside the active root;
- the response claims feasibility while estimated remaining time exceeds the
  available time.

`applyRecoveryProposal()` must be a pure function. It returns a new task tree and
never mutates the current tree. Completed nodes and their descendants must be
deep-equal before and after application.

## 7. UI Design

### Entry points

- `FocusDetailView`: primary **Plan disrupted** action.
- `ViewB`: secondary action for users reviewing the whole plan.

### Recovery modal states

1. **Input**: delay, reason, available time, deadline, must-keep tasks.
2. **Generating**: progress message with cancel/close behavior.
3. **Proposal**: before/after change list, feasibility, assumptions, next step.
4. **Error/fallback**: explain that a local recovery rule was used.
5. **Applied**: confirmation and action to open the next step.

Primary copy:

- Entry: `计划被打乱了`
- Promise: `保留已完成内容，只调整受影响的部分。`
- Proposal title: `恢复方案`
- Apply action: `接受并回到下一步`
- Undo action: `撤销本次调整`

## 8. Backend Design

Add `POST /api/replan` using the existing provider abstraction and request/error
logging conventions.

Processing pipeline:

1. Validate and normalize request data.
2. Derive a compact recovery context: active path, completed nodes, remaining
   nodes, estimates, deadline, and user constraints.
3. Ask the model for JSON matching the response contract.
4. Parse and validate the proposal.
5. If generation or validation fails, run the deterministic fallback.
6. Return the proposal only; never mutate client task state on the server.

The prompt must explicitly forbid changing completed work, changing IDs, or
inventing additional user availability.

### Deterministic fallback

Use this order until the plan fits:

1. Keep completed and must-keep tasks.
2. Select the first pending task as the next action.
3. Reduce flexible pending tasks to their safe minimum estimate.
4. Defer the lowest-priority non-required tasks.
5. If the plan still does not fit, return `feasible: false` with the time deficit.

## 9. File-Level Work

### New files

- `src/services/replanApi.js`
  - API request, timeout, abort, and normalized errors.
- `src/utils/replan.js`
  - context building, validation, pure patch application, snapshots, undo.
- `src/components/common/RecoveryPlanModal.jsx`
  - input and proposal workflow.
- `src/utils/replan.test.js`
  - unit tests for validation, application, persistence, and undo.
- `server/replan.js`
  - schema normalization, model prompt, output parsing, deterministic fallback.

### Existing files

- `src/App.jsx`
  - modal state, recovery orchestration, persistence, history, and navigation.
- `src/components/views/FocusDetailView.jsx`
  - primary recovery entry point.
- `src/components/views/ViewB.jsx`
  - plan-level recovery entry point.
- `server/index.js`
  - mount the replan route after existing local changes are reviewed.

## 10. Implementation Milestones

### M1 — Contract and safe local engine (0.5–1 day)

- Define request/response constants and allowed patch fields.
- Implement proposal validation and pure application.
- Implement snapshot and single-step undo.
- Add unit tests for task-tree invariants.

Exit condition: a fixture proposal safely updates a nested task tree without an
LLM or UI.

### M2 — Deterministic end-to-end recovery (0.5–1 day)

- Build modal input and proposal preview.
- Generate a local deterministic proposal.
- Apply, persist, navigate, and undo.

Exit condition: the full workflow works offline and survives page refresh.

### M3 — Model-backed proposals (0.5–1 day)

- Add `/api/replan` and structured Gemma/Qwen prompt.
- Validate every model response.
- Fall back automatically on timeout, provider failure, or malformed output.

Exit condition: model and fallback paths produce the same stable response shape.

### M4 — Demo hardening and measurement (0.5–1 day)

- Add loading, error, infeasible-plan, and stale-version states.
- Add lightweight recovery events.
- Run the manual scenario matrix and fix presentation issues.

Exit condition: the OPC demo can show disruption, recovery, apply, and undo in
under 90 seconds.

## 11. Test Matrix

### Unit tests

- completed tasks remain unchanged;
- existing IDs remain stable;
- nested updates target the correct node;
- inserts receive a unique ID and valid parent;
- invalid estimates and unknown IDs are rejected;
- more than five changes are rejected;
- infeasible plans report a deficit;
- undo restores the exact previous snapshot;
- malformed model JSON triggers fallback.

### Integration scenarios

1. A 40-minute delay with enough time after task compression.
2. A fixed deadline that requires one low-priority task to be deferred.
3. A must-keep task that prevents a feasible proposal.
4. An interruption while a nested task is active.
5. Provider timeout with deterministic fallback.
6. Refresh after applying a recovery.
7. A stale proposal generated from an older `planVersion`.

## 12. Analytics for Early Validation

Track locally for the first test cohort:

- recovery initiated;
- proposal generated and provider used;
- proposal accepted, edited, or rejected;
- time from acceptance to starting the next task;
- next task completed;
- undo used;
- invalid model proposal and fallback rate.

Useful early metrics are recovery acceptance rate, median time-to-next-action,
next-step completion rate, proposal edit rate, and fallback rate. These must be
reported as small-sample validation metrics, not production-scale claims.

## 13. Definition of Done

The MVP is complete when:

- a user can report a disruption from an active task;
- FocusTrail produces an explainable, bounded proposal;
- completed work and stable IDs are protected by tests;
- the user previews and confirms all changes;
- the accepted plan persists across refresh;
- FocusTrail opens a valid new next step;
- one-step undo restores the original plan;
- provider failure produces a usable fallback;
- an impossible plan clearly reports the constraint conflict.

## 14. Explicitly Deferred

- automatic recovery triggered by every distraction event;
- calendar or external task-manager synchronization;
- multi-device recovery history sync;
- long-horizon optimization across multiple root goals;
- autonomous plan mutation without confirmation;
- learned personalization before sufficient user data exists.

