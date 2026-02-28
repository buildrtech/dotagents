# Prune Skills Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans skill to implement this plan task-by-task.

**Goal:** Reduce skill count from 37 auto-loaded descriptions in system prompt to 26 by removing 2 skills, hiding 10 from auto-discovery, and improving 3 descriptions.

**Architecture:** Modify SKILL.md frontmatter to add `disable-model-invocation: true` for manual-only skills, delete removed skills, and update descriptions. For external skills (shaping, breadboarding, breadboard-reflection), add a frontmatter override mechanism to build.py so we don't have to fork the upstream repo or maintain full local copies.

**Tech Stack:** Python (build.py), Markdown (SKILL.md files), TOML (config)

---

### Task 1: Remove `prompt-writing` skill

**Files:**
- Delete: `skills/prompt-writing/` (entire directory)

**Step 1: Delete the skill directory**

```bash
rm -rf skills/prompt-writing
```

**Step 2: Verify it's gone**

```bash
test ! -d skills/prompt-writing && echo "removed" || echo "STILL EXISTS"
```

**Step 3: Commit**

```bash
git add -A skills/prompt-writing
git commit -m "chore: remove prompt-writing skill"
```

---

### Task 2: Remove `mcporter` skill

**Files:**
- Delete: `skills/mcporter/` (entire directory)

**Step 1: Delete the skill directory**

```bash
rm -rf skills/mcporter
```

**Step 2: Verify it's gone**

```bash
test ! -d skills/mcporter && echo "removed" || echo "STILL EXISTS"
```

**Step 3: Commit**

```bash
git add -A skills/mcporter
git commit -m "chore: remove mcporter skill"
```

---

### Task 3: Add `disable-model-invocation: true` to local manual-only skills

These 7 local skills should be hidden from the system prompt but still available via `/skill:name`:

- `sentry-issue`
- `fetch-ci-build`
- `buildkite-cli`
- `qa-brainstorm`
- `qa-plan`
- `qa-execute`
- `branch-quiz`

**Files:**
- Modify: `skills/sentry-issue/SKILL.md` (frontmatter)
- Modify: `skills/fetch-ci-build/SKILL.md` (frontmatter)
- Modify: `skills/buildkite-cli/SKILL.md` (frontmatter)
- Modify: `skills/qa-brainstorm/SKILL.md` (frontmatter)
- Modify: `skills/qa-plan/SKILL.md` (frontmatter)
- Modify: `skills/qa-execute/SKILL.md` (frontmatter)
- Modify: `skills/branch-quiz/SKILL.md` (frontmatter)

**Step 1: Add `disable-model-invocation: true` to each skill's frontmatter**

For each file, add the line `disable-model-invocation: true` after the `description:` field (or after any other frontmatter fields, before the closing `---`).

Example — `skills/sentry-issue/SKILL.md` before:
```yaml
---
name: sentry-issue
description: "Fetch and analyze Sentry issues..."
origin: https://github.com/...
---
```

After:
```yaml
---
name: sentry-issue
description: "Fetch and analyze Sentry issues..."
origin: https://github.com/...
disable-model-invocation: true
---
```

Apply the same pattern to all 7 files.

**Step 2: Verify frontmatter is valid**

```bash
for skill in sentry-issue fetch-ci-build buildkite-cli qa-brainstorm qa-plan qa-execute branch-quiz; do
  echo "=== $skill ==="
  head -20 "skills/$skill/SKILL.md"
  echo ""
done
```

Check: each file has `disable-model-invocation: true` inside the `---` fences.

**Step 3: Commit**

```bash
git add skills/sentry-issue/SKILL.md skills/fetch-ci-build/SKILL.md skills/buildkite-cli/SKILL.md skills/qa-brainstorm/SKILL.md skills/qa-plan/SKILL.md skills/qa-execute/SKILL.md skills/branch-quiz/SKILL.md
git commit -m "chore: hide 7 skills from auto-discovery

Set disable-model-invocation: true on sentry-issue, fetch-ci-build,
buildkite-cli, qa-brainstorm, qa-plan, qa-execute, branch-quiz.

These are still available via /skill:name but won't appear in the
system prompt."
```

---

### Task 4: Add frontmatter override support to build.py for external skills

The 3 external skills from `rjs/shaping-skills` need `disable-model-invocation: true` but we can't modify them upstream. Add a lightweight override mechanism.

