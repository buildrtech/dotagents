# beads extension

Runtime extension for Pi that adds deterministic beads operations and interactive workflow helpers.

## Purpose

Provide extension-level execution UX for beads while keeping planning/reasoning in skills.

- Deterministic `beads` tool actions backed by `br`
- Interactive `/beads` issue picker + quick actions
- Practical wrapper commands for common operations
- Runtime hook guardrails (mode display, priming, close guard, context reminder)

## Commands

- `/beads` — interactive picker for ready issues (optional filter argument)
- `/beads-ready` — run `br ready --sort priority`
- `/beads-status` — show `br stats`, `br blocked`, `br list --status in_progress`
- `/beads-claim <id>` — mark issue `in_progress`
- `/beads-close <id>` — prompt for close reason and close issue
- `/beads-reset-reminder` — reset one-time context reminder flag

## Hooks included

- `session_start`: detect beads project mode and publish `beads-mode` status line (mode, total issues, current in-progress issue)
- `session_before_compact`: re-arm one-time beads priming
- `before_agent_start`: inject hidden `beads-prime` message with beads guardrails
- `tool_call`: block `br close` if git working tree is dirty
- `turn_end`: show one-time high-context reminder at 85%+

## Extension-vs-skill boundary

This extension handles deterministic runtime mechanics.

Reasoning and writing quality remain in skills:

- Use `@issue-writing` to produce high-quality issue content and decomposition
- Use `@beads-create` to apply beads CLI workflow conventions and dependencies

In short: extension executes; skills reason.

## Local run / reload

Auto-load location:

- `~/.pi/agent/extensions/beads -> /Users/brian/code/buildrtech/dotagents/extensions/beads`

After edits in a running Pi session, run:

- `/reload`

Quick smoke test (using auto-loaded extension):

```bash
pi --mode print -p "Show beads status"
```
