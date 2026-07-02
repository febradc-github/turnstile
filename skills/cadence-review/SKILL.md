---
name: cadence-review
description: Dispatches the independent cadence-reviewer agent to verify a ticket is actually done. On pass, commits the change. Gate 2 of the cadence workflow -- the implementer never self-certifies. Only invoke when dispatched by the /cadence:review command or cadence-conversate routing.
argument-hint: "[id]"
user-invocable: false
---

# Review

<important>
- Never mark an item done yourself. Only a PASS verdict from the cadence-reviewer agent can move status to done.
- Never commit on a FAIL verdict.
- Commits never include an Anthropic or Claude co-author tag, and never use --no-verify (see the brain skill's commit convention).
- Before dispatching cadence-reviewer, confirm no *other* item in the active sprint is also in_progress or has uncommitted changes of its own. /cadence:work enforces one in_progress item at a time, but if you find uncommitted changes unrelated to this ticket anyway (e.g. from manual edits outside the workflow), stop and ask the user rather than bundling them into this ticket's diff, review, or commit.
</important>

## Purpose

The done-ness gate. An implementer judging their own work is unreliable, so this skill hands the verdict to an isolated agent with no memory of the implementation session.

## Process

1. Look up `<id>` (from `$ARGUMENTS`) in the active sprint file (the `cadence/sprint-*.yml` with `sprint.status: active`). If not found, or its `status` isn't `in_progress` or `review`, refuse and tell the user what to do instead (e.g. run `/cadence:work <id>` first, or `/cadence:sprint-plan` if no active sprint exists). A `status: review` item means a prior review session was interrupted before reaching a verdict -- tell the user that, then resume from step 3.
2. Set the item's `status` to `review`.
3. Read `cadence/specs/<id>.md` for its acceptance criteria.
4. Get the diff of what changed for this ticket (`git diff` / `git status` against the last commit). Since `/cadence:work` enforces only one `in_progress` item at a time, this diff should represent exactly this ticket's changes; if `git status` shows unrelated uncommitted changes anyway, stop and ask the user before proceeding rather than folding them into this ticket's review or commit.
5. Dispatch the `cadence-reviewer` agent via the Task tool, passing only the acceptance criteria and the diff -- no implementation-session narrative or reasoning.
6. If the agent's verdict is FAIL:
   - Set the item's `status` back to `in_progress`.
   - Append the agent's per-criterion reasons to the item's `notes` field.
   - Tell the user what needs to change. Do not commit.
7. If the agent's verdict is PASS:
   - Set the item's `status` to `done`.
   - Compare `points` against the coarse actual-effort signals already on hand: `carryovers` and the number of "work pass" entries logged in `notes` (from `/cadence:work`). If `carryovers > 0` or there are 3+ work passes against a `points` estimate of 3 or less (or an equivalent clear mismatch), dispatch the `brain-curator` agent with that observation as a candidate process learning. Do not claim wall-clock timing -- only these coarse counts.
   - Stage the changed files together with the updated active sprint file (so the `done` status and `notes` update land in the same commit as the implementation, not as a separate uncommitted change) and commit: `git commit -m "<verb>: <title> (<id>)"` following the brain skill's commit message convention (no Anthropic/Claude co-author tag, no `--no-verify`).
   - Tell the user the ticket is done and committed.

## Inputs

The active `cadence/sprint-*.yml`, `cadence/specs/<id>.md`, `git diff`/`git status`.

## Outputs

The active sprint file (item's `status` and `notes` updated), one git commit on PASS, a `brain-curator` dispatch on a meaningful estimate mismatch.

## Error handling

- **No active sprint, or id not in it:** tell the user; suggest `/cadence:sprint-plan` or `/cadence:work <id>` as appropriate.
- **Not a git repository, or no commits yet:** tell the user review needs git history to scope the ticket's diff; suggest `git init` and an initial commit, then re-run. Do not review against an unscoped file tree.
- **Item not in_progress (e.g. still todo):** refuse; tell the user to run `/cadence:work <id>` first.
- **Item already status: review:** a prior review session was interrupted before its verdict; resume the review rather than refusing -- this is the only recovery path short of hand-editing the sprint file.
- **cadence-reviewer reports FAIL:** item stays in_progress; reasons appended to notes; nothing committed.
