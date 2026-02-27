---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
metadata:
  category: superpowers
---

# Requesting Code Review

Self-review your changes to catch issues before they cascade.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Review

**1. Get the diff:**
```bash
BASE_SHA=$(git merge-base HEAD origin/main)
git diff $BASE_SHA HEAD
```

**2. Apply the six-domain review:**

Review changes across these domains, flagging issues by severity (Critical/Important/Minor):

| Domain | What to Check |
|--------|--------------|
| Safety & Security | Input validation, auth, secrets, injection |
| Performance | N+1 queries, unnecessary allocations, missing indexes |
| Operations | Logging, error handling, monitoring, config |
| Testing | Coverage, edge cases, assertions, flaky patterns |
| Code Organization | Naming, duplication, abstraction level, coupling |
| Correctness | Logic errors, off-by-ones, race conditions |

**3. Act on findings:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later

## Integration with Workflows

**Executing Plans:**
- Review after each batch (3 tasks)
- Get feedback, apply, continue

**Ad-Hoc Development:**
- Review before merge
- Review when stuck

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
