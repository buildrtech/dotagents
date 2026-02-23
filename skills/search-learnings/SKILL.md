---
name: search-learnings
description: Search past learnings before starting work. Auto-invoke before implementing features, fixing bugs, debugging, making architectural decisions, or any task where past lessons could prevent mistakes or save time.
agents:
  - claude
  - codex
  - pi
---

# Search Learnings

Use the `learnings` CLI to semantically search the `docs/learnings/` knowledge base before starting work.

## When to Trigger

- **Before starting any non-trivial task**: implementing features, fixing bugs, debugging, refactoring, making architectural decisions, configuring infrastructure
- **When a topic feels familiar**: if the problem, tool, or pattern has likely been encountered before, search first
- **Manual**: user asks "have we seen this before?", "what do we know about X?", or invokes directly
- **Suggested by other skills**: before brainstorming, debugging, or writing plans — check what's already known

The default should be to search. Only skip for trivially simple tasks (typo fixes, one-line changes) where past learnings clearly can't help.

## Process

### 1. Formulate Multiple Queries

For every search, formulate 3-5 variations of the query. Different phrasings surface different results. The CLI accepts multiple queries in a single call and returns the best match per entry across all of them.

| Task | Queries to use |
|------|---------------|
| Fixing a Docker build issue | `"docker build caching" "dockerfile layer optimization" "container image build speed" "docker COPY cache invalidation"` |
| Setting up ECS exec | `"ecs execute command" "ecs exec interactive" "aws ecs remote shell" "ssm ecs container"` |
| Changing git workflow | `"git rebase workflow" "merge vs rebase" "git branch strategy" "pull request merge approach"` |

Think about: synonyms, related tools, the underlying problem, and the specific technology.

### 2. Run the Search

Pass all query variations in a single call:

```bash
learnings search "query one" "query two" "query three"
```

Use `-n` to control result count if needed (default is 5):

```bash
learnings search "query one" "query two" "query three" -n 3
```

### 3. Interpret Results

- **Results found**: Briefly summarize relevant learnings and explain how they apply to the current task. Adjust your approach based on what was learned previously.
- **No results**: Move on. Don't belabor it — just note that no prior learnings were found and proceed.
- **Multiple results**: Highlight the most relevant one, briefly mention others.

### 4. Apply to Current Work

Incorporate found learnings into your approach. If a past lesson says "always use SSM port forwarding instead of ecs exec", follow that guidance rather than rediscovering it the hard way.

## Common Mistakes

- **Don't skip searching.** The whole point is to check before starting. It takes seconds and can save significant time.
- **Don't use overly broad queries.** "programming" won't help. Be specific to the topic at hand.
- **Don't block on no results.** If nothing comes back, just proceed normally.
- **Don't forget the CLI needs `docs/learnings/` in the repo.** If the directory doesn't exist, skip silently — not every repo will have learnings yet.
