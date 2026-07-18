---
name: cadence-loop-status
description: Reads cadence/loops/<id>/state.json and renders the current phase, status, and full iteration history in the terminal.
argument-hint: "<id>"
user-invocable: false
---

# Loop Status

<important>
Read-only. Never modify state.json or any other file while running this skill.
</important>

## Process

### 1. Parse the id

Read the loop id from `$ARGUMENTS`. If empty, tell the user that a loop id is required (e.g. `L-1721000000`) and stop.

### 2. Locate and read state.json

Determine the project root: use `CLAUDE_PROJECT_DIR` if set, otherwise `process.cwd()`.

```js
const { readState } = require('<pluginRoot>/scripts/loop-state.js');
const state = readState(id, projectRoot);
```

If the file does not exist (readState throws), tell the user:
> No loop state found for `<id>`. Check the id or run `/cadence:loop-start` to start a new loop.

### 3. Render the header

```
Loop <id>
  Goal:          <goal>
  Success:       <success>
  Mode:          <mode>
  Max iterations: <maxIterations>
  Status:        <status>
  Started:       <startedAt>
  Finished:      <finishedAt or "—">
  Current phase: <phase or "—">
  Iteration:     <iteration> / <maxIterations>
```

### 4. Render the iteration history

If `state.history` is empty, print: `No iterations recorded yet.`

Otherwise, for each entry in `state.history` in order:

```
[Iteration <N> · <phase>]  <timestamp>
  Observation: <observation or "—">
  Decision:    <decision or "—">
```

Group entries by iteration number with a blank line between iteration groups for readability. Within an iteration, print ACT → OBSERVE → EVALUATE → DECIDE in the order they appear in the history array.

### 5. Render the status footer

| Status                  | Message                                              |
|-------------------------|------------------------------------------------------|
| `running`               | Loop is active. Use `/cadence:loop-status <id>` again to refresh. |
| `success`               | Loop completed successfully after <N> iteration(s). |
| `max_iterations_reached`| Loop reached the <maxIterations>-iteration cap without meeting the success condition. |
| `error`                 | Loop ended with an unrecoverable error. See iteration <last N> DECIDE observation for the diagnosis. |
