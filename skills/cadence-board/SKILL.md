---
name: cadence-board
description: Read-only render of the current backlog and active sprint state. Use to see the whole board at a glance.
user-invocable: false
---

# Board

<important>
Read-only. Never change status, files, or content while running this skill.
</important>

## Purpose

Renders the full board -- backlog plus active sprint -- as a readable snapshot, with no side effects.

## Process

1. Read `cadence/backlog.yml` (if it exists). Render its items as a table: id, title, type (`epic`/`story`/`task`; blank means story), status (`idea`/`ready`/`done`), points. Group hierarchically: each epic first, its children indented beneath it (and their tasks beneath them), then flat items. For every container, append child progress to its row: `<done children>/<total children> done`, counting children across the backlog and all sprint files.
2. Find the `cadence/sprint-*.yml` with `sprint.status: active` (if any). Render its goal and items as a table: id, title, parent (when set), status (`todo`/`in_progress`/`review`/`done`), points, carryovers.
3. If neither file exists yet, tell the user the board is empty and suggest `/cadence:refine <idea>` to start.

## Inputs

`cadence/backlog.yml`, every `cadence/sprint-*.yml`.

## Outputs

None -- read-only.

## Error handling

- **Malformed YAML in a board file:** surface the parse error and ask the user to fix it by hand -- never guess or auto-repair.
