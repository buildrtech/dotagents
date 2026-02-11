---
name: beads-code
description: Execute implementation work on beads issues — select leaf task, TDD, checkpoint, verify, close, bubble up.
---

# Beads Code

Implement beads issues one at a time with TDD, checkpointing, and structured close.

This is the beads-flavored version of `@executing-plans`. It adds issue selection, progress checkpointing, and close/bubble-up behavior.

**Core principle:** Continuous execution — close the current leaf task, then immediately pick the next ready leaf task. Stop only on blockers or when explicitly told to stop.

## When to Use

- After `@beads-plan` has created a plan with mapped beads tasks
- When picking up ready work from the backlog
- When resuming after context compaction or a new session

**Announce at start:** "I'm using the beads-code skill to implement beads issues."

## Session Start Protocol

**ALWAYS begin every session with these steps, in order:**

### 1. Verify Working Directory

```bash
pwd
git log --oneline -10
```

Confirm you're in the project root. Understand recent commits.

### 2. Check for In-Progress Work First

```bash
br list --status in_progress
```

If something is in progress, resume it. Read its comments to recover context:

```bash
br show <id>
```

Comments contain checkpoint information from previous work. This is critical for continuity after context compaction.

### 3. Otherwise, Find Ready Work

```bash
br ready --sort priority
```

### 4. Drill Down to Leaf Task

Pick the top item. If it's an epic or feature, drill down to find the actual leaf task:

```bash
br show <id> --json
```

Look at dependents with `"dependency_type": "parent-child"`. If there are open children, pick the first one and repeat until you reach a leaf (no open children).

**Drill-down loop:**
1. `br show <id> --json` — check for open `parent-child` dependents
2. If open children exist → mark current as `in_progress`, examine first open child, repeat
3. If no open children → this is the leaf task

**Example:**
```bash
br ready --sort priority
# → [P0] br-abc (epic)

br update br-abc --status in_progress
br show br-abc --json
# dependents includes br-def with dependency_type: "parent-child"

br update br-def --status in_progress
br show br-def --json
# dependents includes br-ghi (task) with dependency_type: "parent-child"

br update br-ghi --status in_progress
br show br-ghi --json
# No open children → this is the leaf task. Implement br-ghi.
```

### 5. Claim the Leaf Task

```bash
br update <task-id> --status in_progress
br show <task-id>
```

Read the task details carefully. If the task has notes referencing a plan, load the plan file.

### 6. Verify Codebase Health

Run the project's test suite before any new work:

```bash
# whatever the project uses: npm test, pytest, go test, etc.
```

If tests fail, fix them first. Do not start new work on a broken codebase.

## Implementation

### Load Plan (if exists)

If the task's notes reference a plan:

```bash
br show <task-id>
# notes: "Plan: docs/plans/YYYY-MM-DD-feature.md, Task N"
```

Read the plan and follow the exact steps for this task.

### Apply TDD

Apply `@test-driven-development` — no exceptions:

1. RED: Write failing test
2. Verify RED: Watch it fail
3. GREEN: Minimal code to pass
4. Verify GREEN: Watch it pass
5. REFACTOR: Clean up while green
6. Repeat

### Checkpoint Progress

**Context compaction can happen at any time.** Checkpoint frequently so state survives.

**When to checkpoint:**
- After completing a subtask or test cycle
- After making a key design decision
- Before any risky operation
- Every ~15 minutes of active work
- When you've learned something important

**Checkpoint format:**

```bash
br comments add <task-id> "Checkpoint: [brief description]
- Done: [what you just completed]
- Approach: [current strategy]
- Next: [immediate next step]
- Blockers: [any issues discovered]"
```

**Why this matters:** Context compaction creates a "new session" mid-stream. Without checkpoints, you lose your current approach, decisions made, files examined, and dead ends explored. Checkpoints in beads comments are your progress file. The next session recovers by reading `br show <task-id>`.

### Commit Frequently

Small, frequent commits with descriptive messages:

```bash
git add -p
git commit -m "feat(scope): description"
```

Commits also serve as checkpoints. Uncommitted work is lost work.

### Discovered Work

If you find additional work needed:

```bash
br create "Found: [description]" --type task
```

If it blocks current work:

```bash
br dep add <current-task> <new-task> --type blocks
br comments add <current-task> "Blocked: discovered <new-task> needs to be done first"
br update <current-task> --status open
```

Stop and ask for guidance.

## Verification and Close

### Verify (via @verification-before-completion)

Apply `@verification-before-completion` before closing any issue:

1. Check acceptance criteria: `br show <task-id>`
2. Walk through each criterion — can you demonstrate it's met?
3. Run automated tests — report pass/fail counts
4. Run linter/type checks
5. Manual verification if UI changes
6. Clean state: remove debug statements, resolve TODOs

### Close the Leaf Task

```bash
br close <task-id> --reason "Verified: [what you tested and how]"
```

The `--reason` must include concrete evidence, not just "done".

### Bubble Up: Close Parents

After closing a leaf task, check if parent can be closed:

```bash
br show <parent-id> --json
```

If ALL children with `dependency_type: "parent-child"` are closed:

```bash
br close <parent-id> --reason "All child tasks complete"
```

Repeat for epic level if all features are closed.

### Continue Execution Loop (default behavior)

After closing and bubbling up:

1. Run `br list --status in_progress` — resume any remaining in-progress work first
2. Else run `br ready --sort priority`
3. Select the next ready top-priority item
4. Drill down to the next leaf task
5. Claim and continue implementation

Do not pause between issues unless:
- a blocker is hit
- verification fails and cannot be resolved quickly
- the user explicitly asks to stop after the current issue

## Session End

After completing work:

1. **Commit** all changes (apply `@semantic-commit`)

2. **Add session context** to the parent feature:

```bash
br comments add <feature-id> "Session summary:
- Tasks completed: [list task IDs]
- What was implemented
- What was verified
- Decisions made
- What's next"
```

3. **Only stop when appropriate:**
- No ready/in-progress issues remain
- A blocker requires user input
- User explicitly requested single-issue mode

If stopping, provide a concise status summary and next recommended issue.

## Critical Rules

1. **One issue at a time.** Do not work on multiple issues simultaneously.
2. **Never close without verification.** `--reason` must contain evidence.
3. **Never start on a broken codebase.** Fix failing tests first.
4. **Never stop without committing.** Uncommitted work is lost work.
5. **Never stop without checkpointing.** Future sessions depend on issue comments.
6. **Never skip TDD.** Apply `@test-driven-development` for every code change.
7. **Always drill to leaf.** Work on leaf tasks, not features or epics directly.

## Handling Problems

| Problem | Action |
|---------|--------|
| Tests fail at session start | Fix them before new work |
| Blocked by another issue | Wire dependency, update status, ask user |
| Running out of context | Checkpoint immediately, commit WIP, notify user |
| Task too large | Decompose into subtasks via `@beads-create` |
| Design unclear | Add comment with questions, ask user |
