---
name: cadence-quick
description: Fast lane for trivial work and bug fixes. Creates a small task or story with inline acceptance criteria and adds it directly to the current sprint after one approval -- no design doc, no spec, no waiting for sprint planning. Only invoke when dispatched by the /cadence:quick command, cadence-conversate routing, or cadence-systematic-debugger's bug handoff.
argument-hint: "[short description]"
user-invocable: false
---

# Quick

<important>
- The fast lane is for trivial work only: 2 points maximum, no children, no open design questions. If sizing or approach needs discussion, it is not trivial -- refuse and route to /cadence:refine.
- One approval gate replaces refine's and spec's: do not write anything until the user confirms the item (title, criteria, points) and its destination in one go.
- Acceptance criteria are mandatory even here -- /cadence:review needs something checkable. They live inline in the item note; quick items get no design doc and no spec file.
- Quick items added to a running sprint are marked added_mid_sprint: true so standup can report scope growth honestly. This lane adds visibility, never invisibility.
- Search the vault before creating anything -- the fix or feature may already exist as a ticket or a brain note.
</important>

## Purpose

Lets a typo fix, small chore, or diagnosed bug become a tracked, reviewable
sprint item in one step, instead of forcing three approvals and a sprint
boundary onto two-point work. Agility with a paper trail.

## Process

1. Search the vault for notes or existing tickets related to the description ($ARGUMENTS). If an open item already covers it, point there and stop.
2. Assess triviality: estimate points. Above 2 points, multiple deliverables, or an unresolved design choice -> refuse and route to `/cadence:refine` (quote the reason). Bug fixes handed off by `cadence-systematic-debugger` arrive with a confirmed root cause -- include it in the description.
3. Draft the item: a clear title, one-paragraph description, 1-3 concrete acceptance criteria, points (1-2), assignee (`claude` unless the user says otherwise), and type (`task` by default; `story` if the user frames it as user-facing scope). For a bug, note the root cause in the description and tag the item note `bug`.
4. Determine the destination:
   - `cadence/sprint.yml` exists and is active -> the item joins it with `status: todo` and `added_mid_sprint: true`.
   - No active sprint -> the item goes to `cadence/backlog.yml` with `status: ready` (it needs no further gates), and say the next `/cadence:sprint-plan` will pick it up.
5. Present the drafted item and destination; ask for one explicit approval. Revise on request. Write nothing until approved.
6. Once approved:
   - Mint the id: scan `cadence/backlog.yml`, `cadence/sprint.yml`, and `cadence/sprints/*.yml` for existing `C-<N>` ids; the new id is `C-<max+1>`.
   - Write the item note -- `cadence/tasks/TK-<n>.md` or `cadence/user-stories/US-<n>.md`:

         ---
         type: <task|story>
         tags: []            # add bug for bug fixes
         aliases: ["<id>", "<title>"]
         created: <today, YYYY-MM-DD>
         updated: <today, YYYY-MM-DD>
         related: []
         ---

         # <id>: <title>

         <one-paragraph description; for bugs: the confirmed root cause>

         ## Acceptance criteria
         - <criterion 1>
         - <criterion 2>

   - Append the item to the destination from step 4 (sprint items also get `carryovers: 0`, `notes: ""`).
   - Confirm every [[wikilink]] added resolves to an existing note filename; quick notes usually link nothing, which is fine.
7. Tell the user the item is in, and what runs it: `/cadence:work <id>` (or that it queues behind the current `in_progress` item -- one thing at a time).

## Inputs

`cadence/backlog.yml`, `cadence/sprint.yml`, `cadence/sprints/*.yml` (id computation), the vault's markdown notes.

## Outputs

One item note (`cadence/tasks/TK-<n>.md` or `cadence/user-stories/US-<n>.md`) with inline acceptance criteria, one entry in `cadence/sprint.yml` (marked `added_mid_sprint: true`) or `cadence/backlog.yml` (`status: ready`).

## Error handling

- **Work is bigger than 2 points or needs a design conversation:** refuse; route to `/cadence:refine`. Do not "quick" it in pieces to dodge the cap.
- **An existing ticket already covers it:** point to that ticket instead of minting a duplicate.
- **User approval not given:** write nothing; revise or stop.
- **Malformed YAML in a board file:** surface the parse error and ask the user to fix it by hand -- never guess or auto-repair.
