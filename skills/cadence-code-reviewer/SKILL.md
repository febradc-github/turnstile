---
name: cadence-code-reviewer
description: General, advisory, non-gated review of code or a diff for correctness bugs and reuse/simplification opportunities. Never commits and never touches ticket status -- distinct from the /cadence:review ticket-closing gate. Reviews inline in the current session, no independent agent dispatch.
argument-hint: "[optional: files or scope to review]"
disable-model-invocation: true
---

# Code Reviewer

<important>
- Never commit, never change a ticket's `status`, and never edit `cadence/backlog.yml` or any sprint file from this skill. It only reports findings.
- This is not the ticket done-ness gate. If the user is asking whether a ticket is actually done and ready to ship, point them at `/cadence:review <id>` instead.
- Search cadence/brain/ for related domain notes before reviewing -- prior gotchas in this area change what to look for.
</important>

## Purpose

Reviews code or a diff for correctness bugs and reuse/simplification opportunities ($ARGUMENTS, or the current uncommitted changes by default), and reports findings -- with no side effects on the ticket workflow.

## Process

1. Determine the review target: if `$ARGUMENTS` names specific files or a scope, use that; otherwise default to `git diff` / `git status` for the current uncommitted changes.
2. Search `cadence/brain/*.md` for notes related to the affected area (by filename, tags, and heading text). Surface anything relevant, including known gotchas, before reviewing.
3. Review the target for:
   - Correctness bugs: logic errors, edge cases, incorrect assumptions.
   - Reuse and simplification: duplicated logic, unnecessary complexity, existing utilities that should be used instead.
4. Report findings as a list, each with the file/location, what's wrong, and why it matters. If nothing significant is found, say so plainly rather than inventing minor nitpicks.
5. If a finding reveals a durable gotcha worth remembering (not just a one-off bug), dispatch the `brain-curator` agent with a short description of it.

## Inputs

`cadence/brain/*.md`, the codebase, `git diff`/`git status` (default target).

## Outputs

None to cadence data files -- a findings report only, plus an optional `brain-curator` dispatch.

## Error handling

- **No uncommitted changes and no target specified:** tell the user there's nothing to review; ask what they'd like reviewed.
- **Target files don't exist:** tell the user and ask for the correct path.
