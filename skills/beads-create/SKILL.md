---
name: beads-create
description: Create a single beads issue with proper format, quality checks, and granular breakdown
---

# beads-create

Ensures each beads issue meets quality standards. Invoke this skill BEFORE every `br create` call.

## Activation

- About to run `br create`
- Called from beads-plan or beads-init commands
- Adding a new issue mid-implementation

## The Hierarchy

```
Epic (project goal)
└── Feature (user story - value statement)
    └── Task (implementation step)
        └── Subtask (smaller step)
            └── ... (as deep as useful)
```

**Features and tasks are fundamentally different:**

| Aspect | Feature (User Story) | Task |
|--------|---------------------|------|
| **Focus** | User value | Technical implementation |
| **Language** | Business/user terms | Code/technical terms |
| **Question** | "What can users do?" | "What code do we write?" |
| **Scope** | Deliverable capability | Atomic work unit |
| **Nesting** | Only under epics | **Infinite depth** under features |

## Process

### Step 1: Determine Type

| Type | Purpose |
|------|---------|
| epic | Project container |
| feature | User capability (**USER STORY FORMAT REQUIRED**) |
| task | Technical implementation step |
| bug | Defect to fix |

### Step 2: Craft Title

#### type=feature (STRICT FORMAT)

Features describe **value to users**, not implementation. Use Mike Cohn's format:

```
"As a [type of user], I want [some goal], so that [some reason]."
```

**Acceptable variants:**
- `"As a [role], I want [goal], so that [benefit]"` - Full format (preferred)
- `"As a [role], I can [action]"` - Shorter when benefit is obvious
- `"[Role] can [action] so that [benefit]"` - Variant

**Good features:**
- "As a job seeker, I can post my resume so that employers can find me"
- "As a customer, I want to track my order so I can know when to expect delivery"
- "As a language learner, I want offline mode so I can study during my commute"

**Bad features (REJECT THESE):**
- ~~"Add OAuth integration"~~ → Technical task, not user value
- ~~"As a database, I want to upgrade"~~ → System-as-user anti-pattern
- ~~"User can register, log in, and manage profile"~~ → Multiple actions (split it)
- ~~"As a user, I want better performance"~~ → Vague, unmeasurable
- ~~"Implement dropdown with options A, B, C"~~ → Solution-focused, prescriptive

#### type=task (Technical Language)

Tasks describe **what code to write**. They're technical and can nest infinitely.

**Task characteristics:**
- Technical language (endpoints, components, functions)
- Completable in 15-60 minutes (or break down further)
- Clear what files/code change
- Can have subtasks for complex work

**Good tasks:**
- "Create POST /api/users route"
- "Add password hashing with bcrypt"
- "Write integration tests for auth flow"

#### type=epic

Project or initiative name:
- "User Authentication System"
- "Q1 Performance Improvements"

### Step 3: Break Down Tasks (Critical)

**When to create subtasks:**
- Task would take >60 minutes
- Task has distinct phases
- Task touches multiple systems
- You need progress tracking within the task

**Example of task nesting:**

```
Feature: User can log in with Google
├── Task: Set up OAuth infrastructure
│   ├── Subtask: Add Google OAuth credentials to config
│   ├── Subtask: Install passport-google-oauth20
│   └── Subtask: Configure OAuth middleware
├── Task: Create login UI
│   ├── Subtask: Add "Sign in with Google" button component
│   └── Subtask: Wire button to OAuth redirect
└── Task: Handle OAuth callback
    ├── Subtask: Create callback route
    ├── Subtask: Exchange code for tokens
    └── Subtask: Create/update user record
```

**Philosophy: Granular is better.** Projects can have 200+ tasks. This volume is a forcing function—it prevents the "one-shotting" failure mode where agents declare victory after implementing a few things. A task that turns out trivial closes quickly. A missing task leads to incomplete features.

### Step 4: Quality Check (Features Only)

Before creating a feature, verify it passes **INVEST**:

| Criterion | Question | Fix if No |
|-----------|----------|-----------|
| **I**ndependent | Can it be implemented in any order? | Remove dependencies or split |
| **N**egotiable | Are details open to discussion? | Remove implementation prescriptions |
| **V**aluable | Does it deliver user/business value? | Reframe from user perspective |
| **E**stimable | Can the team size it? | Clarify scope or spike first |
| **S**mall | Fits in one sprint (3-4 days work)? | Split into smaller stories |
| **T**estable | Can you write acceptance criteria? | Make it more specific |

