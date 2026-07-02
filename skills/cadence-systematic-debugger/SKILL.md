---
name: cadence-systematic-debugger
description: Independent debugging methodology -- reproduce, gather evidence, form and test a hypothesis, find the root cause, fix, verify. Not tied to the ticket system; works ad hoc on any bug report and logs a brain note when the root cause is a non-obvious gotcha. Only invoke when dispatched by the /cadence:systematic-debugger command or cadence-conversate routing.
argument-hint: "[bug description]"
user-invocable: false
---

# Systematic Debugger

<important>
- Never guess a fix before forming and testing a hypothesis about the root cause. A fix that isn't traced to a cause is a coincidence, not a fix.
- Search cadence/brain/ for related notes before investigating -- the same root cause may already be documented.
- If an active sprint item is `in_progress`, append a short note about the bug and fix to its `notes` field; otherwise this skill works entirely outside the ticket system.
</important>

## Purpose

Finds and fixes the actual root cause of a bug ($ARGUMENTS), rather than patching a symptom, and remembers non-obvious causes for next time.

## Process

1. Search `cadence/brain/*.md` for notes related to the bug's topic or symptoms (by filename, tags, and heading text). Surface anything relevant, including a prior note that already documents this exact cause.
2. Reproduce the bug. If it can't be reproduced, gather as much evidence as possible (error messages, logs, exact steps tried) before proceeding -- do not guess at a fix for a bug that hasn't been observed.
3. Gather evidence: read the relevant code paths, recent changes (`git log`/`git diff` if relevant), and any error output in full.
4. Form one specific, falsifiable hypothesis about the root cause.
5. Test the hypothesis with the cheapest check available (e.g. a targeted print/log, a minimal reproduction, reading the exact line in question) before writing any fix. If the hypothesis is wrong, form a new one and repeat -- do not move to a fix on an untested hypothesis.
6. Once the root cause is confirmed, write the minimal fix that addresses that cause (not just the observed symptom). If the fix is more than a few lines, dispatch the `cadence-coder` agent with the confirmed root cause, the reproduction steps, and the intended fix approach; for a trivial fix, apply it inline.
7. Verify the fix resolves the original reproduction case, and check for regressions in related behavior.
8. If the active sprint has an item with `status: in_progress`, append a short entry to its `notes`: `debug: <one-line summary of root cause and fix>`.
9. If the root cause was non-obvious (would likely trip someone up again), dispatch the `brain-curator` agent with a short description of it.
10. Tell the user what the root cause was and what changed to fix it.

## Inputs

`cadence/brain/*.md`, the codebase, the active `cadence/sprint-*.yml` (if any item is `in_progress`).

## Outputs

Fixed code in the repo, an updated `notes` field on the active in_progress item (if any), a `brain-curator` dispatch on a non-obvious root cause.

## Error handling

- **Bug can't be reproduced and no useful evidence is available:** tell the user what's needed (exact steps, error output, environment) before continuing -- do not guess.
- **Hypothesis disproven:** discard it, form a new one from the evidence gathered so far; never patch around a disproven hypothesis "just in case."
- **Fix doesn't resolve the reproduction case:** the hypothesis was wrong even though the test seemed to confirm it -- revert the fix and re-investigate rather than layering another change on top.
