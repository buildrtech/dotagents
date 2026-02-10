---
name: beads-create
description: Create and maintain beads issues with correct `br` CLI commands, flags, and dependency wiring.
---

# beads-create

Apply `@issue-writing` first, then execute beads CLI commands.

## Activation

- About to run `br create`
- Updating issue fields with `br update`
- Linking hierarchy/dependencies with `br dep add`

## Core Commands

### Create Issue

```bash
br create "[title]" \
  --type [epic|feature|task|bug] \
  --priority [0-4] \
  --description "[why this exists]"
```

Common optional flags:
- `--design "..."`
- `--labels "frontend,backend,security"`
- `--external-ref "gh-123"`
- `--assignee "name"`

### Update Issue

```bash
br update <id> --acceptance-criteria "[criteria]"
br update <id> --notes "[implementation notes]"
br update <id> --description "[updated rationale]"
```

### Add Dependencies / Hierarchy

```bash
br dep add <child-id> <parent-id> --type parent-child
```

Use parent-child links to build epic → feature → task → subtask structure.

## CLI Workflow

1. Draft issue content using `@issue-writing`.
2. Run `br create` and save returned ID.
3. Run `br update` for acceptance criteria/notes as needed.
4. Run `br dep add` to wire hierarchy.

## Verification

After running commands, confirm:
- [ ] Issue ID captured
- [ ] `br create` succeeded with correct type/priority
- [ ] Required updates applied via `br update`
- [ ] Parent/child links created with `br dep add`
