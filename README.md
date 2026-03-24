# dotagents

Skills for AI coding agents.

## Quick Start

```bash
make install
```

## Install Paths

| Agent | Skills Path |
|-------|-------------|
| Claude Code | `~/.claude/skills/` |
| OpenCode, Pi, Codex | `~/.agents/skills/` |

## Skill Catalog

### Superpowers — core process skills

| Skill | Description |
|-------|-------------|
| `brainstorming` | Explore intent and design before implementation |
| `writing-plans` | Create bite-sized implementation plans |
| `executing-plans` | Execute plan tasks one-by-one, stop on blockers |
| `test-driven-development` | Red-green-refactor, no exceptions |
| `systematic-debugging` | Root-cause investigation before fixes |
| `verification-before-completion` | Fresh evidence before completion claims |
| `code-review` | Six-domain review (P0–P4) + self-review workflow |
| `receiving-code-review` | Evaluate feedback rigorously before changes |
| `refactoring` | Multi-language refactoring audit and prioritization |
| `branch-quiz` | Quiz user on branch changes to verify comprehension |

### Workflow — supporting process steps

| Skill | Description |
|-------|-------------|
| `semantic-commit` | Conventional Commits with pre-commit hygiene |
| `remove-slop` | Strip AI-generated code noise |
| `creating-pr` | Open PRs with preflight checks and safe body-file usage |
| `document-writing` | Verification-driven technical documentation |
| `issue-writing` | User stories with INVEST and testable acceptance criteria |

### Languages — loaded contextually during code work

| Skill | Description |
|-------|-------------|
| `typescript` | Type safety policies, idiomatic patterns |
| `react` | Component contracts, events, hooks, TanStack/Formik |
| `frontend-design` | Information-dense B2B interfaces |
| `ruby` | Idiomatic Ruby patterns and detection |
| `rails` | Rails-specific patterns, eager loading, migrations |
| `sorbet` | Sorbet type safety, T::Struct, sealed modules |
| `python` | Modern Python (3.12+), dataclasses, async |
| `go` | Error handling, interfaces, concurrency |
| `rust` | Ownership, error handling, iterators |
| `sql` | Query patterns, index guidelines |
| `postgres` | PostgreSQL indexes, safe DDL, JSONB |

### Tools — external CLI wrappers

| Skill | Description |
|-------|-------------|
| `github` | GitHub via `gh` CLI — PRs, issues, runs, API |
| `linear-cli` | Linear issues, projects, cycles via `linear-cli` |
| `brave-search` | Web search and content extraction via Brave API |
| `summarize` | Convert URLs/PDFs/docs to Markdown via `markitdown` |
| `ast-grep` | Structural code search and bulk AST rewriting |
| `mermaid` | Validate and render Mermaid diagrams |
| `playwright-cli` | Browser automation for testing and data extraction |
| `tmux` | Remote-control tmux sessions for interactive CLIs |
| `notify` | Desktop notifications via OSC 777 |
| `buildkite-cli` | Buildkite pipelines, builds, agents via `bk` |
| `fetch-ci-build` | Diagnose CI failures across GitHub Actions, Buildkite, CircleCI |
| `sentry-issue` | Investigate Sentry errors, events, and logs |

### QA — manual-only chain

| Skill | Description |
|-------|-------------|
| `qa-brainstorm` | Explore app and build QA strategy |
| `qa-plan` | Generate executable test cases from strategy |
| `qa-execute` | Run test plan via playwright-cli |

### External — from plugins.toml

| Skill | Source | Description |
|-------|--------|-------------|
| `shaping` | rjs/shaping-skills | Shape Up methodology |
| `breadboarding` | rjs/shaping-skills | Workflow → affordance tables |
| `breadboard-reflection` | rjs/shaping-skills | Reflect on breadboard vs implementation |
| `framing-doc` | rjs/shaping-skills | Framing doc from transcripts |
| `kickoff-doc` | rjs/shaping-skills | Kickoff doc from transcripts |
| `writing-clearly-and-concisely` | obra/the-elements-of-style | Strunk's rules for clear prose |

## Beads Extension (runtime)

- Runtime entry: `extensions/beads/index.ts`
- Provides deterministic beads tool execution plus interactive `/beads` command wrappers
- Includes hook behavior for mode status, priming, dirty-close guard, and context reminders
- Extension-vs-skill split: runtime mechanics live in extension, reasoning remains in `@issue-writing`

## Commands

| Command | Description |
|---------|-------------|
| `make install` | Build and install skills for all agents |
| `make build` | Build skills to `build/` without installing |
| `make install-skills` | Install skills only |
| `make clean` | Remove all installed artifacts |
| `make help` | Show all available commands |

## Adding Skills

1. Create `skills/<skill-name>/SKILL.md` with YAML frontmatter
2. Add supporting files to the same directory
3. Run `make install`

See [Agent Skills specification](https://agentskills.io/specification.md) for format details.

## Requirements

- Python 3.11+
