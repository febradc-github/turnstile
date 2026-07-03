---
name: cadence-drop
description: Cancels a ticket. Sets status dropped with a recorded reason, keeping the item visible as history instead of hand-deleting YAML. Only invoke when dispatched by the /cadence:drop command or cadence-conversate routing.
argument-hint: "[id] [reason]"
user-invocable: false
---

# Drop

<important>
- Dropping is cancellation with a paper trail, not deletion. Never remove the item's YAML entry or its notes -- set status: dropped and record why.
- Confirm with the user before writing: state the item, where it lives, and the reason that will be recorded.
- A dropped item's files (item note, design, spec) stay in the vault as history.
</important>

## Purpose

Gives cancelled work an honest ending. Without this, the only way to kill a
ticket is hand-editing the board, which erases the record that it existed.

## Process

1. Look up `<id>` (from `$ARGUMENTS`) in `cadence/backlog.yml` and `cadence/sprint.yml`. Not found in either: refuse (archived items are history and cannot be dropped).
2. If the item is `in_progress`, warn the user there may be uncommitted implementation changes from `/cadence:work`; ask whether to discard, keep, or commit them separately before dropping. Do not silently strand a half-done diff.
3. If the item is a container (an epic or story with children), list its non-done children and ask whether they drop too -- a dropped parent with live children is usually a mistake. Drop each confirmed child the same way.
4. Confirm: item id and title, its current status and location, and the reason (from `$ARGUMENTS`, or ask for one -- a few words suffice). No reason, no drop.
5. Once confirmed, for the item (and each confirmed child):
   - Set `status: dropped` in its board file and set `updated` to today (backlog items) or append `dropped: <reason>` to `notes` (sprint items).
   - Update its item note: set `updated`, and add a line `Dropped <YYYY-MM-DD>: <reason>` under the heading.
6. If the reason is a process learning (e.g. repeatedly planning work that gets cancelled), dispatch the `brain-curator` agent with it.
7. Tell the user what was dropped and where the record lives.

## Inputs

`cadence/backlog.yml`, `cadence/sprint.yml`, the item's note.

## Outputs

The item's board entry (`status: dropped`, reason recorded), its item note (drop line added).

## Error handling

- **Id not found or only in an archive:** refuse; archives are immutable history.
- **User declines the children cascade:** drop only the parent if they insist, but warn the children now reference a dropped parent.
- **No reason given after asking:** do not drop; an unexplained cancellation is future confusion.
- **Malformed YAML in a board file:** surface the parse error and ask the user to fix it by hand -- never guess or auto-repair.