**The 3 C's (Ron Jeffries):** Every user story is a *Card* (brief description), a *Conversation* (discussion to elaborate), and *Confirmation* (acceptance tests). The written story is a placeholder for future conversation.

### Step 5: Add Required Fields

| Field | Flag | When to Use |
|-------|------|-------------|
| `--description` | `-d` | **Always.** Explain WHY this issue exists. |
| acceptance criteria | | **Required for features.** Include in description or add after creation via `br update <id> --acceptance-criteria "..."` |
| `--design` | | Architecture decisions, trade-offs. Valuable for features. |
| `--labels` | `-l` | Categorize: `frontend`, `backend`, `security`, `tech-debt` |
| `--external-ref` | | Link to GitHub/Jira/Linear: `gh-123`, `JIRA-456` |
| `--assignee` | `-a` | Who's responsible. Useful for team projects. |

**Runtime fields** (added during implementation, not creation):
- **--notes**: Findings, gotchas, context discovered while working. Update via `br update <id> --notes "..."`
- **comments**: Threaded discussion and checkpoints. Add via `br comments add <id> "..."`

**Acceptance criteria formats:**

*Scenario format* (simple):
```
- [ ] User receives tracking number via email after purchase
- [ ] Tracking page shows current status (processing, shipped, delivered)
- [ ] Page updates when carrier provides new information
```

*Given-When-Then* (BDD, more precise):
```
- [ ] Given I'm logged in, when I submit an order, then I receive a confirmation email
- [ ] Given I have a tracking number, when I visit /track, then I see my order status
```

### Step 6: Set Priority

| Priority | Meaning |
|----------|---------|
| 0 | Critical / Must have |
| 1 | High / Should have |
| 2 | Medium / Nice to have |
| 3 | Low / Could have |
| 4 | Backlog |

### Step 7: Execute

```bash
br create "[title]" \
  --type [epic|feature|task|bug] \
  --priority [0-4] \
  --description "[why this exists]"
# For features, add acceptance criteria after creation:
br update <id> --acceptance-criteria "[done criteria]"
```

**Save the returned ID** - you'll need it for hierarchy setup.

## Examples

<examples>
<example>
<type>feature with full fields</type>
<output>
```bash
br create "As a returning user, I can log in with Google so I don't need another password" \
  --type feature \
  --priority 1 \
  --description "Users have requested social login to avoid password fatigue. Currently only email/password auth exists." \
  --design "Using passport.js for OAuth. Considered Auth0 but adds external dependency. Sessions stored in Redis." \
  --labels "security,backend,mvp" \
  --external-ref "gh-42"
```
</output>
</example>

<example>
<type>task</type>
<output>
```bash
br create "Create POST /api/auth/google/callback route" \
  --type task \
  --priority 2 \
  --description "Handles OAuth callback from Google, exchanges code for tokens, creates/updates user record"
```
</output>
</example>

<example>
<type>subtask under a task</type>
<output>
```bash
br create "Add email validation to registration endpoint" \
  --type task \
  --priority 2 \
  --description "Validate email format and check for existing accounts before creating user"
# Returns: app-s04
br dep add app-s04 app-t02 --type parent-child
```
</output>
</example>

<example>
<type>epic</type>
<output>
```bash
br create "User Authentication System" \
  --type epic \
  --priority 0 \
  --description "Enable users to create accounts and log in. Foundation for all personalized features."
```
</output>
</example>
</examples>

## Verification

After `br create`, confirm:
- [ ] ID saved for hierarchy linking
- [ ] Title follows format rules for type
- [ ] Description explains WHY
- [ ] Acceptance criteria are testable (features)
- [ ] Task is small enough (15-60 min) or has subtasks planned

## When Uncertain

**If unsure about anything, ASK the user rather than guessing.** Common uncertainties:
- Is this a feature (user value) or task (technical work)?
- Should this be one issue or split into multiple?
- What priority should this have?
- What acceptance criteria make sense?

A quick clarifying question prevents creating issues that need to be revised later.
