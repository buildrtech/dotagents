---
name: prompt-writing
description: Write system prompts, agent definitions, slash commands, and skills following Anthropic's best practices.
---

# Prompt Writing

Guides creation of clear, structured, and effective prompts for Claude Code environments following Anthropic's best practices.

## Activation

- User requests a new agent definition (AGENT.md)
- User requests a system prompt for API usage or CLAUDE.md
- User requests a slash command (.md in commands/)
- User requests a skill definition (.md in skills/)
- User requests tool/MCP prompt descriptions
- User asks for help improving an existing prompt

## Outputs

This skill produces:
- **Agent definitions** (AGENT.md files for subagents)
- **System prompts** (for API usage or CLAUDE.md instructions)
- **Slash commands** (.md files in commands/)
- **Skills** (.md files in skills/)
- **Tool/MCP prompts** (descriptions and usage patterns)

## Core Principles

### 1. Be Clear and Direct

Write prompts as if briefing a brilliant new employee with no context. Include:
- **Purpose**: What the task results will be used for
- **Audience**: Who consumes the output
- **Success criteria**: What "done well" looks like

Bad: "Analyze the code"
Good: "You are reviewing a pull request for security vulnerabilities. Flag issues by severity (Critical/High/Medium/Low). Output a markdown checklist the author can address directly."

### 2. Use XML Tags for Structure

Separate distinct sections with semantic tags:

```xml
<context>
Background information goes here
</context>

<instructions>
1. First step
2. Second step
</instructions>

<output_format>
Describe expected output structure
</output_format>

<examples>
<example>
Input: ...
Output: ...
</example>
</examples>
```

### 3. Provide Examples (Few-Shot)

Include 2-5 diverse examples showing:
- Expected input format
- Correct output format
- Edge cases

Wrap in `<example>` tags. Variety prevents overfitting to patterns.

### 4. Chain of Thought When Needed

For complex reasoning tasks, structure thinking:

```
Think step-by-step in <thinking> tags:
1. Identify the core problem
2. List constraints
3. Evaluate approaches
4. Select and justify

Then provide your answer in <answer> tags.
```

Reserve CoT for tasks humans would think through. Skip for simple tasks.

### 5. Assign Clear Roles

Use roles to shape expertise and tone:

Bad: "Help with code review"
Good: "You are a senior security engineer at a fintech company reviewing code for PCI-DSS compliance."

Specific roles produce specific expertise.

### 6. Long Context Placement

For prompts with large inputs:
- Place documents/data FIRST (at top)
- Put instructions and queries AFTER
- Use indexed document tags for multiple sources

```xml
<documents>
  <document index="1">
    <source>file.ts</source>
    <content>{{CODE}}</content>
  </document>
</documents>

Now analyze the above for...
```

## Templates

### Agent Definition (AGENT.md)

```markdown
---
name: agent-name
description: One-line description for tool selection (shown to parent agent)
tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Edit, Write
model: sonnet|opus|haiku
---

# AGENT IDENTITY

Clear statement of what this agent is and does.

## Context

When/why this agent gets invoked. What it can assume about the request.

## Capabilities

Bulleted list of specific tasks this agent handles.

## Decision Framework

How the agent should prioritize and make choices.

## Tool Usage

When to use each tool. What to try first vs. escalate to.

## Output Format

Structure of responses. Use XML tags for parseable sections.

## Constraints

What the agent must NOT do. Hard limits.

## Examples

<examples>
<example>
<request>User asks for X</request>
<response>Agent responds with Y</response>
</example>
</examples>
```

### Slash Command (commands/*.md)

```markdown
# Command: /command-name

Brief description of what this command does.

## When to Use

Describe the trigger conditions.

## Instructions

$ARGUMENTS (if any)

<instructions>
Step-by-step what Claude should do when this command runs.
</instructions>

## Output

What the user should expect to see.
```

### Skill (skills/*.md)

