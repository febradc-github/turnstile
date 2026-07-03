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
- Search the vault (brain, decisions, architecture, item notes) before writing any code. If something related already exists, surface it -- don't rebuild it blind.
- Follow TDD: write the failing test first, then the minimal code to pass it. Defer to superpowers:test-driven-development if installed.
- Never write or edit source files from this skill. Every code change -- including docstrings, comments, renames, formatting, and "one-line" fixes -- is implemented by dispatching the cadence-coder agent. There is no change small enough to do inline.
- If implementation needs user decisions (e.g. UI choices), resolve them with the user first, then dispatch cadence-coder with the answers -- ongoing dialogue is a reason to ask questions, never a reason to code inline.
- For UI-facing tickets, defer to the frontend-design skill (if installed) for the design portion.
</important>

## Purpose

Implements one ticket end to end for a single work session, logging what happened so `/cadence:review` and later sessions have context.

## Process

1. Look up `<id>` (from `$ARGUMENTS`) in the current sprint -- `cadence/sprint.yml`, or (legacy boards) the root `cadence/sprint-<N>.yml` with `sprint.status: active`. If no active sprint exists, or the id isn't in it, tell the user and suggest `/cadence:sprint-plan` (or `/cadence:quick` for small work).
2. If the item's `assignee` is `human`, refuse: tell the user this ticket is tracked as human-owned and point them at it instead of implementing it.
3. If the item's `status` isn't `todo` or `in_progress` (e.g. it's still `idea`/`ready` and was never planned into this sprint, or it's mid-`review`), refuse and redirect to the correct earlier step.
4. If any *other* item in the active sprint already has `status: in_progress`, refuse: tell the user to finish that item first (move it to `review` or `done` via `/cadence:review`) before starting this one. Only one item may be `in_progress` at a time.
5. Search the vault (brain, decisions, architecture, item notes -- the search_notes MCP tool indexes all of them) for notes related to this ticket's topic. Surface anything relevant, including conflicts, before writing code -- this is the "hasn't this already been built" check. Pay particular attention to `cadence/decisions/adr-*.md` and `cadence/architecture/AR-*.md` notes touching this area: the implementation must not silently contradict a recorded decision.
6. Read the ticket's spec -- `cadence/specs/SP-<n>.md` (`<n>` from `<id>` = `C-<n>`), falling back to legacy names (`cadence/specs/<id>-*-spec.md`, `cadence/specs/<id>.md`) -- for the acceptance criteria driving this ticket. No spec file means a quick-lane item: its acceptance criteria live in the item note (`TK-<n>`/`US-<n>`, "## Acceptance criteria" section); read them there. If the item has a `parent`, also read the parent chain's design docs (`cadence/designs/DS-<parent n>.md`, or their legacy names) -- the umbrella rationale often settles implementation questions the leaf spec doesn't repeat.
7. Set the item's `status` to `in_progress` if it was `todo` -- before writing any code, so an interrupted session still leaves the board accurate.
8. If any acceptance criterion is UI-facing, defer to the `frontend-design` skill (if installed) for that portion of the work.
9. Implement by dispatching the `cadence-coder` agent, passing the spec's acceptance criteria, the relevant brain notes from step 5, pointers to the affected files, and any decisions already gathered from the user (e.g. UI choices from step 8). It implements test-first (failing test per criterion, then minimal code to pass) and reports back files changed, test results, and notes. Dispatch it for every change, no matter how small -- docstring, comment, and polish passes included. If questions surface mid-implementation, resolve them with the user and re-dispatch; never finish the code yourself.
10. Append a short entry to the item's `notes`: `work pass <n>: <one-line summary of what was implemented>`, where `<n>` is the count of prior "work pass" entries plus one.
11. If you noticed something worth remembering while implementing (an architectural decision, a gotcha, a piece of prior work this ticket built on) -- including anything the `cadence-coder` report flagged under Notes -- dispatch the `brain-curator` agent with a short description of it.
12. Tell the user what was implemented and that `/cadence:review <id>` is the next step.

## Red flags -- dispatch cadence-coder anyway

| Thought | Reality |
|---------|---------|
| "It's just docstrings/comments, no behavior change" | Still a source edit. This skill orchestrates; the coder edits. |
| "No test needed, so the TDD path doesn't apply" | Routing isn't about tests. Every source change goes through cadence-coder. |
| "Dispatching is overkill for a one-liner" | Small work is cheap for the coder too. Keep this session orchestration-only. |
| "I'll add them directly to the files" | That sentence is the bug. Stop and dispatch. |

## Inputs

`cadence/sprint.yml` (the current sprint), the ticket's spec or item note, the parent chain's design docs, the vault's markdown notes.

## Outputs

Implementation code and tests in the repo, the active sprint file (item's `status` and `notes` updated).

## Error handling

- **No active sprint:** tell the user, suggest `/cadence:sprint-plan`.
- **assignee: human:** refuse; point the user at the item instead of implementing it.
- **Item never went through refine/spec/plan:** refuse; redirect to the missing earlier step.
- **Another item is already in_progress:** refuse; tell the user to finish that one first.
- **Malformed YAML in the active sprint file:** surface the parse error and ask the user to fix it by hand -- never guess or auto-repair.
