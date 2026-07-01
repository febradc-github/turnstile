---
name: go
description: Casual entry point for cadence. Infers what the user wants from their message and the current board state, and either answers directly (for read-only requests) or tells them exactly which gated command to run next. Use when the user asks about cadence work in natural language rather than a specific /cadence command.
argument-hint: "[what you want]"
---

# Go

<important>
Never execute a gated command's effects yourself (refine, spec, plan, work, review all have disable-model-invocation: true and cannot be invoked programmatically from here). Only ever: (a) answer read-only questions directly, or (b) tell the user the exact /cadence:<command> to run and why.
</important>

## Purpose

Lets the user talk about cadence work casually instead of memorizing command names, while still respecting every gate.

## Process

1. Read `cadence/backlog.yml` (if it exists) and the active `cadence/sprint-*.yml` (if one exists) to build a status snapshot.
2. Match the user's request ($ARGUMENTS plus their message) against these cases, in order:
   - **Asking about status, progress, or "what's on the board":** answer directly using the snapshot from step 1 (same content as `/cadence:board` or `/cadence:standup`, whichever fits the question).
   - **Describing a brand-new idea not present in the backlog or any sprint:** tell them: "This looks like a new idea. Run `/cadence:refine <description>` to start it." Do not run refine yourself.
   - **Referencing an existing item by id or title, wanting to move it forward:**
     - `status: idea` -> tell them to run `/cadence:spec <id>`. (A backlog item only ever reaches `status: idea` after `/cadence:refine` has already written and gotten approval for its design doc, so a design doc always exists at this point -- never route back to `/cadence:refine`, which mints a brand-new id from a description and cannot resume an existing item.)
     - `status: ready` and not in any sprint file -> tell them to run `/cadence:plan`.
     - In the active sprint with `status: in_progress` and the user says the work is finished -> tell them to run `/cadence:review <id>`. Check this condition before the next one.
     - In the active sprint with `status: todo` or `status: in_progress` (and the user isn't saying it's finished) -> tell them to run `/cadence:work <id>`.
     - In the active sprint with `status: review` -> tell them a review is already in progress for that item; ask if they want to check on it.
     - In the active sprint with `status: done` -> tell them it's already shipped.
   - **Talking about starting a new sprint:** tell them to run `/cadence:plan`.
   - **Anything ambiguous:** ask one clarifying question rather than guessing which command they mean.

## Inputs

`cadence/backlog.yml`, every `cadence/sprint-*.yml`, `cadence/designs/*.md` (existence checks only).

## Outputs

None -- this skill only reads and advises; it never mutates board state itself.

## Error handling

- **No backlog or sprint files exist yet:** tell the user the board is empty and suggest `/cadence:refine <idea>` to start.
- **Request matches no case above cleanly:** ask a clarifying question instead of guessing.
