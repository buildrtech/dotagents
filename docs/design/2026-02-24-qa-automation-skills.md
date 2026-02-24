# QA Automation Skills Design

> Three-skill cycle for fully automated E2E testing with playwright-cli, mirroring the brainstorming → writing-plans → executing-plans workflow.

## Skills

| Skill | Purpose | Output |
|-------|---------|--------|
| `qa-brainstorm` | Discover what to test via hybrid interactive + autonomous exploration | `docs/qa/strategy/YYYY-MM-DD-<feature>.md` |
| `qa-plan` | Generate structured, executable test cases from strategy | `docs/qa/plans/YYYY-MM-DD-<feature>.md` |
| `qa-execute` | Run tests with playwright-cli, track progress, report results | `docs/qa/results/YYYY-MM-DD-<feature>.md` |

## Design Decisions

- **Artifact location:** `docs/qa/{strategy,plans,results}/`
- **Credentials:** Strategy doc records the source method (env vars / 1Password / fixtures / ask-each-time). Executor resolves at runtime.
- **Failure mode:** Configurable via `on_failure: stop | continue` in strategy doc (default: continue). When `stop`, executor halts on first failure and asks user. When `continue`, runs all tests and reports at end. Dependencies of failed tests are skipped either way.
- **Progress tracking:** Plan files use `- [ ]` / `- [x]` checkboxes updated in-place during execution.

## qa-brainstorm

1. Ask essentials (2-3 questions): app URL, credential source, scope
2. Autonomous exploration: open app with playwright-cli, snapshot pages, discover routes/elements
3. Present findings & validate: discovered pages, proposed suites, priority ordering
4. Save strategy doc, hand off to qa-plan

## qa-plan

1. Load strategy doc
2. Generate test cases per suite (preconditions, steps, assertions, cleanup)
3. Add dependency ordering between tests
4. Validate with user suite-by-suite
5. Save plan doc with checkboxes, hand off to qa-execute

## qa-execute

1. Load plan, parse config/suites/dependencies
2. Open browser, resolve credentials, verify app running
3. Execute tests in dependency order — snapshot before every action
4. Update plan checkboxes in-place (✅/❌/⏭️)
5. Write results doc with summary, per-test details, screenshots
6. Close browser, report to user
