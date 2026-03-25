# AGENTS.md

This file provides guidance for AI assistants working with this codebase.

## Project Overview

This repository manages reusable skills and extensions for AI coding agents, with Pi as the primary target.

## Repository Structure

```
dotagents/
├── skills/                   # Custom skills
│   └── <skill-name>/
│       ├── SKILL.md          # Skill definition (YAML frontmatter + markdown)
│       └── <additional files>
├── pi-extensions/            # Pi extensions
│   ├── <extension>.ts        # Single-file extensions
│   └── <extension>/          # Directory extensions (with index.ts)
├── configs/
│   └── AGENTS.md             # Global AGENTS.md installed for non-pi targets
├── scripts/
│   └── build.py              # Python build system (requires Python 3.11+)
├── install.toml              # Installation configuration
├── build/                    # Generated during build (gitignored)
├── Makefile                  # Build automation
└── README.md                 # User documentation
```

## Install Paths

| Target | Skills | Extensions |
|--------|--------|------------|
| Pi | `~/.pi/agent/skills/` | `~/.pi/agent/extensions/` |
| Claude Code | `~/.claude/skills/` | — |
| OpenCode | `~/.agents/skills/` | — |
| Codex | `~/.agents/skills/` | — |

## Key Concepts

### Skills
Skills follow the [Agent Skills specification](https://agentskills.io/specification.md). When creating or modifying skills, fetch the latest specification for current format requirements.

### Extensions
Extensions are Pi-specific TypeScript modules. Single `.ts` files or directories with `index.ts`.

### Configuration
`install.toml` controls targets, exclusions, and frontmatter overrides. See the file for documentation.

## Development Workflow

### Common Commands
| Command | Description |
|---------|-------------|
| `make install` | Preview what would be installed (default) |
| `make install overwrite` | Install, overwriting conflicts |
| `make install wipe` | Wipe destinations, then install |
| `make build` | Build to `build/` without installing |
| `make clean` | Remove dotagents items from destinations |

## Code Conventions

### Skills (SKILL.md)
- Follow the [Agent Skills specification](https://agentskills.io/specification.md)
- Include workflow diagrams (graphviz dot format) for complex processes
- Document prerequisites, step-by-step processes, and common mistakes

### Skill Scripts (Python)
Use [uv inline script metadata](https://docs.astral.sh/uv/guides/scripts/) for dependency management.

## Adding New Content

### Adding a Custom Skill
1. Fetch the [Agent Skills specification](https://agentskills.io/specification.md)
2. Create `skills/<skill-name>/SKILL.md` following the specification
3. Add any supporting files to the same directory
4. Run `make install overwrite`

### Adding a Pi Extension
1. Add a `.ts` file or directory with `index.ts` to `pi-extensions/`
2. Run `make install overwrite`
