---
name: compound-learnings
description: Capture lessons learned during a coding session and write them to docs/learnings/ for future use. Auto-invoke after completing features, fixing bugs, finishing designs, or when the user asks to capture learnings.
---

# Compound Learnings

Reflect on the current coding session, extract lessons learned, and write them to `docs/learnings/` at the repository root so they compound into future sessions.

## When to Trigger

- **Manual**: User asks to capture lessons, "what did we learn?", or invokes directly
- **Suggested by other skills**: After milestones in brainstorming, debugging, code review, or verification

## Process

### 1. Review the Session

Scan the conversation for:
- Bugs encountered and how they were fixed
- Patterns that were established or discovered
- Commands, tools, or approaches that were figured out
- Mistakes that were made and corrected
- Architectural decisions and their rationale
- Trade-offs that were evaluated

### 2. Draft Entries

For each finding, write a concise, actionable entry:

```
## [YYYY-MM-DD] Short title
Context: what was happening
Lesson: what was learned or what to do/avoid next time
```

Every entry must be something an agent can act on in a future session — "do this" or "avoid that" — not a narrative of what happened. Be concise.

### 3. Read Existing Files

Before writing, read the existing files in `docs/learnings/`. This avoids duplicates. If an existing entry covers the same ground, update it rather than add a new one. Remove entries that are outdated or superseded.

### 4. Write to the Appropriate File

Append new entries to the appropriate topic file in `docs/learnings/`:

| File | Contents |
|------|----------|
| `bugs-and-gotchas.md` | Things that broke, surprising behavior, footguns to avoid |
| `patterns.md` | Code patterns, conventions, architectural decisions that worked |
| `workflow.md` | Useful commands, test strategies, deployment steps, tool tips |

Create the `docs/learnings/` directory and files if they don't exist yet.

### 5. Update the Index

`docs/learnings/README.md` is the index file. It contains:
- One-line pointers to each topic file
- The top 5-10 most impactful lessons surfaced directly (not duplicated in topic files, just referenced)

Keep the index under 50 lines. When it grows beyond that, consolidate.

### 6. Summarize to the User

Show what was captured in a brief list so they can correct, remove, or add anything before finalizing.

## Entry Guidelines

- **Concise and actionable** — not session logs
- **Date every entry** — helps with staleness review
- **One lesson per entry** — don't bundle unrelated things
- **Include enough context** — a future agent reading this cold should understand why it matters
- **Consolidate over time** — when updating, merge related entries and remove outdated ones

## Common Mistakes

- **Don't write vague lessons.** "Be careful with the database" is useless. "Always use SSM port forwarding for RDS data transfer, not ecs exec piping" is actionable.
- **Don't capture everything.** Only write down things that would save time or prevent mistakes in future sessions. Routine work isn't a lesson.
- **Don't duplicate.** Read existing files first. Update entries rather than adding near-duplicates.
- **Don't write novels.** 2-4 lines per entry. If it needs more, it's probably two lessons.
