---
name: cadence-refine
description: Gap-closing dialogue for a raw idea. Writes a design doc that requires the user's explicit approval before the idea can move toward being spec'd. Gate 1a of the cadence workflow. Only invoke when dispatched by the /cadence:refine command, cadence-conversate routing, or cadence-brainstorm's handoff.
argument-hint: "[idea description]"
user-invocable: false
---

# Refine

<important>
- Do not finish this skill until acceptance_criteria (non-empty), a points estimate, and an assignee are all known. Ask one question at a time for anything missing or ambiguous.
- Do not add the item to cadence/backlog.yml until the user has explicitly approved the design doc. "Looks good" or equivalent counts as approval; silence does not.
- Search cadence/brain/ for related notes before starting the dialogue, and surface what you find.
- Assess scale during the dialogue: an idea with multiple independent deliverables, or an estimate above 8 points, is an epic. Record it with type: epic and hand off to cadence-breakdown -- do not force epic-sized work into one flat ticket.
</important>

## Purpose

Turns a raw idea ($ARGUMENTS) into an approved design doc and a tracked backlog item, so nothing enters a sprint half-specified.

## Process

1. Search `cadence/brain/*.md` for notes related to the idea's topic (by filename, tags, and heading text). Surface anything relevant, including conflicts, before continuing.
2. Compute the next ticket ID: scan `cadence/backlog.yml` and every `cadence/sprint-*.yml` for existing `C-<N>` ids across all `items` lists; the new id is `C-<max+1>`, or `C-1` if none exist. If `cadence/backlog.yml` does not exist yet, it will be created in step 6 with `items: []`.
3. Run a one-question-at-a-time dialogue with the user to establish:
   - A clear title and one-paragraph description of the problem.
   - Non-empty `acceptance_criteria` (a list of concrete, checkable statements).
   - A `points` estimate (any positive integer the user agrees to).
   - `assignee`: ask who implements this -- `claude` or `human`. Default to `claude` if the user has no preference.
   Do not proceed to step 4 while any of these is missing or the user's answer is ambiguous.
   While talking, assess scale: if the idea contains multiple independent deliverables, or the estimate lands above 8 points, tell the user this is epic-sized and will be recorded as `type: epic`, with acceptance criteria at the outcome level (what the whole epic must achieve). The pieces get their own criteria later via `/cadence:breakdown`.
4. Before writing, check whether `cadence/designs/<id>.md` already exists. Since `id` is computed from `cadence/backlog.yml` and `cadence/sprint-*.yml` (step 2), a file can exist at that path with no matching entry in either source -- this means an earlier refine session was abandoned after writing its design doc but before the user approved it in step 6. If the file exists, warn the user that a draft already exists at `<id>` and is likely an abandoned prior session, and ask whether to overwrite it or start a fresh draft. If they want a fresh draft, recompute using `id+1` and repeat this check against the new id (it too may already exist). Do not silently overwrite an existing design doc.

   Write `cadence/designs/<id>.md`:

       # <id>: <title>

       ## Problem
       <problem statement from the dialogue>

       ## Approach
       <the approach agreed on>

       ## Trade-offs considered
       <alternatives discussed and why not chosen, or "None discussed.">

       ## Acceptance criteria
       - <criterion 1>
       - <criterion 2>

       ## Estimate
       <points> points

       ## Assignee
       <claude|human>

5. Present the design doc content to the user and ask them to explicitly approve it. If they request changes, revise the file and re-present. Do not proceed until they approve.
6. Once approved, append the item to `cadence/backlog.yml` (creating the file with `items: []` first if it doesn't exist):

       - id: <id>
         title: "<title>"
         status: idea
         description: "<one-paragraph description>"
         acceptance_criteria: ["<criterion 1>", "<criterion 2>"]
         points: <points>
         assignee: <claude|human>
         tags: []
         created: <today, YYYY-MM-DD>
         updated: <today, YYYY-MM-DD>

   For an epic-sized item (step 3), add `type: epic` after `title`.
7. If the dialogue surfaced something worth remembering (a decision, a rejected alternative and why, a related gotcha from the brain search in step 1), dispatch the `brain-curator` agent with a short description of it.
8. For a regular item, tell the user the design is approved and recorded, and that `/cadence:spec <id>` is the next step. For an epic, tell them it needs breaking into stories before anything can be spec'd, and invoke the `cadence-breakdown` skill with the epic's id (its own approval gate governs the split).

## Inputs

`cadence/brain/*.md`, `cadence/backlog.yml`, every `cadence/sprint-*.yml` (for id computation only).

## Outputs

`cadence/designs/<id>.md` (new file), `cadence/backlog.yml` (new or appended item with `status: idea`).

## Error handling

- **User has no idea yet what they want:** ask open-ended questions to help them articulate the problem before asking for acceptance criteria -- don't force the checklist prematurely.
- **User tries to skip straight to acceptance criteria without a clear problem statement:** ask for the problem statement first; acceptance criteria without a stated problem are usually wrong.
- **`cadence/designs/<id>.md` already exists at the computed id:** this is likely an abandoned draft from a prior refine session that never reached step 6 (so its id never made it into `cadence/backlog.yml` or a sprint file). Warn the user and ask whether to overwrite it or use `id+1` for a fresh draft, checking again for a collision at the new id. Never overwrite silently.
