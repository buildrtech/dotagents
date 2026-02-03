# AGENTS.md

This file provides guidance for AI assistants working with this codebase.

## Project Overview

This repository manages reusable skills for AI coding agents including:
- **Claude Code** (Anthropic)
- **Pi Coding Agent** (badlogic)
- **Codex CLI** (OpenAI)
- **Amp** (Sourcegraph)

Skills are specialized instruction sets that guide AI agents through specific tasks.

## Repository Structure

```
dotagents/
├── plugins.toml                    # Plugin configuration (external skill sources)
├── plugins/                        # Git submodules (skill sources)
├── skills/                         # Custom skills (local)
│   └── <skill-name>/
│       ├── SKILL.md                # Skill definition (YAML frontmatter + markdown)
│       └── <additional files>      # Supporting scripts/resources
├── skill-overrides/                # Agent-specific appends
│   └── <skill>-<agent>.md          # Appended to SKILL.md during build
├── configs/                        # Agent configurations
│   └── AGENTS.md                   # Global AGENTS.md for agents
├── scripts/
│   └── build.py                    # Python build system (requires Python 3.11+)
├── build/                          # Generated during build (gitignored)
├── docs/
│   ├── plans/                      # Implementation plans
│   └── design/                     # Design documents
├── Makefile                        # Build automation
└── README.md                       # User documentation
```

## Key Concepts

### Skills
Skills follow the [Agent Skills specification](https://agentskills.io/specification.md). When creating or modifying skills, fetch the latest specification for current format requirements.

### Skill Overrides
Files in `skill-overrides/<skill>-<agent>.md` are **appended** to the skill's SKILL.md during build. This allows agent-specific customizations.

## Development Workflow

### Setup
```bash
make install
```

### Common Commands
| Command | Description |
|---------|-------------|
| `make install` | Build and install skills for all agents |
| `make build` | Build skills to `build/` without installing |
| `make install-skills` | Install skills only |
| `make clean` | Remove all installed artifacts |

## Code Conventions

### Skills (SKILL.md)
- Follow the [Agent Skills specification](https://agentskills.io/specification.md)
- Include workflow diagrams (graphviz dot format) for complex processes
- Document prerequisites, step-by-step processes, and common mistakes
- Use the `agents` frontmatter field to limit which agents receive a skill

### Skill Scripts (Python)
Use [uv inline script metadata](https://docs.astral.sh/uv/guides/scripts/) for dependency management.

## Installation Locations

| Agent | Skills |
|-------|--------|
| Amp | `~/.config/agents/skills/` |
| Claude Code | `~/.claude/skills/` |
| Codex CLI | `~/.codex/skills/` |
| Pi Agent | `~/.pi/agent/skills/` |

## Adding New Content

### Adding a Custom Skill
1. Fetch the [Agent Skills specification](https://agentskills.io/specification.md)
2. Create `skills/<skill-name>/SKILL.md` following the specification
3. Add any supporting files to the same directory
4. Run `make install` to build and install

### Adding a Plugin
1. Add submodule: `git submodule add <url> plugins/<owner>-<repo>`
2. Add plugin configuration to `plugins.toml`
3. Run `make install`
