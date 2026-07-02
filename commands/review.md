---
description: Dispatches the independent cadence-reviewer agent to verify a ticket is actually done. On pass, commits the change. Gate 2 of the cadence workflow -- the implementer never self-certifies.
argument-hint: "[id]"
disable-model-invocation: true
---

Use the Skill tool to invoke the `cadence-review` skill, passing `$ARGUMENTS` and the rest of this message unchanged.
