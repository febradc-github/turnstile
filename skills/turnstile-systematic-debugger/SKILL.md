---
name: turnstile-systematic-debugger
description: Debugging methodology -- reproduce, gather evidence, hypothesize, root-cause, fix, verify -- works on any bug report. Dispatched by /turnstile:systematic-debugger or conversate routing only.
argument-hint: "[bug description]"
user-invocable: false
---

# Systematic Debugger

<important>
- Never guess a fix before forming and testing a hypothesis about the root cause. A fix that isn't traced to a cause is a coincidence, not a fix.
- Search the vault (brain, decisions, architecture) for related notes before investigating -- the same root cause may already be documented.
- Never write the fix yourself. Fixes of any size are dispatched to the turnstile-coder agent; the only inline edits are temporary diagnostic instrumentation, reverted before finishing.
- In a turnstile project, a confirmed bug becomes tracked work: related to the current in_progress item -> fix it now under that ticket; unrelated -> create a bug task via turnstile-quick that runs right after the in_progress item finishes. Only fix-and-forget (no ticket) outside a turnstile board. This is what gets bug fixes reviewed and committed instead of stranded as uncommitted changes.
</important>

## Process

1. Search the vault for notes related to the bug's topic or symptoms ($ARGUMENTS). Surface anything relevant, including a prior note documenting this exact cause.
2. Reproduce the bug. If it can't be reproduced, gather evidence (error messages, logs, exact steps tried) -- and if none is available, tell the user what's needed before continuing. Never guess at a fix for a bug that hasn't been observed.
3. Gather evidence: the relevant code paths, recent changes (`git log`/`git diff`), error output in full.
4. Form one specific, falsifiable hypothesis about the root cause.
5. Test it with the cheapest check available (targeted log, minimal reproduction, reading the exact line) before writing any fix. Wrong hypothesis: discard it and form a new one from the evidence -- never patch around a disproven hypothesis "just in case".
6. Once the root cause is confirmed, route the fix:
   - **Related to the in_progress item** (the bug lives in that ticket's scope -- same feature or files): the fix is part of that ticket. Dispatch `turnstile-coder` with the confirmed root cause, reproduction steps, and intended minimal fix; the fix rides that ticket's diff into `/turnstile:review`. Append to the item's `notes`: `debug: <one-line root cause and fix>`.
   - **Unrelated (or nothing in_progress), turnstile board present:** do not fix it under someone else's diff. Invoke `turnstile-quick` with the bug -- title, confirmed root cause, reproduction, intended fix, tagged `bug`, assignee `claude`. If an unrelated item is `in_progress`, the bug task queues behind it; if nothing is, invoke `turnstile-work` with the new id so the fix happens now. Either way it ships through work -> review under its own ticket.
   - **No turnstile board:** ad hoc mode -- dispatch `turnstile-coder` directly with the root cause and fix approach.
7. Where the coder was dispatched here (related or ad hoc branch): verify the fix resolves the original reproduction case and check for regressions. If it doesn't resolve it, the hypothesis was wrong -- revert and re-investigate rather than layering another change on top. (A queued bug task is verified later by its own work/review cycle.)
8. Capture (per the capture config), and in either mode only after the root cause is confirmed -- never dispatch mid-investigation, and never pass unconfirmed hypotheses. In `gates` mode (default), dispatch `brain-curator` with bounded input: the confirmed root cause (plus the touched files -- path, purpose, what changed -- when the fix changed code here). In `opportunistic` mode, dispatch when the fix changed code or the root cause was non-obvious; one dispatch covers both.
9. Tell the user the root cause and what happened to the fix: folded into the in_progress ticket, queued/fixed as ticket `<id>`, or applied ad hoc.
