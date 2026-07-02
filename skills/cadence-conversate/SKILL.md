---
name: cadence-conversate
description: Casual entry point for cadence. Classifies what the user wants from their message and the current board state, then directly invokes the matching skill -- brainstorm for a fresh idea, refine/spec/sprint-plan/work/review for an existing item at the right gate, systematic-debugger for a bug report, code-reviewer for a review request. Use when the user asks about cadence work in natural language rather than a specific /cadence command.
argument-hint: "[what you want]"
user-invocable: false
---

# Conversate

<important>
- Always invoke the matched skill directly via the Skill tool rather than merely telling the user which command to run. The invoked skill's own internal approval gates (explicit design-doc approval in refine, explicit spec approval in spec, sprint-goal requirement in sprint-plan, etc.) are the actual safety mechanism -- conversate's job is routing, not gating.
- Never perform a gated skill's effects yourself inline (e.g. never write cadence/designs/<id>.md directly). Only ever: (a) answer a read-only question directly, or (b) invoke exactly one matching skill.
- If genuinely ambiguous, ask one clarifying question instead of guessing which skill to invoke.
</important>

## Purpose

Lets the user talk about cadence work casually instead of memorizing command names or manually running the next step, while still respecting every gate -- each invoked skill enforces its own approvals.

## Process

1. Read `cadence/backlog.yml` (if it exists) and the active `cadence/sprint-*.yml` (if one exists) to build a status snapshot.
2. Match the user's request ($ARGUMENTS plus their message) against these cases, in order:
   - **Asking about status, progress, or "what's on the board":** answer directly using the snapshot from step 1 (same content as `/cadence:board` or `/cadence:standup`, whichever fits the question). Do not invoke a skill for this case.
   - **Describing a brand-new idea not present in the backlog or any sprint:** invoke the `cadence-brainstorm` skill with the idea description.
   - **Reporting something broken (an error, a failing test, unexpected behavior):** invoke the `cadence-systematic-debugger` skill with the report.
   - **Asking for a code review or feedback on a diff/change:** invoke the `cadence-code-reviewer` skill.
   - **Referencing an existing item by id or title, wanting to move it forward:**
     - `status: idea` -> invoke `cadence-spec` with that id. (A backlog item only ever reaches `status: idea` after `/cadence:refine` has already written and gotten approval for its design doc, so a design doc always exists at this point -- never invoke `cadence-refine`, which mints a brand-new id from a description and cannot resume an existing item.)
     - `status: ready` and not in any sprint file -> invoke `cadence-sprint-plan`.
     - In the active sprint with `status: in_progress` and the user says the work is finished -> invoke `cadence-review` with that id. Check this condition before the next one.
     - In the active sprint with `status: todo` or `status: in_progress` (and the user isn't saying it's finished) -> invoke `cadence-work` with that id.
     - In the active sprint with `status: review` -> a review was started for it; if the user wants a verdict, invoke `cadence-review` with that id (it resumes an interrupted review). Otherwise just report the status.
     - In the active sprint with `status: done` -> tell them it's already shipped. Do not invoke a skill.
   - **Talking about starting a new sprint:** invoke `cadence-sprint-plan`.
   - **Anything ambiguous:** ask one clarifying question rather than guessing which skill to invoke.

## Inputs

`cadence/backlog.yml`, every `cadence/sprint-*.yml`.

## Outputs

None directly -- this skill only reads, classifies, and dispatches; any mutation happens inside whichever skill it invokes.

## Error handling

- **No backlog or sprint files exist yet:** tell the user the board is empty and suggest describing what they want to build so conversate can route it to `cadence-brainstorm`.
- **Request matches no case above cleanly:** ask a clarifying question instead of guessing.
- **Invoked skill itself refuses (e.g. malformed YAML, missing design doc):** relay its refusal message to the user; do not retry with a different skill.
