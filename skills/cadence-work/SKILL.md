---
name: cadence-work
description: Drives implementation of one ticket in the active sprint. Mandates TDD, defers to frontend-design for UI-facing tickets, and checks the brain before writing new code. Only invoke when dispatched by the /cadence:work command or cadence-conversate routing.
argument-hint: "[id]"
user-invocable: false
---

# Work

<important>
- Refuse assignee: human items -- tell the user it's tracked as human-owned, don't implement it.
- Only one item in the active sprint may be in_progress at a time. If a different item is already in_progress, refuse and tell the user to finish it (move it to review or done) before starting another -- this keeps /cadence:review's diff scoped to one ticket.
- Search cadence/brain/ before writing any code. If something related already exists, surface it -- don't rebuild it blind.
- Follow TDD: write the failing test first, then the minimal code to pass it. Defer to superpowers:test-driven-development if installed.
- Dispatch the cadence-coder agent for the implementation when the spec is complete and the ticket is self-contained -- it keeps this session's context lean for orchestration. Implement inline only when the work needs ongoing dialogue with the user.
- For UI-facing tickets, defer to the frontend-design skill (if installed) for the design portion.
</important>

## Purpose

Implements one ticket end to end for a single work session, logging what happened so `/cadence:review` and later sessions have context.

## Process

1. Look up `<id>` (from `$ARGUMENTS`) in the active sprint file. If no active sprint exists, or the id isn't in it, tell the user and suggest `/cadence:sprint-plan`.
2. If the item's `assignee` is `human`, refuse: tell the user this ticket is tracked as human-owned and point them at it instead of implementing it.
3. If the item's `status` isn't `todo` or `in_progress` (e.g. it's still `idea`/`ready` and was never planned into this sprint, or it's mid-`review`), refuse and redirect to the correct earlier step.
4. If any *other* item in the active sprint already has `status: in_progress`, refuse: tell the user to finish that item first (move it to `review` or `done` via `/cadence:review`) before starting this one. Only one item may be `in_progress` at a time.
5. Search `cadence/brain/*.md` for notes related to this ticket's topic (by filename, tags, and heading text). Surface anything relevant, including conflicts, before writing code -- this is the "hasn't this already been built" check.
6. Read `cadence/specs/<id>.md` for the acceptance criteria driving this ticket.
7. Set the item's `status` to `in_progress` if it was `todo` -- before writing any code, so an interrupted session still leaves the board accurate.
8. If any acceptance criterion is UI-facing, defer to the `frontend-design` skill (if installed) for that portion of the work.
9. Implement using TDD. Default path: dispatch the `cadence-coder` agent, passing the spec's acceptance criteria, the relevant brain notes from step 5, and pointers to the affected files -- it implements test-first and reports back files changed, test results, and notes. Implement inline instead only when the ticket needs ongoing dialogue with the user (e.g. UI decisions mid-implementation). Either way: write a failing test for one acceptance criterion, run it to confirm it fails, write the minimal code to pass it, run it to confirm it passes, repeat per criterion.
10. Append a short entry to the item's `notes`: `work pass <n>: <one-line summary of what was implemented>`, where `<n>` is the count of prior "work pass" entries plus one.
11. If you noticed something worth remembering while implementing (an architectural decision, a gotcha, a piece of prior work this ticket built on) -- including anything the `cadence-coder` report flagged under Notes -- dispatch the `brain-curator` agent with a short description of it.
12. Tell the user what was implemented and that `/cadence:review <id>` is the next step.

## Inputs

The active `cadence/sprint-*.yml`, `cadence/specs/<id>.md`, `cadence/brain/*.md`.

## Outputs

Implementation code and tests in the repo, the active sprint file (item's `status` and `notes` updated).

## Error handling

- **No active sprint:** tell the user, suggest `/cadence:sprint-plan`.
- **assignee: human:** refuse; point the user at the item instead of implementing it.
- **Item never went through refine/spec/plan:** refuse; redirect to the missing earlier step.
- **Another item is already in_progress:** refuse; tell the user to finish that one first.
- **Malformed YAML in the active sprint file:** surface the parse error and ask the user to fix it by hand -- never guess or auto-repair.