**Files:**
- Create: `skill-overrides.toml`
- Modify: `scripts/build.py`

**Step 1: Create `skill-overrides.toml`**

```toml
# skill-overrides.toml - Frontmatter overrides applied during build
#
# Keys are skill names (after aliasing). Values are frontmatter fields
# to add or replace. These are applied after ensure_frontmatter().

[shaping]
disable-model-invocation = true

[breadboarding]
disable-model-invocation = true

[breadboard-reflection]
disable-model-invocation = true
```

**Step 2: Add override logic to build.py**

Add a function `load_skill_overrides()` that reads `skill-overrides.toml` and returns a dict of `{skill_name: {field: value}}`.

Add a function `apply_frontmatter_overrides(content: str, overrides: dict) -> str` that inserts or replaces frontmatter fields.

Call it in `build_skill()` after `ensure_frontmatter()`.

```python
SKILL_OVERRIDES_FILE = ROOT / "skill-overrides.toml"

def load_skill_overrides() -> dict[str, dict]:
    """Load per-skill frontmatter overrides from skill-overrides.toml."""
    if not SKILL_OVERRIDES_FILE.exists():
        return {}
    with open(SKILL_OVERRIDES_FILE, "rb") as f:
        return tomllib.load(f)


def apply_frontmatter_overrides(content: str, overrides: dict[str, str]) -> str:
    """Add or replace frontmatter fields based on overrides dict."""
    import re

    if not overrides:
        return content

    frontmatter_pattern = r"^---\s*\n(.*?)\n---"
    match = re.match(frontmatter_pattern, content, re.DOTALL)
    if not match:
        return content

    frontmatter = match.group(1)

    for key, value in overrides.items():
        # Normalize key for YAML (toml uses dashes, yaml uses dashes too, should be fine)
        if isinstance(value, bool):
            yaml_value = "true" if value else "false"
        else:
            yaml_value = str(value)

        field_pattern = rf"^{re.escape(key)}:\s*.*$"
        if re.search(field_pattern, frontmatter, re.MULTILINE):
            frontmatter = re.sub(
                field_pattern, f"{key}: {yaml_value}", frontmatter, flags=re.MULTILINE
            )
        else:
            frontmatter += f"\n{key}: {yaml_value}"

    return content[: match.start(1)] + frontmatter + content[match.end(1) :]
```

Modify `build_skill()` to accept and apply overrides:

```python
def build_skill(name: str, source: Path, overrides: dict[str, dict] | None = None) -> bool:
    # ... existing code ...
    skill_content = ensure_frontmatter(raw_content, name)

    # Apply per-skill frontmatter overrides
    if overrides and name in overrides:
        skill_content = apply_frontmatter_overrides(skill_content, overrides[name])

    (dest / "SKILL.md").write_text(skill_content)
    # ... rest of existing code ...
```

Update `build_skills()` to load and pass overrides:

```python
def build_skills(plugins: dict[str, Plugin], clones: dict[str, Path]) -> None:
    # ... existing setup code ...
    overrides = load_skill_overrides()

    # Plugin skills first
    for plugin in plugins.values():
        # ...
        if build_skill(name, path, overrides):
        # ...

    # Local skills
    # ...
        if build_skill(name, skill_dir, overrides):
        # ...
```

**Step 3: Run tests — verify build still works**

```bash
make build
```

Expected: builds successfully, prints all skill names.

**Step 4: Verify overrides were applied**

```bash
for skill in shaping breadboarding breadboard-reflection; do
  echo "=== $skill ==="
  head -10 "build/skills/$skill/SKILL.md"
  echo ""
done
```

Check: each file has `disable-model-invocation: true` in frontmatter.

**Step 5: Commit**

```bash
git add skill-overrides.toml scripts/build.py
git commit -m "feat: add frontmatter override support for external skills

Adds skill-overrides.toml to inject/replace frontmatter fields on
external skills during build. Used to set disable-model-invocation
on shaping, breadboarding, breadboard-reflection."
```

---

### Task 5: Improve skill descriptions

**Files:**
- Modify: `skills/linear-cli/SKILL.md` (description)
- Modify: `skills/ast-grep/SKILL.md` (description)
- Modify: `skills/notify/SKILL.md` (description)

**Step 1: Update `linear-cli` description**

Current (too broad — "issue tracking, or task management" could false-positive):
```
Manage Linear issues, projects, teams, and cycles from the terminal using the linear-cli tool. Use when the user mentions Linear tickets, issue tracking, or task management.
```

