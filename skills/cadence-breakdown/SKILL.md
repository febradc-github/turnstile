---
name: cadence-breakdown
description: Decomposes an epic into user stories, or an oversized story into tasks. Proposes a breakdown for explicit approval, then writes child design docs and backlog entries. Gate 1a-b of the cadence workflow, between refine and spec. Only invoke when dispatched by the /cadence:breakdown command, cadence-conversate routing, or cadence-refine's epic handoff.
argument-hint: "[id]"
user-invocable: false
---

# Breakdown

<important>
- Do not write any child to cadence/backlog.yml until the user has explicitly approved the full breakdown. "Looks good" or equivalent counts as approval; silence does not.
- Only backlog items can be broken down. Refuse items living in a sprint file -- breaking down mid-sprint work invalidates the sprint's scope.
- Two levels of nesting maximum: epic -> story -> task. Refuse type: task items; tasks are always leaves.
- Every child gets non-empty acceptance_criteria and a points estimate before the proposal is presented. No placeholder children.
- Search cadence/brain/ for related notes before proposing the breakdown, and surface what you find.
</important>

## Purpose

Turns one umbrella backlog item into smaller workable children, so large work
enters sprints as reviewable leaf tickets instead of one unshippable blob.

## Process

1. Look up `<id>` (from `$ARGUMENTS`) in `cadence/backlog.yml`.
   - Not found there but found in a sprint file: refuse; sprint items are already committed scope.
   - Not found anywhere: refuse; suggest `/cadence:refine <idea>` to create it first.
   - `type: task`: refuse; tasks are leaves. If the task is too big, its estimate is wrong -- revisit the parent story's breakdown instead.
2. Decide the child type: `epic` parent -> `story` children; `story` parent (explicit or absent `type`) -> `task` children.
3. Search `cadence/brain/*.md` for notes related to the item's topic (by filename, tags, and heading text). Surface anything relevant, including conflicts, before continuing.
4. Read `cadence/designs/<id>.md` (and the parent epic's design doc too, when breaking a story that has a `parent`). If no design doc exists, refuse and direct the user to `/cadence:refine` -- breakdown decomposes an approved design, it does not invent one.
5. Draft 2-8 children. For each: a clear title, a one-paragraph description, non-empty `acceptance_criteria` (concrete, checkable), a `points` estimate, and an `assignee` (inherit the parent's unless the user says otherwise). Children must partition the parent's scope: together they cover the parent's acceptance criteria, and no two children overlap. If the parent's scope honestly fits in one child, say so and recommend skipping breakdown.
6. Present the full proposal (every child, every field) and ask the user to explicitly approve it. Revise and re-present on requested changes. Do not write anything until they approve.
7. Once approved:
   - Mint child ids: scan `cadence/backlog.yml` and every `cadence/sprint-*.yml` for existing `C-<N>` ids; children get `C-<max+1>`, `C-<max+2>`, ... For each computed id, check `cadence/designs/<id>.md` does not already exist (an abandoned refine/breakdown draft may hold it); if it does, warn the user and skip forward to the next free id -- never overwrite silently.
   - Write `cadence/designs/<child-id>.md` for each child:

         # <child-id>: <title>

         ## Parent
         Part of <parent-id> -- see cadence/designs/<parent-id>.md for the umbrella rationale.

         ## Problem
         <this child's slice of the parent problem>

         ## Approach
         <the approach for this slice>

         ## Acceptance criteria
         - <criterion 1>
         - <criterion 2>

         ## Estimate
         <points> points

         ## Assignee
         <claude|human>

   - Append each child to `cadence/backlog.yml`:

         - id: <child-id>
           title: "<title>"
           type: <story|task>
           parent: <parent-id>
           status: idea
           description: "<one-paragraph description>"
           acceptance_criteria: ["<criterion 1>", "<criterion 2>"]
           points: <points>
           assignee: <claude|human>
           tags: []
           created: <today, YYYY-MM-DD>
           updated: <today, YYYY-MM-DD>

   - Update the parent in `cadence/backlog.yml`: it is now a container. If its `status` was `ready`, set it back to `idea` (containers never enter sprints; the children do). Set `updated` to today.
8. If the dialogue surfaced something worth remembering (a scoping decision, a rejected split and why), dispatch the `brain-curator` agent with a short description of it.
9. Tell the user the breakdown is recorded and that each child needs `/cadence:spec <child-id>` to become `ready`.

## Inputs

`cadence/backlog.yml`, every `cadence/sprint-*.yml` (id computation only), `cadence/designs/<id>.md`, `cadence/brain/*.md`.

## Outputs

`cadence/designs/<child-id>.md` (one per child), `cadence/backlog.yml` (children appended with `status: idea`; parent's `status`/`updated` adjusted).

## Error handling

- **Id not in the backlog:** refuse; point at `/cadence:refine` (not created) or explain sprint items can't be broken down (already planned).
- **Item is a task:** refuse; suggest re-examining the parent story's breakdown instead.
- **No design doc for the item:** refuse; direct the user to `/cadence:refine` first.
- **Parent already has children:** this is a second breakdown pass. List the existing children first and only propose additions that don't overlap them; never duplicate a child that already exists.
- **User keeps rejecting proposals:** keep revising; if the disagreement is about the parent's scope itself, recommend revisiting `/cadence:refine`'s design doc rather than forcing a split.
- **Malformed YAML in backlog.yml:** surface the parse error and ask the user to fix it by hand -- never guess or auto-repair.
