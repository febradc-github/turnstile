---
name: cadence-systematic-debugger
description: Independent debugging methodology -- reproduce, gather evidence, form and test a hypothesis, find the root cause, fix, verify. Not tied to the ticket system; works ad hoc on any bug report and logs a brain note when the root cause is a non-obvious gotcha. Only invoke when dispatched by the /cadence:systematic-debugger command or cadence-conversate routing.
argument-hint: "[bug description]"
user-invocable: false
---

# Systematic Debugger

<important>
- Never guess a fix before forming and testing a hypothesis about the root cause. A fix that isn't traced to a cause is a coincidence, not a fix.
- Search the vault (brain, decisions, architecture) for related notes before investigating -- the same root cause may already be documented.
- Never write the fix yourself. Fixes of any size are dispatched to the cadence-coder agent; the only inline edits are temporary diagnostic instrumentation, reverted before finishing.
- In a cadence project, a confirmed bug becomes tracked work: related to the current in_progress item -> fix it now under that ticket; unrelated -> create a bug task via cadence-quick that runs right after the in_progress item finishes. Only fix-and-forget (no ticket) outside a cadence board. This is what gets bug fixes reviewed and committed instead of stranded as uncommitted changes.
</important>

## Purpose

Finds and fixes the actual root cause of a bug ($ARGUMENTS), rather than patching a symptom, and remembers non-obvious causes for next time.

## Process

1. Search the vault for notes related to the bug's topic or symptoms (the search_notes MCP tool indexes all of cadence/). Surface anything relevant, including a prior note that already documents this exact cause.
2. Reproduce the bug. If it can't be reproduced, gather as much evidence as possible (error messages, logs, exact steps tried) before proceeding -- do not guess at a fix for a bug that hasn't been observed.
3. Gather evidence: read the relevant code paths, recent changes (`git log`/`git diff` if relevant), and any error output in full.
4. Form one specific, falsifiable hypothesis about the root cause.
5. Test the hypothesis with the cheapest check available (e.g. a targeted print/log, a minimal reproduction, reading the exact line in question) before writing any fix. If the hypothesis is wrong, form a new one and repeat -- do not move to a fix on an untested hypothesis.
6. Once the root cause is confirmed, route the fix:
   - **Related to the in_progress item** (the current sprint has an `in_progress` item and the bug lives in that ticket's scope -- the same feature or files its changes touch): the fix is part of that ticket. Dispatch the `cadence-coder` agent with the confirmed root cause, the reproduction steps, and the intended minimal fix approach; the fix rides that ticket's diff into its `/cadence:review`. Append to the item's `notes`: `debug: <one-line root cause and fix>`.
   - **Unrelated (or nothing is in_progress), and this project has a cadence board:** do not fix it now under someone else's diff. Invoke the `cadence-quick` skill with the bug -- title, confirmed root cause, reproduction, intended fix approach, tagged `bug`, assignee `claude`. If an unrelated item is `in_progress`, the bug task queues right after it finishes (one item at a time). If nothing is `in_progress`, invoke the `cadence-work` skill with the new id so the fix happens now. Either way the fix ships through work -> review, reviewed and committed under its own ticket.
   - **No cadence board in this project:** ad hoc mode -- dispatch `cadence-coder` directly with the root cause and fix approach.
7. Where the coder was dispatched here (related or ad hoc branch): verify the fix resolves the original reproduction case, and check for regressions in related behavior. (A queued bug task is verified later by its own work/review cycle.)
8. Dispatch the `brain-curator` agent when the fix changed code (include the touched files -- path, one-line purpose, what changed -- so their `cadence/code/` notes are updated) or the root cause was non-obvious (include a short description of it); one dispatch covers both.
9. Tell the user what the root cause was and what happened to the fix: folded into the in_progress ticket, queued/fixed as ticket `<id>`, or applied ad hoc.

## Inputs

The vault's markdown notes, the codebase, `cadence/sprint.yml` (if any item is `in_progress`).

## Outputs

Fixed code in the repo (related/ad hoc branch) or a tracked bug task via `cadence-quick` (unrelated branch), an updated `notes` field on the related in_progress item, a `brain-curator` dispatch covering touched-file code notes and any non-obvious root cause.

## Error handling

- **Bug can't be reproduced and no useful evidence is available:** tell the user what's needed (exact steps, error output, environment) before continuing -- do not guess.
- **Hypothesis disproven:** discard it, form a new one from the evidence gathered so far; never patch around a disproven hypothesis "just in case."
- **Fix doesn't resolve the reproduction case:** the hypothesis was wrong even though the test seemed to confirm it -- revert the fix and re-investigate rather than layering another change on top.
