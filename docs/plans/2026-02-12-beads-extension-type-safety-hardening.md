# Beads Extension Type-Safety Hardening Plan

> REQUIRED SUB-SKILL: Use @beads-code to implement this plan.

**Goal:** Improve type safety in the beads extension by replacing ad-hoc casts with schema-derived types, discriminated details unions, typed event narrowing, and parser guard helpers.

**Architecture:** Keep behavior unchanged while tightening compile-time guarantees around tool input/output and boundary parsing. Refactor in two feature slices: (1) tool typing contract, (2) runtime boundary narrowing/parsing guards.

**Tech Stack:** TypeScript, TypeBox, pi extension API, node:test

**Beads Epic:** bd-2wf

---

## Feature 1: Schema-driven tool typing — `bd-238`

### Task 1: Write tests for schema-derived input and typed result details — `bd-31x`

**Beads issue:** `bd-31x`

**Files:**
- Test: `extensions/beads/lib.test.ts`
- Test/Type assertions: `extensions/beads/index.ts` (compile-time checks through narrowed usage)

**Step 1: Write failing test**
- Add/adjust tests asserting behavior remains stable while introducing action-scoped details expectations.

**Step 2: Verify RED**
- Run `cd extensions/beads && npm test` and confirm failures tied to new typed expectations.

**Step 3: Implement**
- No implementation in this task.

**Step 4: Verify GREEN**
- N/A for this task (RED evidence only).

**Step 5: Commit**
- Commit test-only RED changes.

### Task 2: Implement schema-derived tool input and details union — `bd-2ch`

**Beads issue:** `bd-2ch`

**Files:**
- Update: `extensions/beads/index.ts`
- Update (if needed): `extensions/beads/lib.ts`

**Step 1: Implement schema-derived input type**
- Extract tool schema constant and derive `BeadsToolInput` using `Static<typeof schema>`.

**Step 2: Add details union**
- Introduce discriminated `BeadsToolDetails` keyed by `action` and return typed details in execute branches.

**Step 3: Refactor render narrowing**
- Replace broad `result.details as { ... }` casts with action-based narrowing.

**Step 4: Verify GREEN**
- Run `cd extensions/beads && npm test` and ensure all tests pass.

**Step 5: Commit**
- Commit implementation for typed input/details.

### Task 3: Verify schema-driven typing feature — `bd-2rq`

**Beads issue:** `bd-2rq`

Subtasks:
- `bd-1e0` Run test suite for schema-driven typing feature
- `bd-i74` Run linting and type checks for schema-driven typing feature
- `bd-1w2` Clean commits check for schema-driven typing feature

---

## Feature 2: Typed boundary handling — `bd-s5u`

### Task 4: Write tests for typed tool_call narrowing and parser guards — `bd-1d0`

**Beads issue:** `bd-1d0`

**Files:**
- Test: `extensions/beads/lib.test.ts`

**Step 1: Write failing test**
- Add tests covering guarded parser paths for valid/invalid payload shapes and backward-compatible parsing results.

**Step 2: Verify RED**
- Run `cd extensions/beads && npm test` and confirm expected failing assertions.

**Step 3: Implement**
- No implementation in this task.

**Step 4: Verify GREEN**
- N/A for this task (RED evidence only).

**Step 5: Commit**
- Commit test-only RED changes.

### Task 5: Implement typed event narrowing and parser guard helpers — `bd-31q`

**Beads issue:** `bd-31q`

**Files:**
- Update: `extensions/beads/index.ts`
- Update: `extensions/beads/lib.ts`

**Step 1: Add typed event narrowing**
- Use pi helper-based narrowing for `tool_call` bash input instead of manual input casting.

**Step 2: Add parser guards**
- Introduce small object/array/string guard helpers and refactor parsers to reduce unchecked casts.

**Step 3: Preserve compatibility**
- Ensure existing payload variants still parse as before.

**Step 4: Verify GREEN**
- Run `cd extensions/beads && npm test` and ensure all tests pass.

**Step 5: Commit**
- Commit boundary-typing implementation.

### Task 6: Verify typed boundary safety feature — `bd-2js`

**Beads issue:** `bd-2js`

Subtasks:
- `bd-29i` Run test suite for typed boundary safety feature
- `bd-1y2` Run linting and type checks for typed boundary safety feature
- `bd-m66` Clean commits check for typed boundary safety feature

---

## Execution Order

1. `bd-31x` → `bd-2ch` → `bd-2rq`
2. `bd-1d0` → `bd-31q` → `bd-2js`

Both feature tracks can run independently, but each track enforces TDD and verification gating.
