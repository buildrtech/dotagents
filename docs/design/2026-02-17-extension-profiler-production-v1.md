# Extension Profiler Production V1 Design

## Summary

This design evolves `extensions/ext-prof-spike` into a production-ready extension profiler while preserving the spike’s core approach: runtime attribution by extension path without modifying target extensions.

### Agreed priorities
1. Performance safety
2. Measurement quality
3. Operational value
4. Compatibility hardening

### Agreed constraints/decisions
- Overhead target: **<=1%** (goal; warning only if exceeded)
- Activation: **opt-in** (`/ext-prof on`)
- Coverage: **events + commands + tools**
- Fidelity: **capture every call**
- Output: **verbose by default** for `/ext-prof`
- Storage: **in-memory live aggregates + manual persisted snapshot**
- Snapshot format: **JSONL**
- Default snapshot path: `~/.pi/profiles/<project>/<timestamp>.jsonl`
- Integration approach: **keep internal monkey-patching for v1**

## Production approach chosen

### Recommended architecture: aggregate-first full detail (no per-call history)

Use lightweight in-memory aggregate counters keyed by `(extensionPath, surface, name)` instead of retaining raw call samples.

Why:
- Best chance to satisfy strict overhead target
- Prevents unbounded memory growth
- Still supports high-detail attribution across handlers

Trade-off:
- No forensic per-invocation timeline in v1
- But all needed runtime summaries are preserved

## Runtime architecture

Split implementation into focused modules:

1. **patcher**
   - Resolves and imports Pi internal runner module
   - Patches runner/prototypes once (global symbol guard)
   - Wraps event/command/tool handlers with idempotent marker

2. **collector**
   - Maintains aggregate maps
   - Provides O(1) update methods for hot path

3. **commands**
   - `/ext-prof` (verbose report)
   - `/ext-prof on`
   - `/ext-prof off`
   - `/ext-prof reset`
   - `/ext-prof save [path]`
   - `/ext-prof status`

4. **formatter**
   - Sorts and renders extension-first verbose breakdown
   - Includes patch and overhead status lines

5. **persistence**
   - Manual snapshot writer for JSONL
   - Best-effort directory creation and atomic save behavior

### Lifecycle
- Extension loads inactive
- `/ext-prof on` enables collection and performs patching
- Wrappers remain installed/idempotent; collection toggles via enabled flag
- `/ext-prof off` disables data updates (no unpatch churn)

## Data model

### In-memory structures
- `extensionTotals: Map<extensionPath, ExtensionAggregate>`
- `handlerTotals: Map<compositeKey, HandlerAggregate>`
  - `compositeKey = extensionPath + '\u001f' + surface + '\u001f' + name`
- `unknownExtensionKey = "<unknown-extension>"` fallback bucket when extension identity cannot be resolved

### Cardinality guardrails
- Cap distinct handler aggregates (default: `10_000` keys)
- When cap is reached, continue updating existing keys but skip creating new keys
- Emit one warning per session when new keys are dropped due to cap

### Aggregate fields
- `calls: number`
- `totalMs: number`
- `maxMs: number`
- `errorCount: number`

### Hot path behavior (per invocation)
1. Capture start timestamp using `performance.now()`
2. Invoke original handler and `await` if it returns a Promise
3. In `finally`, compute duration with `performance.now()` and update both maps
4. Increment `errorCount` when invocation throws, then rethrow unchanged
5. Do not use shared mutable "current handler" state; each invocation tracks its own timestamps

No per-call objects or arrays are retained after aggregation.

## Command/output behavior

### `/ext-prof`
- Default: verbose report
- Shows:
  - extension totals (`totalMs`, `calls`, `avgMs`, `maxMs`, `errorCount`)
  - nested handler rows by surface/name
  - patch status (`patched`/failure reason)
  - overhead status line with warning when budget goal is exceeded

### `/ext-prof status`
- Enabled/disabled state
- Patch state
- Per-surface coverage status with explicit flags:
  - `events: instrumented|missing`
  - `commands: instrumented|missing`
  - `tools: instrumented|missing`
- If a surface is missing, report it as "coverage unavailable" rather than implying zero runtime

### `/ext-prof save [path]`
- Manual save only
- Default path: `~/.pi/profiles/<project>/<timestamp>.jsonl`

## Overhead measurement methodology

To make the `<=1%` target measurable, overhead reporting uses a documented benchmark comparison.

### Definition
- `overheadPct = ((profiledDurationMs - baselineDurationMs) / baselineDurationMs) * 100`

### Procedure
1. Run a repeatable synthetic workload fixture with profiler disabled (`baseline`)
2. Run the same workload with profiler enabled (`profiled`)
3. Compare median runtime across multiple repetitions (e.g., 20 runs)
4. Report measured overhead in `/ext-prof` and in test output

### Enforcement policy
- V1 remains warning-only at runtime (no auto-stop/auto-degrade)
- CI can run this benchmark as an advisory check and surface warning when above target

## Snapshot format (JSONL)

Write newline-delimited records:

1. `session_meta`
   - `schemaVersion: 1`
   - project identifier
   - process/session metadata
   - config (enabled state, coverage flags, overhead target)
   - patch status and save timestamp

2. `aggregate`
   - one record per handler aggregate with extension/surface/name and metrics
   - optional extension-level aggregate records for faster downstream ingestion

## Error handling and safety

- Patching failure must not break normal extension behavior
- Profiler reports inactive/failure state via `/ext-prof` and session warning
- Wrapper must preserve return values and thrown errors
- Wrapper timing must include full async execution time (awaited handlers)
- Unknown extension identities are attributed to `<unknown-extension>` and warned once per session
- Profiler internal failures are isolated and surfaced as warnings only
- Idempotence required for both global patch and wrapped handlers

## Compatibility posture (v1)

Given the v1 speed goal, internal monkey-patch remains acceptable. Capability checks are still required to:
- detect whether command/tool hook points are present
- report partial coverage when only some surfaces are instrumented

## Testing strategy

1. **Unit tests**
   - aggregation math and sorting
   - formatter correctness and verbose layout
   - command argument parsing

2. **Wrapper tests**
   - idempotence
   - success/failure timing
   - async timing correctness (duration includes awaited Promise work)
   - exception propagation

3. **Integration tests**
   - synthetic slow event/command/tool fixtures
   - correct attribution by extension path and handler name
   - partial-coverage status correctness when a surface cannot be instrumented
   - unchanged behavior of wrapped handlers

4. **Performance checks**
   - baseline vs enabled comparisons in repeatable scenarios
   - overhead calculation correctness (`(profiled - baseline) / baseline`)
   - overhead telemetry validation and warning behavior

## Non-goals for v1

- Auto-degrade or auto-stop on overhead breach
- Continuous streaming persistence
- Retention policy management
- Percentiles/turn-share analytics
- Per-invocation raw trace storage
- Warm-up/JIT exclusion controls (for example, ignoring first N calls)

## Rollout notes

- Start behind opt-in commands only
- Validate across common extension mixes
- Track known internal API assumptions in README/design docs
- Reassess stable hook migration after v1 learning
