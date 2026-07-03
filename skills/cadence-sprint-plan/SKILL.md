---
name: cadence-sprint-plan
description: Starts a new sprint. Rolls over unfinished items from the prior sprint, recommends which ready backlog items to pull in (velocity, epic focus, age), and proposes a sprint goal for confirmation. The sprint-entry gate of the cadence workflow. Only invoke when dispatched by the /cadence:sprint-plan command or cadence-conversate routing.
user-invocable: false
---

# Sprint Plan

<important>
- Do not create the new sprint file until the user has explicitly confirmed a sprint goal. Propose one derived from the selected items so confirming is one word, but no goal, no sprint.
- An item has exactly one live copy at a time: either cadence/backlog.yml or the active cadence/sprint-N.yml. When an item moves, remove it from its old location. Completed sprint files retain carried-over items as an immutable historical record, not a live copy.
- Only leaf items with status: ready in cadence/backlog.yml may be pulled into a sprint. Epics and containers (items another item names as parent) never enter a sprint -- their children do.
</important>

## Purpose

Closes out the previous sprint (if any), carries its unfinished work forward, and opens a new sprint around a goal the user actually states.

## Process

1. Find the most recent `cadence/sprint-N.yml` by scanning for the highest `N`. If one exists and its `sprint.status` is `active`:
   - Set its `sprint.status` to `completed`.
   - Collect every item in it whose `status` is not `done`.
   - If any collected item's `carryovers` is already 2 or more (rolling over a second time or beyond), dispatch the `brain-curator` agent with that observation as a candidate process learning -- a repeatedly-slipping item is worth remembering.
2. Search `cadence/brain/*.md` for process-type notes relevant to sprint planning (by filename, tags, and heading text) -- especially estimation bias or recurring blockers. Surface anything relevant, including conflicts, before continuing.
3. List the `ready` candidates from `cadence/backlog.yml` and recommend a selection. Candidates are leaf items only -- exclude anything with `type: epic` and anything another item names as `parent`. List each candidate with id, title, and points, grouped under its parent epic/story when it has one (show the parent's id and title as the group header) so the user sees what larger goal each piece serves. Then mark which items you recommend pulling in, with a one-line reason per item, ranked by:
   - **Capacity first.** Budget = points completed (`status: done`) in the previous sprint, minus the points of carried-over items (they consume capacity too). With no prior sprint there is no velocity data -- say so and recommend a deliberately small starting set.
   - **Finish what's started.** Children of an epic that already has done or carried-over children come first; closing out an epic beats opening a new one.
   - **Coherence.** Prefer items sharing one epic -- a focused sprint yields a natural goal in step 4.
   - **Age.** Break ties by oldest `updated` date, so old ready items don't starve.
   Present the recommendation as a default the user can accept in one word, adjust, or replace entirely. The user always has the final pick.
4. Propose a one-line sprint goal derived from the selection (e.g. the shared epic's outcome, or the common thread across the picked items) and ask the user to confirm it or state their own. Do not proceed without explicit confirmation -- a goal keeps the sprint a focus, not a bag of tickets.
5. Compute the new sprint number: previous `N` + 1, or `1` if no prior sprint file exists.
6. Write `cadence/sprint-<N>.yml`:

       sprint:
         name: "Sprint <N>"
         goal: "<goal confirmed in step 4>"
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

   Items with `type` and `parent` fields keep both in the sprint file (that is how the board and review trace them back to their epic/story).

7. Remove every newly selected item from `cadence/backlog.yml`'s `items` list (carried-over items were never in the backlog file -- they came from the old sprint file, which step 1 already marked `completed` and left in place as history).
8. Tell the user the new sprint is open, stating its goal and the items in it.

## Inputs

`cadence/backlog.yml`, every `cadence/sprint-*.yml`, `cadence/brain/*.md`.

## Outputs

`cadence/sprint-<N>.yml` (new file), the previous active sprint file (`status` updated to `completed`), `cadence/backlog.yml` (selected items removed).

## Error handling

- **No sprint goal confirmed:** re-propose or ask again; do not create the sprint file on a vague or unconfirmed goal.
- **No ready leaf items exist in the backlog:** tell the user; a sprint with only carried-over items (or an empty one) is still valid if they confirm that's intended. If ready-looking work is stuck inside an unbroken epic, point them at `/cadence:breakdown <epic-id>`.
- **Malformed YAML in an existing file:** surface the parse error location and ask the user to fix it by hand -- never guess or auto-repair.
