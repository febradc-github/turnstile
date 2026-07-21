---
name: turnstile-loop-start
description: Starts a goal-directed loop run -- asks for mode, initialises state.json, then dispatches loop-runner repeatedly until the success condition is met, max-iterations is reached, or an unrecoverable error occurs.
argument-hint: "goal=\"...\" success=\"...\" [max-iterations=N]"
user-invocable: false
---

# Loop Start

<important>
- Never invoke `loop-runner` except from this skill. No other skill or user message should dispatch it directly.
- Never write or edit source files from this skill. ACT-phase code changes are always delegated to `turnstile-coder` via `loop-runner`.
- Prior-run brain notes are queried here and passed to loop-runner as context.
- Visual console rendering is out of scope; that is handled by C-4.
</important>

## Process

### 1. Parse arguments

From `$ARGUMENTS`, extract:
- `goal` (required) -- what the loop is trying to accomplish.
- `success` (required) -- the observable condition that marks the loop done.
- `max-iterations` (optional, default 3) -- hard cap; must be a positive integer.

If `goal` or `success` is missing, tell the user the required arguments and stop.

Validate `max-iterations`: if present and not a positive integer, tell the user and stop.

### 2. Determine mode

Ask the user:

> Run in loop mode?
> [y] autonomous -- iterations run uninterrupted until done
> [n] manual -- you confirm each DECIDE before the loop advances

Wait for the user's reply. Accept `y`/`yes`/`Y` as **autonomous** and `n`/`no`/`N` as **manual**. Any other input: re-ask once, then stop with an explanation.

### 3. Generate a loop id

Construct an id of the form `L-<timestamp>` where `<timestamp>` is the current Unix timestamp in seconds (e.g. `L-1721000000`). This id must be unique per run.

### 4. Initialise state

Determine the project root: use `CLAUDE_PROJECT_DIR` if set, otherwise `process.cwd()`.

Run:
```js
const { initState } = require('<pluginRoot>/scripts/loop-state.js');
initState(id, goal, success, maxIterations, mode, projectRoot);
```

Tell the user:
> Loop `<id>` initialised. Goal: <goal>. Success: <success>. Max iterations: <N>. Mode: <mode>.
> State file: turnstile/loops/<id>/state.json

### 5. Query prior brain notes

Use the `search_notes` MCP tool to find any brain notes from previous runs that match the current goal string:

```
search_notes(query: goal)
```

If matching notes are returned, collect them as `priorContext`. On the first dispatch of `loop-runner` (iteration 1), include `priorContext` in the prompt so the runner has background from earlier runs. If no notes match, `priorContext` is empty and no change is made to the first dispatch.

### 6. Run iterations

Loop from `iteration = 1` to `maxIterations` (inclusive):

a. Dispatch `loop-runner` with:
   - `id`, `iteration`, `goal`, `success`, `maxIterations`, `mode`, `projectRoot`
   - The full prior history from `readState(id, projectRoot).history` so the runner has context.

b. Inspect the runner's report:
   - If decision is `success`: call `finalizeLoop(id, 'success', projectRoot)`, tell the user the loop succeeded, and stop.
   - If decision is `error`: call `finalizeLoop(id, 'error', projectRoot)`, tell the user the loop ended with an error (include the runner's diagnosis), and stop.
   - If decision is `continue` and `iteration == maxIterations`: call `finalizeLoop(id, 'max_iterations_reached', projectRoot)`, tell the user the iteration cap was reached, and stop.
   - If decision is `continue` and `iteration < maxIterations`: increment iteration and continue.
   - If decision is `max_iterations_reached`: call `finalizeLoop(id, 'max_iterations_reached', projectRoot)` and stop. (Runner may emit this directly when it detects the cap.)

**Autonomous mode:** execute steps a-b without pausing between iterations.

**Manual mode:** after each DECIDE the runner has already asked the user for confirmation before writing the entry. Between iterations (after DECIDE, before the next ACT), ask:
> Iteration <N> complete. Decision: <decision>. Continue to iteration <N+1>? [y/n]
If the user says `n`, call `finalizeLoop(id, 'success', projectRoot)` (treating user abort as a clean stop) and report what was accomplished.

### 7. Final report

After the loop ends, tell the user:
- The terminal status (`success` | `max_iterations_reached` | `error`).
- How many iterations ran.
- A one-sentence summary of what was accomplished.
- That `/turnstile:loop-status <id>` can be used to inspect the full history.
