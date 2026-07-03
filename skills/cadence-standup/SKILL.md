---
name: cadence-standup
description: Read-only report of progress and blockers on the active sprint, plus relevant brain notes. Use for a quick status check on cadence work.
user-invocable: false
---

# Standup

<important>
Read-only. Never change status, files, or the board while running this skill.
</important>

## Purpose

Gives a quick, honest snapshot of where the active sprint stands, without touching anything.

## Process

1. Read the current sprint -- `cadence/sprint.yml`, or (legacy boards) the root `cadence/sprint-*.yml` with `sprint.status: active`. If none exists, tell the user and suggest `/cadence:sprint-plan`.
2. List every item in it: id, title, status, and the last `notes` entry (if any). Then report scope honestly: total points, points `done`, and -- if any item has `added_mid_sprint: true` -- "N of M points were added mid-sprint" so quiet scope growth is visible. If mid-sprint additions dominate sprint after sprint, that is a process learning worth a `brain-curator` dispatch... except standup is read-only: surface it and suggest the user let the next gated skill record it.
3. Search the vault for notes related to items currently `in_progress` or `review`; surface anything relevant, especially anything that looks like a blocker.
4. Ask the user what they want to focus on today.

## Inputs

`cadence/sprint.yml` (the current sprint), the vault's markdown notes.

## Outputs

None -- read-only.

## Error handling

- **No active sprint:** tell the user, suggest `/cadence:sprint-plan`.