New:
```
Manage Linear issues, projects, teams, and cycles using the linear-cli tool. Use when the user mentions Linear, linear-cli, or references Linear issue identifiers like ENG-123.
```

**Step 2: Update `ast-grep` description**

Current (too long, repetitive — 425 chars):
```
Guide for writing ast-grep rules to perform structural code search and analysis. Use when users need to search codebases using Abstract Syntax Tree (AST) patterns, find specific code structures, or perform complex code queries that go beyond simple text search. This skill should be used when users ask to search for code patterns, find specific language constructs, or locate code with particular structural characteristics.
```

New:
```
Write ast-grep rules for structural code search using AST patterns. Use when the user needs to find code by structure rather than text — specific language constructs, pattern matching across files, or queries that grep can't express.
```

**Step 3: Update `notify` description**

Current (vague trigger — when is "long-running"?):
```
Send desktop notifications via OSC 777 when long-running work completes.
```

New:
```
Send desktop notifications via OSC 777. Use when the user asks to be notified on completion, or after finishing multi-step plans, large refactors, or long builds the user may have walked away from.
```

**Step 4: Verify descriptions**

```bash
for skill in linear-cli ast-grep notify; do
  echo "=== $skill ==="
  awk '/^---$/{n++; next} n==1{print} n==2{exit}' "skills/$skill/SKILL.md" | grep "description:"
  echo ""
done
```

**Step 5: Commit**

```bash
git add skills/linear-cli/SKILL.md skills/ast-grep/SKILL.md skills/notify/SKILL.md
git commit -m "docs: improve skill descriptions for linear-cli, ast-grep, notify

- linear-cli: narrow trigger to Linear-specific terms
- ast-grep: shorten from 425 to ~200 chars, remove repetition
- notify: clarify when to trigger (user request or likely walked away)"
```

---

### Task 6: Build, install, and verify

**Step 1: Full build and install**

```bash
make install
```

Expected: builds all skills, installs to `~/.claude/skills` and `~/.agents/skills`.

**Step 2: Verify removals**

```bash
test ! -d ~/.agents/skills/prompt-writing && echo "prompt-writing: removed ✓" || echo "FAIL"
test ! -d ~/.agents/skills/mcporter && echo "mcporter: removed ✓" || echo "FAIL"
```

**Step 3: Verify hidden skills have `disable-model-invocation: true`**

```bash
for skill in sentry-issue fetch-ci-build buildkite-cli qa-brainstorm qa-plan qa-execute branch-quiz shaping breadboarding breadboard-reflection; do
  if grep -q "disable-model-invocation: true" ~/.agents/skills/$skill/SKILL.md 2>/dev/null; then
    echo "$skill: hidden ✓"
  else
    echo "$skill: FAIL — missing disable-model-invocation"
  fi
done
```

**Step 4: Verify auto-loaded skills do NOT have the flag**

```bash
for skill in systematic-debugging verification-before-completion test-driven-development semantic-commit code-review brainstorming writing-plans executing-plans brave-search playwright-cli linear-cli ast-grep notify; do
  if grep -q "disable-model-invocation: true" ~/.agents/skills/$skill/SKILL.md 2>/dev/null; then
    echo "$skill: FAIL — should NOT be hidden"
  else
    echo "$skill: auto-loaded ✓"
  fi
done
```

**Step 5: Verify updated descriptions**

```bash
for skill in linear-cli ast-grep notify; do
  echo "=== $skill ==="
  awk '/^---$/{n++; next} n==1{print} n==2{exit}' ~/.agents/skills/$skill/SKILL.md | grep "description:"
  echo ""
done
```

**Step 6: Count installed skills**

```bash
echo "Total skills: $(ls -d ~/.agents/skills/*/ | wc -l | tr -d ' ')"
echo "Auto-loaded (no disable-model-invocation):"
count=0
for d in ~/.agents/skills/*/; do
  if ! grep -q "disable-model-invocation: true" "$d/SKILL.md" 2>/dev/null; then
    count=$((count + 1))
  fi
done
echo "  $count skills in system prompt"
```

Expected: 35 total skills, 25 auto-loaded in system prompt (down from 37).

**Step 7: Commit (if any build artifacts changed)**

Only if `make install` changed something unexpected. Otherwise this is just verification.
