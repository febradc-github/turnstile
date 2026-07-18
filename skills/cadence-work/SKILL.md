---
name: cadence-work
description: Implements one sprint ticket via TDD and the cadence-coder agent, checking the brain first. Dispatched by /cadence:work or conversate routing only.
argument-hint: "[id]"
user-invocable: false
---

# Work

<important>
- Refuse assignee: human items -- tell the user it's tracked as human-owned, don't implement it.
- Only one item in the active sprint may be in_progress at a time. If a different item is already in_progress, refuse and tell the user to finish it (move it to review or done) first -- this keeps /cadence:review's diff scoped to one ticket.
- Search the vault (brain, decisions, architecture, item notes) before writing any code. If something related already exists, surface it -- don't rebuild it blind.
- Follow TDD: write the failing test first, then the minimal code to pass it. Defer to superpowers:test-driven-development if installed.
- Never write or edit source files from this skill. Every code change -- including docstrings, comments, renames, formatting, and "one-line" fixes -- is implemented by dispatching the cadence-coder agent. There is no change small enough to do inline. "It's just a comment", "dispatching is overkill", "I'll add it directly" -- each of those thoughts is the bug: stop and dispatch.
- If implementation needs user decisions (e.g. UI choices), resolve them with the user first, then dispatch cadence-coder with the answers -- ongoing dialogue is a reason to ask questions, never a reason to code inline.
- For UI-facing tickets, defer to the frontend-design skill (if installed) for the design portion.
</important>

## Process

1. Look up `<id>` (from `$ARGUMENTS`) in the current sprint -- `cadence/sprint.yml`, or (legacy) the root `cadence/sprint-<N>.yml` with `sprint.status: active`. No active sprint, or id not in it: tell the user and suggest `/cadence:sprint-plan` (or `/cadence:quick` for small work).
2. `assignee: human`: refuse and point the user at the item.
3. `status` not `todo` or `in_progress` (never planned in, or mid-`review`): refuse and redirect to the correct earlier step.
4. Another item already `in_progress`: refuse; the user finishes it via `/cadence:review` first.
5. Search the vault for notes related to this ticket's topic. Surface anything relevant, including conflicts, before writing code. Pay particular attention to `adr-*` and `AR-*` notes touching this area: the implementation must not silently contradict a recorded decision.
6. Read the ticket's spec -- `cadence/specs/SP-<n>.md` (`<n>` from `<id>` = `C-<n>`), falling back to legacy names (`cadence/specs/<id>-*-spec.md`, `cadence/specs/<id>.md`). No spec file means a quick-lane item: its criteria live in the item note's "## Acceptance criteria" section. If the item has a `parent`, also read the parent chain's design docs (`DS-<parent n>`, or legacy names) -- the umbrella rationale often settles questions the leaf spec doesn't repeat.
7. Set `status: in_progress` if it was `todo` -- before writing any code, so an interrupted session still leaves the board accurate.
8. If any acceptance criterion is UI-facing, defer to `frontend-design` (if installed) for that portion.
9. Ask the user:

   > Run this in loop mode?
   > [y] autonomous -- iterations run uninterrupted until done
   > [n] manual -- you confirm each DECIDE before the loop advances

   Wait for a reply. Accept `y`/`yes`/`Y` as **autonomous** and `n`/`no`/`N` as **manual**. Any other input: re-ask once, then default to manual.

   - If **y (loop mode)**: derive the loop goal from the ticket title and the first acceptance criterion; derive the success condition from the spec's done definition (or "all acceptance criteria pass and tests are green" if none is stated). Invoke the `cadence-loop-start` skill with `goal="<derived goal>" success="<derived success>" max-iterations=<N>` where N defaults to 10 unless the ticket's spec states otherwise. Skip step 10 -- the loop handles implementation. Continue from step 11 (notes) once the loop terminates.
   - If **n (no loop)**: proceed to step 10 with the normal `cadence-coder` dispatch.

10. Implement by dispatching `cadence-coder` with the acceptance criteria, the relevant brain notes from step 5, pointers to affected files, and any decisions gathered from the user. It works test-first and reports files changed, test results, and notes. Dispatch it for every change, no matter how small. If questions surface mid-implementation, resolve them with the user and re-dispatch; never finish the code yourself.
11. Append to the item's `notes`: `work pass <n>: <one-line summary>`, `<n>` = prior "work pass" entries + 1.
12. Dispatch `brain-curator` with: the source files this pass created or changed (path, one-line purpose, exports, known imports/callers -- from the coder's report) so their `cadence/code/` notes are updated, plus anything worth remembering (a decision, a gotcha, anything the coder flagged under Notes). Fires whenever code changed; skipped only when nothing was implemented.
13. Tell the user what was implemented and that `/cadence:review <id>` is next.

## Error handling

- **Malformed YAML in the active sprint file:** surface the parse error and ask the user to fix it by hand -- never guess or auto-repair.
