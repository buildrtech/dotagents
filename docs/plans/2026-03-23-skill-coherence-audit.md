# Skill Coherence Audit — Implementation Plan

> REQUIRED: Use the `executing-plans` skill to implement this plan task-by-task.

**Goal:** Make all skills chain coherently through the brainstorming → writing-plans → executing-plans spine. Standardize cross-references, remove stale refs, install missing external skill, merge redundant skills, wire dead ends back into the pipeline.

**Conventions established by this plan:**
- **Cross-references:** Plain backtick names in prose — `writing-plans` — no `@`, `Skill()`, or `superpowers:` prefixes
- **Funnel routing:** Skills that produce actionable findings get a "## What Happens Next" section. The user decides which findings to act on; the section routes by *size of the fix*: quick fix → TDD directly, clear scope multi-step → `writing-plans`, needs design → `brainstorming`
- **Categories:** Every skill gets `metadata.category` — one of: `superpowers`, `languages`, `tools`, `workflow`, `qa`

```
                         ENTRY POINTS (produce findings)
                         ───────────────────────────────
                         code-review (incl. self-review)
                         receiving-code-review
                         refactoring
                         systematic-debugging
                         fetch-ci-build
                         qa-execute
                                    │
                            triage by size
                     ┌──────────┼──────────────┐
                     │          │              │
                 quick fix   multi-step    needs design
                     │          │              │
                     │          │       ┌──────┴──────┐
                     │          │       │ brainstorming│
                     │          │       └──────┬──────┘
                     │          │              │
                     │          └──────┬───────┘
                     │          ┌──────┴──────┐
                     │          │writing-plans│
                     │          └──────┬──────┘
                     │                 │
                     │          ┌──────┴───────┐
                     │          │executing-plans│
                     │          └──┬───┬───┬───┘
                     │             │   │   │
                     ▼             ▼   │   ▼
               ┌─────────────────────┐ │ ┌──────────────┐
               │ test-driven-        │ │ │ document-    │
               │ development         │ │ │ writing      │
               └────────┬────────────┘ │ └──────────────┘
                        │              │
               when stuck → systematic-debugging (loops back up)
                        │
                        ▼
               ┌─────────────────────┐
               │ remove-slop         │
               │ semantic-commit     │
               │ verification-before-│
               │ completion          │
               └────────┬────────────┘
                        │
                        ▼
               ┌─────────────────────┐
               │ creating-pr         │
               └─────────────────────┘

  UPSTREAM (idea → shape → design):
  shaping/breadboarding/kickoff-doc → brainstorming

  QA CHAIN: qa-brainstorm → qa-plan → qa-execute → findings funnel back up

  CONTEXTUAL (loaded during any code work):
  typescript, react, ruby, rails, sorbet, python, go, rust, sql, postgres
  frontend-design (loaded for UI work, augments react)

  TOOLS (used when needed):
  github, linear-cli, brave-search, summarize, ast-grep, mermaid,
  playwright-cli, tmux, notify, buildkite-cli, sentry-issue

  PROSE QUALITY (loaded when writing for humans):
  writing-clearly-and-concisely
```

---

## Phase 1: External Setup

### Task 1: Install obra/the-elements-of-style via plugins.toml

**Files:** `plugins.toml`

**Step 1:** Add plugin entry to `plugins.toml`:

```toml
["obra/the-elements-of-style"]
url = "https://github.com/obra/the-elements-of-style"
ref = "main"
skills = ["writing-clearly-and-concisely"]
```

**Step 2:** Build and install:

```bash
make install
```

Expected: `writing-clearly-and-concisely` appears in build output.

**Step 3:** Verify:

```bash
test -f ~/.agents/skills/writing-clearly-and-concisely/SKILL.md && echo "OK"
test -f ~/.agents/skills/writing-clearly-and-concisely/elements-of-style.md && echo "OK"
```

**Step 4:** Commit:

```bash
git add plugins.toml
git commit -m "feat: add obra/the-elements-of-style skill via plugins.toml"
```

---

## Phase 2: Structural Merge

