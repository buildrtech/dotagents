# dotagents

Skills and extensions for AI coding agents. Pi-first.

## Quick Start

```bash
# Preview what would be installed
make install

# Install (overwriting any conflicts at destinations)
make install overwrite
```

## Configuration

All configuration lives in `install.toml`:

```toml
# Which agent harnesses to install to
targets = ["pi"]              # Options: "pi", "claude", "opencode", "codex"

# Skills to skip
exclude = ["branch-quiz"]

# Extensions to skip
exclude-extensions = []

# Frontmatter overrides (modify skill metadata without editing SKILL.md)
[overrides.some-skill]
disable-model-invocation = true
```

## Install Paths

| Target | Skills | Extensions |
|--------|--------|------------|
| Pi | `~/.pi/agent/skills/` | `~/.pi/agent/extensions/` |
| Claude Code | `~/.claude/skills/` | — |
| OpenCode | `~/.agents/skills/` | — |
| Codex | `~/.agents/skills/` | — |

## Commands

| Command | Description |
|---------|-------------|
| `make install` | Preview what would be installed (default) |
| `make install overwrite` | Install, overwriting conflicts |
| `make install wipe` | Wipe destinations first, then install |
| `make build` | Build to `build/` without installing |
| `make clean` | Remove dotagents items from destinations |

## Skills

| Skill | Description |
|-------|-------------|
| `brainstorming` | Explore ideas before implementation through collaborative dialogue |
| `writing-plans` | Create detailed implementation plans with bite-sized tasks |
| `executing-plans` | Execute plans task-by-task with verification |
| `test-driven-development` | Write tests first, watch them fail, implement minimally |
| `systematic-debugging` | Find root cause before attempting fixes |
| `verification-before-completion` | Evidence before claims, always |
| `dispatching-parallel-agents` | Run multiple independent investigations concurrently |
| `receiving-code-review` | Technical rigor when implementing feedback |
| `requesting-code-review` | Verify work meets requirements before merging |
| `semantic-commit` | Conventional commits for clear history |
| `ast-grep` | Structural code search and AST-based rule authoring |
| `fetch-ci-build` | Fetch CI build results and diagnose failures across CI providers |

## Adding Skills

1. Create `skills/<skill-name>/SKILL.md` with YAML frontmatter
2. Add supporting files to the same directory
3. Run `make install overwrite`

See [Agent Skills specification](https://agentskills.io/specification.md) for format details.

## Adding Extensions

1. Add a `.ts` file or directory with `index.ts` to `pi-extensions/`
2. Run `make install overwrite`

Extensions are pi-only. See [pi extensions docs](https://github.com/badlogic/pi-mono) for details.

## Repository Structure

```
dotagents/
├── skills/                   # Skill definitions (SKILL.md + supporting files)
├── pi-extensions/            # Pi extensions (.ts files or directories)
├── configs/
│   └── AGENTS.md             # Global AGENTS.md for non-pi targets
├── scripts/
│   └── build.py              # Build and install system
├── install.toml              # Installation configuration
├── build/                    # Generated during build (gitignored)
├── Makefile                  # Build automation
└── README.md
```

## Requirements

- Python 3.11+
