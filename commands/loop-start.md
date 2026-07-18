---
description: Starts a goal-directed loop run. Asks for autonomous or manual mode, initialises loop state, and dispatches loop-runner repeatedly until the success condition is met, the iteration cap is reached, or an unrecoverable error occurs.
argument-hint: "goal=\"...\" success=\"...\" [max-iterations=N]"
disable-model-invocation: true
---

Use the Skill tool to invoke the `cadence-loop-start` skill, passing `$ARGUMENTS` and the rest of this message unchanged.
