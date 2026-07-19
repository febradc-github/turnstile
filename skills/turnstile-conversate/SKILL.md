---
name: turnstile-conversate
description: Entry point for natural-language turnstile requests -- classifies the message against board state, then answers directly or invokes the one matching skill (brainstorm, quick, refine, spec, sprint-plan, work, review, breakdown, drop, systematic-debugger, code-reviewer).
argument-hint: "[what you want]"
user-invocable: false
---

# Conversate

<important>
- Always invoke the matched skill directly via the Skill tool rather than merely telling the user which command to run. The invoked skill's own internal approval gates (design-doc approval in refine, spec approval in spec, sprint-goal requirement in sprint-plan, etc.) are the actual safety mechanism -- conversate's job is routing, not gating.
- For any question about what code does or how something is implemented: check `turnstile/code/` first (`search_notes`/`read_note`) -- do not reach for Grep/Read as the first move. A matching note exists more often than not once `/turnstile:brain-init` has run. See the matching case below for the read-note-then-verify-source procedure.
- Never perform a gated skill's effects yourself inline (never write a design doc or item note directly, never edit a `turnstile/code/` note -- only brain-curator writes notes). Only ever: (a) answer a read-only question directly -- which may include dispatching brain-curator to correct a drifted code note -- or (b) invoke exactly one matching skill.
- If genuinely ambiguous, ask one clarifying question instead of guessing which skill to invoke.
</important>

## Process

1. Read `turnstile/backlog.yml` (if it exists) and the current sprint -- `turnstile/sprint.yml`, or a legacy root `turnstile/sprint-*.yml` with `sprint.status: active` -- to build a status snapshot.
2. Match the user's request ($ARGUMENTS plus their message) against these cases, in order:
   - **Status or "what's on the board":** answer directly from the snapshot (same content as `/turnstile:board`). No skill invocation.
   - **Returning to work -- "where was I", "what was I doing", "pick up where I left off":** invoke `turnstile-pickup`. It restores work state from the board and vault (unlike the built-in /resume, which restores a past conversation), and offers to un-park the most recently parked ticket when nothing is in progress.
   - **An interrupt -- "pause this", "park this", "something urgent came up" while an item is in_progress:** invoke `turnstile-park` with any stated reason.
   - **What a piece of code does / how something is implemented:** check `turnstile/code/` via `search_notes`/`read_note`. If a note exists, read the source file at its `aliases` path and compare. Still matching: answer directly, citing the verified file. Drifted: answer from the file -- source is truth -- and dispatch `brain-curator` (opportunistic mode, this one file, with the purpose/exports/imports/callers you observed) to correct the note. No note: answer via Grep/Read as usual -- do not dispatch brain-curator just to backfill missing coverage; that's `/turnstile:brain-init`'s job. No skill invocation.
   - **A brand-new idea not on the board:** invoke `turnstile-brainstorm` with the description. Exception: clearly trivial work (a typo, a tiny chore, within the quick ceiling -- quick_max_points, default 3 -- with no design question) goes to `turnstile-quick` instead.
   - **Something broken (an error, failing test, unexpected behavior):** invoke `turnstile-systematic-debugger` with the report. It diagnoses first, then routes the fix.
   - **"Remember this" / a fact or decision the user wants recorded in the vault:** invoke `turnstile-remember` with the user's words.
   - **Cancel, kill, or drop an item:** invoke `turnstile-drop` with that id.
   - **A code review or feedback on a diff:** invoke `turnstile-code-reviewer`.
   - **Breaking an item into smaller pieces (or an epic with no children yet):** invoke `turnstile-breakdown` with that id.
   - **An existing item the user wants to move forward:**
     - `type: epic`, or another item names it as `parent`: containers don't move through gates. No children yet: invoke `turnstile-breakdown`; otherwise report the children's statuses and route to the child at the earliest gate.
     - `status: idea` -> invoke `turnstile-spec` with that id. (An item only reaches `idea` after refine's design approval, so a design doc always exists -- never invoke `turnstile-refine`, which mints a brand-new id and cannot resume an existing item.)
     - `status: ready`, not in any sprint file -> invoke `turnstile-sprint-plan` (or `turnstile-next` when `turnstile/config.yml` says `cadence: flow`).
     - In the active sprint, `status: in_progress`, and the user says the work is finished -> invoke `turnstile-review` with that id. Check this before the next case.
     - In the active sprint, `status: todo` or `in_progress` (not being called finished) -> invoke `turnstile-work` with that id.
     - In the active sprint, `status: review` -> an interrupted review; if the user wants a verdict, invoke `turnstile-review` (it resumes). Otherwise report the status.
     - On the active board, `status: parked` -> invoke `turnstile-pickup`; it reads the resume note and offers the un-park.
     - In the active sprint, `status: done` -> already shipped; say so. No skill.
     - `status: dropped` -> cancelled; relay the recorded reason. No skill.
   - **Starting a new sprint:** invoke `turnstile-sprint-plan` (in `cadence: flow` it explains the mode instead of planning).
   - **"What should I work on next" / pulling the next piece of work in `cadence: flow`:** invoke `turnstile-next`.
   - **Anything ambiguous:** ask one clarifying question.

## Error handling

- **No backlog or sprint files yet:** the board is empty -- suggest describing what to build so it can route to `turnstile-brainstorm`.
- **Invoked skill refuses (malformed YAML, missing design doc):** relay its refusal; do not retry with a different skill.
