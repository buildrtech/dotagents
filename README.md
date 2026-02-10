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

### Methodology

| Skill | Description |
|-------|-------------|
| `brainstorming` | Explore intent and options before implementation |
| `writing-plans` | Create execution-ready implementation plans |
| `executing-plans` | Execute plan tasks continuously and report blockers |
| `dispatching-parallel-agents` | Split independent work across parallel agents |

### Quality

| Skill | Description |
|-------|-------------|
| `test-driven-development` | Test-first development with strict red-green-refactor |
| `systematic-debugging` | Root-cause debugging workflow before fixes |
| `verification-before-completion` | Fresh verification evidence before completion claims |
| `receiving-code-review` | Evaluate review feedback rigorously before changes |
| `requesting-code-review` | Request structured review before merge/progression |
| `code-review` | Six-domain review framework with P0–P4 severities |
| `semantic-commit` | Conventional Commit workflow with hygiene gates |
| `remove-slop` | Remove debug noise, TODOs, and incomplete artifacts |
| `refactoring` | Multi-language refactoring audit and prioritization |

### Frontend / Docs / Prompting

| Skill | Description |
|-------|-------------|
| `react` | React-specific component/event/wrapper conventions |
| `frontend-design` | Information-dense, professional B2B UI guidance |
| `document-writing` | Verification-first technical documentation writing |
| `prompt-writing` | Anthropic-oriented prompt and skill authoring patterns |

### Planning / Issue Management

| Skill | Description |
|-------|-------------|
| `issue-writing` | Universal user-story and acceptance-criteria issue design |
| `beads-create` | beads CLI workflow (`br create`, `br update`, `br dep add`) |

### CI / Build

| Skill | Description |
|-------|-------------|
| `fetch-ci-build` | Fetch CI build results and diagnose failures across CI providers |

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