### Task 2: Merge requesting-code-review into code-review, then delete it

`requesting-code-review` is a thin wrapper around `code-review`'s framework. After merging, `code-review` handles both external review and self-review.

**Files:**
- Modify: `skills/code-review/SKILL.md`
- Delete: `skills/requesting-code-review/` (entire directory)

**Step 1:** In `skills/code-review/SKILL.md`, update the Activation section. Replace:

```
## Activation

- User invokes `/code-review`
- User asks to review code, PR, or changes
```

With:

```
## Activation

- User invokes `/code-review`
- User asks to review code, PR, or changes
- Self-review before merge or PR creation (see "Self-Review" below)
```

**Step 2:** Add a Self-Review section after the "## Output Format" section and before "## Constraints". This replaces the entire `requesting-code-review` skill:

```markdown
## Self-Review

Use this workflow to review your own changes before merge or PR creation.

**When:**
- After completing a major feature
- Before merge to main
- When stuck (fresh perspective)
- Before refactoring (baseline check)

**How:**

1. Get the diff:
```bash
BASE_SHA=$(git merge-base HEAD origin/main)
git diff $BASE_SHA HEAD
```

2. Apply the six-domain review above to your own changes, flagging issues by severity (P0–P4).

3. Fix Critical and Important issues before proceeding. Note Minor issues for later.
```

**Step 3:** Replace the existing "## Composing With Other Skills" section at the end with a unified "## What Happens Next" section:

```markdown
## What Happens Next

After the review, act on findings by severity:

- **P0/P1 — Blockers and Critical**: fix immediately. Quick fix → `test-driven-development` + `verification-before-completion`. Multi-step → `writing-plans` then `executing-plans`.
- **P2 — Important**: create tracked issues with `issue-writing`, then plan and execute when prioritized.
- **P3/P4 — Minor and Observations**: note for later or fix opportunistically.
- **Complex findings** needing design exploration: start with `brainstorming` before planning.

For refactoring-focused reviews, also apply the `refactoring` skill.
```

**Step 4:** Delete the old skill:

```bash
rm -rf skills/requesting-code-review
```

**Step 5:** Verify:

```bash
rg "Skill\(|Composing With" skills/code-review/SKILL.md  # expect: no matches
test -d skills/requesting-code-review && echo "STILL EXISTS" || echo "DELETED"
```

**Step 6:** Commit:

```bash
git add -A
git commit -m "refactor: merge requesting-code-review into code-review"
```

---

## Phase 3: Core Pipeline Fixes

### Task 3: Fix brainstorming — refs + upstream connection

**Files:** `skills/brainstorming/SKILL.md`

**Step 1:** Fix the phantom `elements-of-style` reference. Replace:

```
- Use elements-of-style:writing-clearly-and-concisely skill if available
```

With:

```
- Use the `writing-clearly-and-concisely` skill for clearer prose
```

**Step 2:** Fix the `superpowers:` reference. Replace:

```
- Use superpowers:writing-plans skill to create detailed implementation plan
```

With:

```
- Use the `writing-plans` skill to create a detailed implementation plan
```

**Step 3:** Add upstream connection. Add after "## Overview" paragraph, before "## The Process":

```markdown
## Upstream

This skill is the design stage. Work may arrive here from:
- **Shaping** — if using Shape Up (`shaping`, `breadboarding`, `kickoff-doc` skills), brainstorming refines the shaped pitch into an implementable design
- **Findings** — complex findings from `code-review`, `refactoring`, or `systematic-debugging` that need design exploration before planning
- **New ideas** — user brings an idea directly
```

**Step 4:** Verify:

```bash
rg "superpowers:|elements-of-style:" skills/brainstorming/SKILL.md  # expect: no matches
```

**Step 5:** Commit:

```bash
git add skills/brainstorming/SKILL.md
git commit -m "fix(brainstorming): fix stale refs, add upstream connections"
```

---

### Task 4: Fix writing-plans — cross-ref syntax

**Files:** `skills/writing-plans/SKILL.md`

**Step 1:** Replace both `superpowers:executing-plans` references:

