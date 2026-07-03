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
- Search the vault (brain, decisions, architecture, item notes) for related notes before proposing the breakdown, and surface what you find.
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
3. Search the vault (brain, decisions, architecture, item notes -- the search_notes MCP tool indexes all of them) for notes related to the item's topic. Surface anything relevant, including conflicts, before continuing.
4. Read the item's design doc -- `cadence/designs/DS-<n>.md` (`<n>` from `<id>` = `C-<n>`), falling back to legacy names (`cadence/designs/<id>-*-design.md`, `cadence/designs/<id>.md`) -- and the parent epic's design doc too, when breaking a story that has a `parent`. If no design doc exists, refuse and direct the user to `/cadence:refine` -- breakdown decomposes an approved design, it does not invent one.
5. Draft 2-8 children. For each: a clear title, a one-paragraph description, non-empty `acceptance_criteria` (concrete, checkable), a `points` estimate, and an `assignee` (inherit the parent's unless the user says otherwise). Children must partition the parent's scope: together they cover the parent's acceptance criteria, and no two children overlap. If the parent's scope honestly fits in one child, say so and recommend skipping breakdown.
6. Present the full proposal (every child, every field) and ask the user to explicitly approve it. Revise and re-present on requested changes. Do not write anything until they approve.
7. Once approved:
   - Mint child ids: scan `cadence/backlog.yml`, `cadence/sprint.yml`, and `cadence/sprints/*.yml` (plus any legacy `cadence/sprint-*.yml`) for existing `C-<N>` ids; children get `C-<max+1>`, `C-<max+2>`, ... For each computed id, check no `cadence/designs/DS-<n>.md` (or legacy `cadence/designs/<id>*.md`) already exists (an abandoned refine/breakdown draft may hold it); if one does, warn the user and skip forward to the next free id -- never overwrite silently.
   - Each child `C-<n>` gets a design `DS-<n>` and an item note `US-<n>` (story) or `TK-<n>` (task). Write `cadence/designs/DS-<n>.md` for each child:

         ---
         type: design
         tags: []
         created: <today, YYYY-MM-DD>
         updated: <today, YYYY-MM-DD>
         related: ["[[<US-n|TK-n>]]", "[[DS-<parent n>]]"]
         sources: []
         ---

         # <child-id>: <title> -- Design

         ## Parent
         Part of [[<parent item note>]] -- see [[DS-<parent n>]] for the umbrella rationale.

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

   - Write each child's item note -- `cadence/user-stories/US-<n>.md` for stories, `cadence/tasks/TK-<n>.md` for tasks:

         ---
         type: <story|task>
         tags: []
         aliases: ["<child-id>", "<title>"]
         created: <today, YYYY-MM-DD>
         updated: <today, YYYY-MM-DD>
         related: ["[[DS-<n>]]", "[[<parent item note>]]"]
         ---

         # <child-id>: <title>

         <one-paragraph description>

         - Design: [[DS-<n>]]
         - Parent: [[<parent item note>]]

   - Update the parent's item note: add each child under a `Children:` list as `[[US-<n>]]`/`[[TK-<n>]]`, add them to `related`, and set `updated` to today. (A legacy parent with no item note yet: create one now in its type's folder, following the format above.)
   - Write each child's design doc and item note as one pass per child -- they cross-link. Before finishing, confirm every [[wikilink]] added across all children resolves to an existing note filename (list_unresolved_links); an unresolved link is a click-trap that mints a stray note in Obsidian.

   - Append each child to `cadence/backlog.yml`:

         - id: <child-id>
           title: "<title>"
           type: <story|task>
           parent: <parent-id>
           status: idea
           points: <points>
           assignee: <claude|human>
           created: <today, YYYY-MM-DD>
           updated: <today, YYYY-MM-DD>

     (Tracking fields only -- each child's description and criteria live in its design doc and item note, never in YAML.)

   - Update the parent in `cadence/backlog.yml`: it is now a container. If its `status` was `ready`, set it back to `idea` (containers never enter sprints; the children do). Set `updated` to today.
8. If the dialogue surfaced something worth remembering (a scoping decision, a rejected split and why), dispatch the `brain-curator` agent with a short description of it.
9. Tell the user the breakdown is recorded and that each child needs `/cadence:spec <child-id>` to become `ready`.

## Inputs

`cadence/backlog.yml`, `cadence/sprint.yml` and `cadence/sprints/*.yml` (id computation only), the parent's design doc, the vault's markdown notes.

## Outputs

`cadence/designs/DS-<n>.md` and an item note (`cadence/user-stories/US-<n>.md` or `cadence/tasks/TK-<n>.md`) per child, the parent's item note (children linked), `cadence/backlog.yml` (children appended with `status: idea`; parent's `status`/`updated` adjusted).

## Error handling

- **Id not in the backlog:** refuse; point at `/cadence:refine` (not created) or explain sprint items can't be broken down (already planned).
- **Item is a task:** refuse; suggest re-examining the parent story's breakdown instead.
- **No design doc for the item:** refuse; direct the user to `/cadence:refine` first.
- **Parent already has children:** this is a second breakdown pass. List the existing children first and only propose additions that don't overlap them; never duplicate a child that already exists.
- **User keeps rejecting proposals:** keep revising; if the disagreement is about the parent's scope itself, recommend revisiting `/cadence:refine`'s design doc rather than forcing a split.
- **Malformed YAML in backlog.yml:** surface the parse error and ask the user to fix it by hand -- never guess or auto-repair.
