---
name: executing-plans
description: Use when you have a written implementation plan to execute
metadata:
  category: superpowers
---

# Executing Plans

## Overview

Load plan, review critically, execute all tasks, verify completion.

**Core principle:** Continuous execution, stop only on blockers.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If clear: Proceed to execution

### Step 2: Execute All Tasks

Work through `- [ ]` items **one at a time, sequentially**:
1. Pick the next unchecked `- [ ]` item
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Check it off in the plan file (`- [ ]` → `- [x]`) before moving on
5. Commit at stable checkpoint when the item closes (do not accumulate big-bang changes)
   - Use the `semantic-commit` skill for commit messages
6. If blocked: Stop and ask for help (don't guess)
   - If blocked by a bug: use the `systematic-debugging` skill, then return to this task
7. Continue to next item

**Hard gate:** Do NOT start the next `- [ ]` item until the current one is checked off. One item, verified, checked off, then next. No batching, no parallelizing, no "I'll check these off together at the end."

### Step 3: Complete

After all tasks:
- Use the `verification-before-completion` skill for final checks
- If the plan included documentation tasks, use the `document-writing` skill (with `writing-clearly-and-concisely` for prose quality)
- Summarize completed work and verification output

## When to Stop and Ask for Help

**STOP executing when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has gaps preventing progress
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Stop when blocked, don't guess
