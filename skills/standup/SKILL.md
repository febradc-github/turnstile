---
name: standup
description: Read-only report of progress and blockers on the active sprint, plus relevant brain notes. Use for a quick status check on cadence work.
---

# Standup

<important>
Read-only. Never change status, files, or the board while running this skill.
</important>

## Purpose

Gives a quick, honest snapshot of where the active sprint stands, without touching anything.

## Process

1. Find the `cadence/sprint-*.yml` with `sprint.status: active`. If none exists, tell the user and suggest `/cadence:sprint-plan`.
2. List every item in it: id, title, status, and the last `notes` entry (if any).
3. Search `cadence/brain/*.md` for notes related to items currently `in_progress` or `review`; surface anything relevant, especially anything that looks like a blocker.
4. Ask the user what they want to focus on today.

## Inputs

The active `cadence/sprint-*.yml`, `cadence/brain/*.md`.

## Outputs

None -- read-only.

## Error handling

- **No active sprint:** tell the user, suggest `/cadence:sprint-plan`.