Replace the plan header template line:
```
> REQUIRED SUB-SKILL: Use superpowers:executing-plans skill to implement this plan task-by-task.
```
With:
```
> REQUIRED: Use the `executing-plans` skill to implement this plan task-by-task.
```

Replace in Execution Handoff:
```
- **REQUIRED SUB-SKILL:** Use superpowers:executing-plans skill to implement the plan
```
With:
```
- **REQUIRED:** Use the `executing-plans` skill to implement the plan
```

**Step 2:** Fix the "@ syntax" reference in Remember section. Replace:

```
- Reference relevant skills with @ syntax
```

With:

```
- Reference relevant skills by name in backticks
```

**Step 3:** Verify:

```bash
rg "superpowers:|SUB-SKILL|@ syntax" skills/writing-plans/SKILL.md  # expect: no matches
```

**Step 4:** Commit:

```bash
git add skills/writing-plans/SKILL.md
git commit -m "fix(writing-plans): standardize skill cross-references"
```

---

### Task 5: Fix executing-plans — chain refs + failure loop + docs wire

**Files:** `skills/executing-plans/SKILL.md`

**Step 1:** Add `semantic-commit` reference. After the line:

```
5. Commit at stable checkpoint when the item closes (do not accumulate big-bang changes)
```

Add:

```
   - Use the `semantic-commit` skill for commit messages
```

**Step 2:** Add failure loop. After step 6 ("If blocked: Stop and ask for help (don't guess)"), add:

```
   - If blocked by a bug: use the `systematic-debugging` skill, then return to this task
```

**Step 3:** Replace "### Step 3: Complete" with:

```markdown
### Step 3: Complete

After all tasks:
- Use the `verification-before-completion` skill for final checks
- If the plan included documentation tasks, use the `document-writing` skill (with `writing-clearly-and-concisely` for prose quality)
- Summarize completed work and verification output
```

**Step 4:** Verify:

```bash
rg "semantic-commit|verification-before-completion|systematic-debugging|document-writing" skills/executing-plans/SKILL.md
```

Expected: all four appear.

**Step 5:** Commit:

```bash
git add skills/executing-plans/SKILL.md
git commit -m "fix(executing-plans): wire up commit, verify, debug, and docs skills"
```

---

## Phase 4: Findings Producers — Add Funnel Routing

### Task 6: Fix receiving-code-review — add funnel + category

**Files:** `skills/receiving-code-review/SKILL.md`

**Step 1:** Add `metadata` block. After the `description` line in frontmatter, add:

```yaml
metadata:
  category: superpowers
```

**Step 2:** Add routing section. Insert after "## Implementation Order", before "## When To Push Back":

```markdown
## What Happens Next

After understanding and verifying all feedback items, for changes you choose to make:

- **Quick fix** (obvious, < 5 min): apply directly with `test-driven-development` + `verification-before-completion`
- **Needs design exploration**: use `brainstorming` to explore the approach
- **Clear scope, multi-step**: create a plan with `writing-plans`, execute with `executing-plans`
```

**Step 3:** Commit:

```bash
git add skills/receiving-code-review/SKILL.md
git commit -m "fix(receiving-code-review): add pipeline funnel, add category"
```

---

### Task 7: Fix refactoring — funnel to issue-writing + pipeline

**Files:** `skills/refactoring/SKILL.md`

**Step 1:** Replace the handoff section. Find:

```
### Step 5: Handoff
```

Replace the entire Step 5 (including the code block containing "Ready for issue creation...") with:

```markdown
### Step 5: What Happens Next

Present findings to the user. For findings they choose to act on:

- **Quick fix** (obvious, < 5 min): apply directly with `test-driven-development` + `verification-before-completion`
- **Needs design exploration**: use `brainstorming` to explore the approach
- **Clear scope, multi-step**: create a plan with `writing-plans`, then execute with `executing-plans`
```

**Step 2:** Commit:

```bash
git add skills/refactoring/SKILL.md
git commit -m "fix(refactoring): funnel findings into issue-writing and pipeline"
```

---

### Task 8: Fix systematic-debugging — cross-refs + funnel