```markdown
---
name: skill-name
description: One-line description of what this skill does
---

# Skill Name

One paragraph describing the skill's purpose and when it activates.

## Activation

- Trigger condition 1
- Trigger condition 2

## Process

<instructions>
1. First step
2. Second step
</instructions>

## Verification

How to confirm the skill was applied correctly.
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why It Fails | Fix |
|--------------|--------------|-----|
| Vague instructions | Claude fills gaps with assumptions | Be explicit about every expectation |
| Wall of text | Buried instructions get missed | Use XML tags and numbered lists |
| No examples | Format ambiguity | Provide 2-3 diverse examples |
| Conflicting rules | Unpredictable behavior | Prioritize rules explicitly |
| Overly long | Dilutes focus | Trim to essentials, add depth only where needed |
| Kitchen sink | Too many goals = mediocre at all | One primary objective per prompt |

## Writing Process

When writing a prompt:

1. **Clarify the goal**: What should Claude do? For whom? What's success?
2. **Identify the format**: Agent? Command? Skill? API system prompt?
3. **Draft structure**: XML skeleton with sections
4. **Write core instructions**: Clear, sequential, specific
5. **Add examples**: 2-3 showing input/output pairs
6. **Add constraints**: What NOT to do
7. **Review for**: Clarity, completeness, conciseness

## Response Format

When delivering a prompt, structure as:

```markdown
## Summary
What this prompt does in 1-2 sentences.

## The Prompt
\`\`\`markdown
[Full prompt content]
\`\`\`

## Usage Notes
- When to use
- Key customization points ({{VARIABLES}})
- Expected behavior
```

## Verification

- Every prompt should be immediately usable with no unexplained placeholders
- Test: "If I were Claude reading this for the first time, would I know exactly what to do?"
- Shorter is better when sufficient; longer when depth is required
- Prompts go into production. Write like it matters.

## Examples

<examples>
<example>
<request>I need a prompt that analyzes customer feedback and removes PII.</request>
<response>
## Summary

A prompt for anonymizing customer feedback data while preserving the content's meaning.

## The Prompt

```markdown
Your task is to anonymize customer feedback for our quarterly review.

Instructions:
1. Replace all customer names with "CUSTOMER_[ID]" (e.g., "Jane Doe" → "CUSTOMER_001").
2. Replace email addresses with "EMAIL_[ID]@example.com".
3. Redact phone numbers as "PHONE_[ID]".
4. If a message mentions a specific product (e.g., "AcmeCloud"), leave it intact.
5. If no PII is found, copy the message verbatim.
6. Output only the processed messages, separated by "---".

Data to process: {{FEEDBACK_DATA}}
```

## Usage Notes

- The numbered instructions ensure consistent anonymization across all entries
- Product names are preserved because they're relevant context, not PII
- The separator format makes output easy to parse programmatically
</response>
</example>

<example>
<request>Write a prompt for analyzing a legal contract for risks.</request>
<response>
## Summary

A structured legal analysis prompt using XML tags to organize input and output.

## The Prompt

```markdown
Analyze this software licensing agreement for legal risks and liabilities.

We're a multinational enterprise considering this agreement for our core data infrastructure.

<agreement>
{{CONTRACT}}
</agreement>

This is our standard contract for reference:
<standard_contract>
{{STANDARD_CONTRACT}}
</standard_contract>

<instructions>
1. Analyze these clauses:
   - Indemnification
   - Limitation of liability
   - IP ownership

2. Note unusual or concerning terms.

3. Compare to our standard contract.

4. Summarize findings in <findings> tags.

5. List actionable recommendations in <recommendations> tags.
</instructions>
```

## Usage Notes

- XML tags (`<agreement>`, `<standard_contract>`) clearly delineate document boundaries
- Instructing Claude to use `<findings>` and `<recommendations>` tags in output makes parsing easy
- Reference to "our standard contract" grounds the analysis in organizational context
</response>
</example>
</examples>
