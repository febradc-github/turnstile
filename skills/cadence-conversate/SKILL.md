---
name: cadence-conversate
description: Casual entry point for cadence. Classifies what the user wants from their message and the current board state, then directly invokes the matching skill -- brainstorm for a fresh idea, refine/spec/sprint-plan/work/review for an existing item at the right gate, systematic-debugger for a bug report, code-reviewer for a review request. Use when the user asks about cadence work in natural language rather than a specific /cadence command.
argument-hint: "[what you want]"
user-invocable: false
---

# Conversate

<important>
- Always invoke the matched skill directly via the Skill tool rather than merely telling the user which command to run. The invoked skill's own internal approval gates (explicit design-doc approval in refine, explicit spec approval in spec, sprint-goal requirement in sprint-plan, etc.) are the actual safety mechanism -- conversate's job is routing, not gating.
- Never perform a gated skill's effects yourself inline (e.g. never write a design doc or item note directly, and never edit a `cadence/code/` note directly -- only brain-curator writes notes). Only ever: (a) answer a read-only question directly -- which may include dispatching brain-curator to correct a drifted code note you found while answering -- or (b) invoke exactly one matching skill.
- If genuinely ambiguous, ask one clarifying question instead of guessing which skill to invoke.
</important>

## Purpose

Lets the user talk about cadence work casually instead of memorizing command names or manually running the next step, while still respecting every gate -- each invoked skill enforces its own approvals.

## Process

1. Read `cadence/backlog.yml` (if it exists) and the current sprint -- `cadence/sprint.yml`, or a legacy root `cadence/sprint-*.yml` with `sprint.status: active` -- to build a status snapshot.
2. Match the user's request ($ARGUMENTS plus their message) against these cases, in order:
   - **Asking about status, progress, or "what's on the board":** answer directly using the snapshot from step 1 (same content as `/cadence:board` or `/cadence:standup`, whichever fits the question). Do not invoke a skill for this case.
   - **Asking what a piece of code does (a function, file, or module) or how something is implemented:** check `cadence/code/` first -- `search_notes`/`read_note` via the brain MCP tools -- for a note on the relevant file. If a note exists, read the source file at its `aliases` path and compare it against the note. If it still matches, answer directly, citing the verified file. If it has drifted, answer from the file -- source is truth -- and dispatch `brain-curator` (opportunistic mode, this one file, with the purpose/exports/imports/callers you just observed) to correct the note; never edit the note yourself. If no note exists, answer via Grep/Read as usual -- do not dispatch brain-curator just to backfill missing coverage, that's `/cadence:brain-init`'s job. Do not invoke a skill for this case.
   - **Describing a brand-new idea not present in the backlog or any sprint:** invoke the `cadence-brainstorm` skill with the idea description. Exception: if it is clearly trivial (a typo, a tiny chore, ~2 points or less with no design question), invoke `cadence-quick` instead -- the fast lane exists so small work skips the full pipeline.
   - **Reporting something broken (an error, a failing test, unexpected behavior):** invoke the `cadence-systematic-debugger` skill with the report. It diagnoses first, then routes the fix: into the related in_progress ticket, or as a new bug task via cadence-quick.
   - **Asking to cancel, kill, or drop an item:** invoke the `cadence-drop` skill with that id.
   - **Asking for a code review or feedback on a diff/change:** invoke the `cadence-code-reviewer` skill.
   - **Asking to break an item into smaller pieces (or referencing an epic that has no children yet):** invoke `cadence-breakdown` with that id.
   - **Referencing an existing item by id or title, wanting to move it forward:**
     - `type: epic`, or another item names it as `parent`: containers don't move through gates themselves. If it has no children yet, invoke `cadence-breakdown` with its id; otherwise report its children's statuses and route the user to the child at the earliest gate.
     - `status: idea` -> invoke `cadence-spec` with that id. (A backlog item only ever reaches `status: idea` after `/cadence:refine` has already written and gotten approval for its design doc, so a design doc always exists at this point -- never invoke `cadence-refine`, which mints a brand-new id from a description and cannot resume an existing item.)
     - `status: ready` and not in any sprint file -> invoke `cadence-sprint-plan`.
     - In the active sprint with `status: in_progress` and the user says the work is finished -> invoke `cadence-review` with that id. Check this condition before the next one.
     - In the active sprint with `status: todo` or `status: in_progress` (and the user isn't saying it's finished) -> invoke `cadence-work` with that id.
     - In the active sprint with `status: review` -> a review was started for it; if the user wants a verdict, invoke `cadence-review` with that id (it resumes an interrupted review). Otherwise just report the status.
     - In the active sprint with `status: done` -> tell them it's already shipped. Do not invoke a skill.
     - `status: dropped` (anywhere) -> tell them it was cancelled and relay the recorded reason. Do not invoke a skill.
   - **Talking about starting a new sprint:** invoke `cadence-sprint-plan`.
   - **Anything ambiguous:** ask one clarifying question rather than guessing which skill to invoke.

## Inputs

`cadence/backlog.yml`, `cadence/sprint.yml`, `cadence/sprints/*.yml`, and for code questions, `cadence/code/*.md` notes plus the source file each one is tagged to.

## Outputs

None directly -- this skill only reads, classifies, and dispatches; any mutation happens inside whichever skill it invokes, or inside brain-curator when dispatched to fix a drifted code note.

## Error handling

- **No backlog or sprint files exist yet:** tell the user the board is empty and suggest describing what they want to build so conversate can route it to `cadence-brainstorm`.
- **Request matches no case above cleanly:** ask a clarifying question instead of guessing.
- **Invoked skill itself refuses (e.g. malformed YAML, missing design doc):** relay its refusal message to the user; do not retry with a different skill.
