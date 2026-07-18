---
name: turnstile-quick
description: Fast lane for trivial work and diagnosed bugs -- small item with inline criteria, one approval, no design or spec. Dispatched by /turnstile:quick, conversate routing, or systematic-debugger only.
argument-hint: "[short description]"
user-invocable: false
---

# Quick

<important>
- The fast lane is for trivial work only: no children, no open design questions, and at most quick_max_points points -- read the ceiling with `node ${CLAUDE_PLUGIN_ROOT}/scripts/config.js` (default 3; surface any config warnings once). If sizing or approach needs discussion, it is not trivial -- refuse and route to /turnstile:refine. Never "quick" bigger work in pieces to dodge the cap.
- One approval gate replaces refine's and spec's: do not write anything until the user confirms the item (title, criteria, points) and its destination in one go.
- Acceptance criteria are mandatory even here -- /turnstile:review needs something checkable. They live inline in the item note; quick items get no design doc and no spec file.
- Quick items added to a running sprint are marked added_mid_sprint: true so standup can report scope growth honestly. This lane adds visibility, never invisibility.
- Search the vault before creating anything -- the fix or feature may already exist as a ticket or a brain note.
- Before writing the item note, Read references/template.md from this skill's base directory and use that exact format.
</important>

## Process

1. Search the vault for notes or existing tickets related to the description ($ARGUMENTS). If an open item already covers it, point there and stop.
2. Assess triviality: estimate points. Above the quick_max_points ceiling, multiple deliverables, or an unresolved design choice -> refuse and route to `/turnstile:refine` (quote the reason and the ceiling). Bug fixes handed off by `turnstile-systematic-debugger` arrive with a confirmed root cause -- include it in the description.
3. Draft the item: clear title, one-paragraph description, 1-3 concrete acceptance criteria, points (1 up to the ceiling), assignee (`claude` unless told otherwise), type (`task` by default; `story` if user-facing scope). For a bug, note the root cause in the description and tag the item note `bug`.
4. Determine the destination:
   - `turnstile/sprint.yml` exists and is active -> the item joins it with `status: todo` and `added_mid_sprint: true`.
   - No active sprint -> `turnstile/backlog.yml` with `status: ready` (no further gates needed); say the next `/turnstile:sprint-plan` will pick it up.
5. Present the drafted item and destination; ask for one explicit approval. Revise on request. Write nothing until approved.
6. Once approved: mint the id (scan `turnstile/backlog.yml`, `turnstile/sprint.yml`, `turnstile/sprints/*.yml` for `C-<N>` ids; new id is `C-<max+1>`), write the item note per the template reference, append the item to the destination, and confirm any [[wikilink]] added resolves (quick notes usually link nothing, which is fine).
7. Tell the user the item is in, and what runs it: `/turnstile:work <id>` (or that it queues behind the current `in_progress` item -- one thing at a time).

## Error handling

- **An existing ticket already covers it:** point there instead of minting a duplicate.
- **Malformed YAML in a board file:** surface the parse error and ask the user to fix it by hand -- never guess or auto-repair.