**Files:** `skills/systematic-debugging/SKILL.md`

**Step 1:** Fix both `superpowers:` references:

Replace:
```
   - Use the `superpowers:test-driven-development` skill for writing proper failing tests
```
With:
```
   - Use the `test-driven-development` skill for writing proper failing tests
```

Replace:
```
- **superpowers:test-driven-development** - For creating failing test case (Phase 4, Step 1)
- **superpowers:verification-before-completion** - Verify fix worked before claiming success
```
With:
```
- **`test-driven-development`** — For creating failing test case (Phase 4, Step 1)
- **`verification-before-completion`** — Verify fix worked before claiming success
```

**Step 2:** Add funnel section. Insert before "## Real-World Impact":

```markdown
## What Happens Next

After finding the root cause:

- **Quick fix** (obvious, < 5 min): apply directly with `test-driven-development` + `verification-before-completion`
- **Needs design exploration**: use `brainstorming` to explore the approach
- **Clear scope, multi-step**: create a plan with `writing-plans`, then use `executing-plans`
```

**Step 3:** Verify:

```bash
rg "superpowers:" skills/systematic-debugging/SKILL.md  # expect: no matches
```

**Step 4:** Commit:

```bash
git add skills/systematic-debugging/SKILL.md
git commit -m "fix(systematic-debugging): standardize refs, add pipeline funnel"
```

---

### Task 9: Fix fetch-ci-build — replace integration section with funnel

**Files:** `skills/fetch-ci-build/SKILL.md`

**Step 1:** Replace the "## Integration with Other Skills" section with:

```markdown
## What Happens Next

After diagnosing a failure:

- **Quick fix** (obvious, < 5 min): fix directly with `test-driven-development` + `verification-before-completion`
- **Unclear root cause**: use `systematic-debugging` to investigate first
- **Needs design exploration**: use `brainstorming` to explore the approach
- **Clear scope, multi-step**: create a plan with `writing-plans`, execute with `executing-plans`
```

**Step 2:** Commit:

```bash
git add skills/fetch-ci-build/SKILL.md
git commit -m "fix(fetch-ci-build): replace integration section with pipeline funnel"
```

---

### Task 10: Fix qa-execute — wire findings back into pipeline

**Files:** `skills/qa-execute/SKILL.md`

**Step 1:** Add a section after "## Step 6: Cleanup", before the "## When to Stop" section:

```markdown
## What Happens Next

When test failures reveal bugs in the application:

- **Quick fix** (obvious cause, < 5 min): fix directly with `test-driven-development` + `verification-before-completion`, then re-run the failed QA test
- **Unclear root cause**: use `systematic-debugging` to investigate first
- **Needs design exploration**: use `brainstorming` to explore the approach
- **Clear scope, multi-step**: create a plan with `writing-plans`, execute with `executing-plans`
```

**Step 2:** Commit:

```bash
git add skills/qa-execute/SKILL.md
git commit -m "fix(qa-execute): wire failure findings back into implementation pipeline"
```

---

## Phase 5: Implementation Loop Fixes

### Task 11: Fix remove-slop — phantom references

**Files:** `skills/remove-slop/SKILL.md`

**Step 1:** In the Activation section, replace:

```
- Before committing code (called by the `clean-commits` skill)
```

With:

```
- Before committing code (called by the `semantic-commit` skill)
```

**Step 2:** Replace the Dependencies block:

```
**Invokes:** None

**Invoked by:** `Skill(skill: "clean-commits")`, `Skill(skill: "verification")`
```

With:

```
**Invoked by:** `semantic-commit`, `verification-before-completion`
```

**Step 3:** Verify:

```bash
rg "clean-commits|Skill\(" skills/remove-slop/SKILL.md  # expect: no matches
```

**Step 4:** Commit:

```bash
git add skills/remove-slop/SKILL.md
git commit -m "fix(remove-slop): replace phantom refs with actual skill names"
```

---

### Task 12: Fix semantic-commit — cross-ref syntax

**Files:** `skills/semantic-commit/SKILL.md`

**Step 1:** Replace:

