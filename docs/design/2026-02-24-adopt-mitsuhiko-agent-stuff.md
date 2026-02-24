# Adopt Skills & Extensions from mitsuhiko/agent-stuff

**Date:** 2026-02-24
**Source:** https://github.com/mitsuhiko/agent-stuff (MIT license)
**Status:** Design complete

## Scope

### Skills → `dotagents/skills/`

| Skill | Action | Notes |
|-------|--------|-------|
| `tmux` | Adopt (copy with scripts) | Interactive CLI via keystroke sending + pane scraping |
| `mermaid` | Adopt (copy with scripts) | Diagram validation via mmdc CLI |
| `summarize` | Adopt (copy with scripts) | URL/PDF/DOCX→Markdown via `uvx markitdown` |
| `github` | Copy (SKILL.md only) | `gh` CLI reference patterns |
| `sentry-issue` | Fork (extend existing) | Merge event search, log search, issue listing into existing skill |

### Extensions → `bobcats/pi-extensions`

| Extension | Action | Notes |
|-----------|--------|-------|
| `notify.ts` | Adopt | OSC 777 desktop notification on turn end |
| `context.ts` | Adopt | `/context` TUI — loaded skills, extensions, token usage |
| `files.ts` | Adopt | `/files` git-aware file browser with reveal/open/edit/diff |
| `session-breakdown.ts` | Adopt | `/session-breakdown` usage analytics with calendar graph |

### Deferred (separate tasks)

| Item | Reason |
|------|--------|
| `review.ts` | Needs more significant rework to integrate with existing code-review skill |
| `loop.ts` | Needs evaluation against current workflow before adopting |
| `prompt-editor.ts` | Needs evaluation of mode-switching UX |

### Skipped

Skills: `commit` (have semantic-commit), `frontend-design` (have own), `web-browser` (have playwright-cli), `native-web-search` (have brave-search), `uv`, `update-changelog`, `openscad`, `ghidra`, `anachb`, `oebb-scotty`, `apple-mail`, `google-workspace`.

Extensions: `todos.ts` (use beads), `uv.ts`, `go-to-bed.ts`, `whimsical.ts`, `answer.ts`, `control.ts`.

Other: `nightowl.json` theme, `make-release.md` plumbing, `intercepted-commands/`.

## Implementation

### Skills

**tmux, mermaid, summarize:** Copy each skill directory (SKILL.md + tools/scripts) into `dotagents/skills/`. Audit and fix:
- Replace any absolute paths with relative (`./tools/`, `./scripts/`)
- Remove references to `~/Development/agent-stuff/`
- Document runtime prerequisites in SKILL.md (e.g. `uvx markitdown` for summarize, `npx @mermaid-js/mermaid-cli` for mermaid, `tmux` for tmux)

**github:** Copy SKILL.md only. No scripts.

**sentry-issue (fork):**
1. Copy mitsuhiko's `sentry/scripts/` (JS tools: `search-events.js`, `list-issues.js`, `fetch-issue.js`, `fetch-event.js`, `search-logs.js`) into existing `sentry-issue` skill directory
2. Merge new capabilities into existing SKILL.md — keep current URL→stacktrace workflow as "Quick Start", add sections for event search, log search, issue listing
3. Preserve existing auth approach (`sentry-cli` first, curl fallback)

Build system: No changes needed — `make install` already copies skill directories with all files to `~/.agents/skills/`.

### Extensions

All four go into `bobcats/pi-extensions` as new directories alongside existing extensions.

For each extension:
1. Create directory in `bobcats/pi-extensions` (e.g. `notify/index.ts`)
2. Adapt imports to match package structure (peer deps on `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@mariozechner/pi-ai`)
3. Register in `package.json` under `pi.extensions` array
4. Test that the extension loads without errors

No changes to `dotagents` build system — extensions live in `bobcats/pi-extensions`.

### Attribution

Every forked/copied file includes provenance.

**Extensions** — header comment:
```typescript
/**
 * Forked from: https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/<file>.ts
 * Original author: Armin Ronacher (mitsuhiko)
 * License: MIT
 */
```

**Skills** — `origin` field in SKILL.md frontmatter:
```yaml
---
name: tmux
description: "..."
origin: https://github.com/mitsuhiko/agent-stuff/blob/main/skills/tmux/SKILL.md
---
```
