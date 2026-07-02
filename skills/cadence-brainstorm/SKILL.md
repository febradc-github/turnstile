---
name: cadence-brainstorm
description: Loose, exploratory dialogue for a not-yet-scoped idea -- purpose, rough shape, and alternatives, with no file writes. Hands off to /cadence:refine once the idea is concrete enough to formalize into a ticket. Only invoke when dispatched by the /cadence:brainstorm command or cadence-conversate routing.
argument-hint: "[rough idea]"
user-invocable: false
---

# Brainstorm

<important>
- Never write to cadence/backlog.yml, cadence/designs/, or any other cadence data file from this skill -- brainstorming has no side effects. Only `cadence-refine` writes the design doc and backlog entry.
- Do not ask for acceptance criteria, a points estimate, or an assignee -- those belong to `cadence-refine`. Keep questions open-ended and exploratory.
- Search cadence/brain/ for related notes before starting the dialogue, and surface what you find.
</important>

## Purpose

Turns a vague idea ($ARGUMENTS) into a clear enough shape that `/cadence:refine` can formalize it -- the loose stage before the strict gap-closing gate.

## Process

1. Search `cadence/brain/*.md` for notes related to the idea's topic (by filename, tags, and heading text). Surface anything relevant, including conflicts, before continuing.
2. Run an open-ended, one-question-at-a-time dialogue with the user to explore:
   - What problem this actually solves and for whom.
   - The rough shape of an approach (not a full design -- just enough to know it's worth formalizing).
   - Any alternatives briefly considered and why this direction seems right.
3. Keep exploring until the idea is concrete enough that `cadence-refine` could immediately start asking its own (stricter) questions without having to re-derive the basic problem statement.
4. Summarize the idea in two or three sentences and confirm with the user that it's ready to formalize.
5. Once confirmed, invoke the `cadence-refine` skill, passing the summary as its starting description.

## Inputs

`cadence/brain/*.md`.

## Outputs

None directly -- this skill only explores and summarizes; `cadence-refine` (invoked at the end) performs the actual writes.

## Error handling

- **User's idea stays vague after several rounds of questions:** keep asking narrower open-ended questions; do not force a summary or hand off to refine until there's an actual problem statement.
- **User describes something that already exists in the backlog or a sprint:** point this out and ask whether they mean to extend that existing item instead (in which case they should be routed to the appropriate gate for that item, not refine, which only mints new ids).