```
1. Run `@remove-slop` as a cleanup pass.
```

With:

```
1. Run the `remove-slop` skill as a cleanup pass.
```

**Step 2:** Commit:

```bash
git add skills/semantic-commit/SKILL.md
git commit -m "fix(semantic-commit): standardize skill cross-reference"
```

---

### Task 13: Fix verification-before-completion — cross-ref syntax

**Files:** `skills/verification-before-completion/SKILL.md`

**Step 1:** Replace:

```
Optional hygiene pass: run `@remove-slop` before final completion claims.
```

With:

```
Optional hygiene pass: run the `remove-slop` skill before final completion claims.
```

**Step 2:** Replace:

```
  - Prefer the **Playwright CLI skill** for browser validation.
```

With:

```
  - Prefer the `playwright-cli` skill for browser validation.
```

**Step 3:** Commit:

```bash
git add skills/verification-before-completion/SKILL.md
git commit -m "fix(verification-before-completion): standardize skill cross-references"
```

---

## Phase 6: Supporting Skills

### Task 14: Fix creating-pr — remove skill-chaining from preconditions

`creating-pr` should be standalone. The user handles review and verification themselves before reaching this skill.

**Files:** `skills/creating-pr/SKILL.md`

**Step 1:** Replace the preconditions section. Replace:

```
Before creating a PR:
1. Run `@verification-before-completion` and confirm fresh passing evidence.
2. Run `@requesting-code-review` (self-review) and fix Critical/Important findings.
3. Ensure branch only contains in-scope changes.
```

With:

```
Before creating a PR:
1. Tests pass and linters are clean (fresh evidence, not memory).
2. Branch only contains in-scope changes.
```

**Step 2:** Fix the category. Replace `category: quality` with `category: workflow` in the frontmatter metadata block.

**Step 3:** Add docs verification. In "## 5) Validate PR and share link", after "open risks / follow-ups", add:

```
- documentation updated (if behavior changed)
```

**Step 4:** Commit:

```bash
git add skills/creating-pr/SKILL.md
git commit -m "fix(creating-pr): simplify preconditions, fix category, add docs check"
```

---

### Task 15: Fix frontend-design — cross-refs + reclassify as contextual

**Files:** `skills/frontend-design/SKILL.md`

**Step 1:** Fix cross-references. Replace:

```
**IMPORTANT**: Invoke `@react` before writing any TypeScript/React code.
```

With:

```
**IMPORTANT**: Load the `react` skill before writing any TypeScript/React code.
```

Replace:

```
**Invokes:** `@react` before writing any TypeScript/React code
```

With:

```
**Invokes:** `react` before writing any TypeScript/React code
```

**Step 2:** Add category metadata. After the `description` line in frontmatter, add:

```yaml
metadata:
  category: languages
```

