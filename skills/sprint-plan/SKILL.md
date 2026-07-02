---
name: plan
description: Starts a new sprint. Requires a sprint goal, rolls over unfinished items from the prior sprint, and pulls ready backlog items in. The sprint-entry gate of the cadence workflow.
disable-model-invocation: true
---

# Plan

<important>
- Do not create the new sprint file until the user has given an explicit sprint goal. No goal, no sprint.
- An item has exactly one live copy at a time: either cadence/backlog.yml or the active cadence/sprint-N.yml. When an item moves, remove it from its old location. Completed sprint files retain carried-over items as an immutable historical record, not a live copy.
- Only items with status: ready in cadence/backlog.yml may be pulled into a sprint.
</important>

## Purpose

Closes out the previous sprint (if any), carries its unfinished work forward, and opens a new sprint around a goal the user actually states.

## Process

1. Find the most recent `cadence/sprint-N.yml` by scanning for the highest `N`. If one exists and its `sprint.status` is `active`:
   - Set its `sprint.status` to `completed`.
   - Collect every item in it whose `status` is not `done`.
   - If any collected item's `carryovers` is already 2 or more (rolling over a second time or beyond), dispatch the `brain-curator` agent with that observation as a candidate process learning -- a repeatedly-slipping item is worth remembering.
2. Search `cadence/brain/*.md` for process-type notes relevant to sprint planning (by filename, tags, and heading text) -- especially estimation bias or recurring blockers. Surface anything relevant, including conflicts, before continuing.
3. Ask the user for the new sprint's goal. Do not proceed without an explicit answer.
4. Ask the user which `ready` items from `cadence/backlog.yml` to include (list the candidates with id, title, and points; let the user pick).
5. Compute the new sprint number: previous `N` + 1, or `1` if no prior sprint file exists.
6. Write `cadence/sprint-<N>.yml`:

       sprint:
         name: "Sprint <N>"
         goal: "<goal from step 3>"
         started: <today, YYYY-MM-DD>
         ends: <today + 14 days, YYYY-MM-DD, unless the user states a different length>
         status: active
       items:
         # carried-over items first, each with carryovers incremented by 1
         - id: <id>
           title: "<title>"
           status: <its prior status, unchanged>
           points: <points>
           assignee: <assignee>
           acceptance_criteria: [<...>]
           carryovers: <prior carryovers + 1>
           notes: "<prior notes, unchanged>"
         # then newly selected items, each with status: todo and carryovers: 0
         - id: <id>
           title: "<title>"
           status: todo
           points: <points>
           assignee: <assignee>
           acceptance_criteria: [<...>]
           carryovers: 0
           notes: ""

7. Remove every newly selected item from `cadence/backlog.yml`'s `items` list (carried-over items were never in the backlog file -- they came from the old sprint file, which step 1 already marked `completed` and left in place as history).
8. Tell the user the new sprint is open, stating its goal and the items in it.

## Inputs

`cadence/backlog.yml`, every `cadence/sprint-*.yml`, `cadence/brain/*.md`.

## Outputs

`cadence/sprint-<N>.yml` (new file), the previous active sprint file (`status` updated to `completed`), `cadence/backlog.yml` (selected items removed).

## Error handling

- **No sprint goal given:** ask again; do not create the sprint file on a vague or missing goal.
- **No ready items exist in the backlog:** tell the user; a sprint with only carried-over items (or an empty one) is still valid if they confirm that's intended.
- **Malformed YAML in an existing file:** surface the parse error location and ask the user to fix it by hand -- never guess or auto-repair.