(Categorized as `languages` because it's a contextual augmentation skill like `rails` augments `ruby` — loaded when doing frontend work, not a standalone workflow.)

**Step 3:** Commit:

```bash
git add skills/frontend-design/SKILL.md
git commit -m "fix(frontend-design): standardize refs, reclassify as contextual language skill"
```

---

### Task 16: Fix document-writing — add writing-clearly reference

**Files:** `skills/document-writing/SKILL.md`

**Step 1:** In the "## STYLE GUIDE" section, add after the "### Tone" subsection:

```markdown
For prose quality, apply the `writing-clearly-and-concisely` skill — active voice, positive form, concrete language, omit needless words.
```

**Step 2:** Add category metadata. Add to frontmatter:

```yaml
metadata:
  category: workflow
```

**Step 3:** Commit:

```bash
git add skills/document-writing/SKILL.md
git commit -m "fix(document-writing): reference writing-clearly skill, add category"
```

---

### Task 17: Fix issue-writing — add forward reference to pipeline

**Files:** `skills/issue-writing/SKILL.md`

**Step 1:** Add at the end, after "## Acceptance Criteria Patterns":

```markdown
## Implementation Pipeline

After issues are created and prioritized:

- Use the `writing-plans` skill to create an implementation plan from the issue
- Use the `executing-plans` skill to implement the plan task-by-task
- For issues that need design exploration first, use the `brainstorming` skill
```

**Step 2:** Add category metadata. Add to frontmatter:

```yaml
metadata:
  category: workflow
```

**Step 3:** Commit:

```bash
git add skills/issue-writing/SKILL.md
git commit -m "fix(issue-writing): add forward reference to implementation pipeline, add category"
```

---

## Phase 7: Categories for Remaining Skills

### Task 18: Add missing category metadata to all uncategorized skills

**Files:** 16 remaining skills without correct categories (after earlier tasks already handled `receiving-code-review`, `creating-pr`, `frontend-design`, `document-writing`, `issue-writing`)

Add `metadata.category` to frontmatter for each:

| Skill | Category | Notes |
|-------|----------|-------|
| `semantic-commit` | `workflow` | |
| `remove-slop` | `workflow` | |
| `branch-quiz` | `superpowers` | |
| `react` | `languages` | |
| `ast-grep` | `tools` | |
| `brave-search` | `tools` | |
| `buildkite-cli` | `tools` | |
| `fetch-ci-build` | `tools` | |
| `github` | `tools` | |
| `linear-cli` | `tools` | |
| `mermaid` | `tools` | |
| `notify` | `tools` | |
| `playwright-cli` | `tools` | |
| `sentry-issue` | `tools` | |
| `summarize` | `tools` | |
| `tmux` | `tools` | |

For skills that already have frontmatter but no `metadata` block, add:

```yaml
metadata:
  category: <category>
```

For skills that have a `metadata` block but no `category`, add the `category` line inside it.

**Step 1:** Edit all 16 files.

**Step 2:** Verify no skills are missing categories:

```bash
for d in skills/*/; do
  skill=$(basename "$d")
  if ! grep -q "category:" "$d/SKILL.md" 2>/dev/null; then
    echo "MISSING: $skill"
  fi
done
```

Expected: no output.

**Step 3:** Commit:

```bash
git add skills/*/SKILL.md
git commit -m "chore: add missing category metadata to all skills"
```

---

## Phase 8: Final Verification

### Task 19: Rebuild, install, and verify everything

**Step 1:** Build and install:

```bash
make install
```

Expected: all skills build and install without errors. `writing-clearly-and-concisely` included. `requesting-code-review` absent.

**Step 2:** Verify no stale cross-references:

```bash
rg "superpowers:|elements-of-style:|clean-commits|Skill\(" skills/*/SKILL.md
```

Expected: no matches.

**Step 3:** Verify no `@skill-name` references remain (excluding code examples):

```bash
rg "@remove-slop|@react|@verification-before|@requesting-code|@code-review" skills/*/SKILL.md
```

Expected: no matches.

**Step 4:** Verify funnel sections exist:

```bash
for skill in code-review refactoring systematic-debugging fetch-ci-build receiving-code-review qa-execute; do
  echo "=== $skill ==="
  rg -c "What Happens Next" "skills/$skill/SKILL.md"
done
```

Expected: each shows count ≥ 1.

**Step 5:** Verify requesting-code-review is gone:

```bash
test -d skills/requesting-code-review && echo "STILL EXISTS" || echo "DELETED"
test -d ~/.agents/skills/requesting-code-review && echo "STILL INSTALLED" || echo "CLEAN"
```

Expected: DELETED, CLEAN.

**Step 6:** Verify all skills have categories:

```bash
for d in skills/*/; do
  skill=$(basename "$d")
  if ! grep -q "category:" "$d/SKILL.md" 2>/dev/null; then
    echo "MISSING: $skill"
  fi
done
```

Expected: no output.

**Step 7:** Count installed skills:

```bash
ls ~/.agents/skills/ | wc -l
```

Expected: previous count (was 49) — net change: +1 (writing-clearly) −1 (requesting-code-review) = 49.

**Step 8:** Commit if any uncommitted changes from install:

```bash
git status --short
```

If clean, done. If changes, commit:

```bash
git add -A
git commit -m "chore: rebuild after skill coherence audit"
```
