---
name: cadence-core
description: Cadence's non-negotiable workflow rules -- gate order, TDD, brain-check-first, commit conventions, and core values. Auto-loads whenever a cadence skill (refine, breakdown, spec, sprint-plan, quick, drop, work, review, standup, board, conversate, brainstorm, systematic-debugger, code-reviewer) is active.
user-invocable: false
---

# Cadence Core Rules

<important>
- Never skip a gate: idea -> design approved -> spec approved -> ready -> todo -> in_progress -> review -> done. Each arrow requires the named approval or check to have actually happened, not been assumed. One sanctioned shortcut exists: /cadence:quick (trivial work and diagnosed bugs, 2 points max, criteria inline in the item note, one approval) -- it lands at todo or ready directly. Nothing else skips gates, and quick refuses work that deserves the full pipeline.
- The current sprint always lives at cadence/sprint.yml; completed sprints are archived immutably under cadence/sprints/. The board YAML holds tracking fields only (id, title, type, parent, status, points, assignee, carryovers, notes) -- descriptions and acceptance criteria live in the vault notes and specs, never duplicated into YAML.
- Cancelled work is dropped, never deleted: /cadence:drop sets status: dropped with a recorded reason. Hand-deleting board entries erases history.
- The board is a two-level hierarchy at most: epic -> story -> task, tracked with optional type and parent fields (absent type means story). Epics and containers (items another item names as parent) never enter a sprint and are never spec'd -- /cadence:breakdown splits them, and only leaf items flow through the gates.
- Never let the implementer self-certify "done." Only /cadence:review, via the cadence-reviewer agent, can move an item to done. One derived exception: when the last child of an epic/story passes review, /cadence:review flips that parent to done as a rollup of its reviewer-certified children.
- Only one item in the active sprint may be status: in_progress at a time. /cadence:work refuses to start a second ticket while another is already in_progress -- finish it (move it to review or done) first. This keeps /cadence:review's diff scoped to exactly one ticket's changes.
- Interrupts respect that rule: a bug related to the in_progress item is fixed within that item (same diff, same review); an unrelated bug becomes a quick task that runs right after the in_progress item finishes -- never two half-done things at once.
- Every skill searches the vault's notes (cadence/brain/, decisions/, architecture/, item notes -- the search_notes MCP tool indexes them all) before starting new work, and surfaces what it finds -- including conflicting notes -- before proceeding.
- Whenever any cadence skill notices something worth remembering (an architectural decision, a gotcha, a recurring blocker), dispatch the brain-curator agent opportunistically with a short description, not only for the estimate-mismatch case in /cadence:review. This applies to refine, breakdown, sprint-plan, quick, drop, work, systematic-debugger, and code-reviewer too (standup is read-only and never dispatches it; spec is a mechanical translation step with nothing new to surface).
- /cadence:work follows TDD: write the failing test first, then the minimal code to pass it. Defer to the superpowers:test-driven-development skill if it is installed.
- Commits made by /cadence:review never include an Anthropic or Claude co-author tag, and never use --no-verify.
- Malformed YAML in any cadence/*.yml file: surface the parse error and ask the user to fix it by hand. Never guess or auto-repair.
- If a requirement, acceptance criterion, or user request is ambiguous, ask before proceeding. Do not guess.
</important>

## Purpose

This is the shared rulebook every other cadence skill assumes. It has no command of its own. Its description is written so Claude loads it automatically whenever cadence work is underway, reinforcing these rules alongside the plugin's UserPromptSubmit hook.

## Core values

1. **Token economy.** Keep skill and prompt text concise. Do not re-read files already in the conversation. Dispatch an agent only when independence or isolation is structurally required -- this is why cadence has exactly four agents and no more: cadence-reviewer (independent judgment), cadence-coder (context-isolated implementation), brain-curator (cheap isolated note writing), pitch-agent (anchoring-free perspectives for brainstorm's gated panel).
2. **Simplicity first.** Smallest viable file and field structure. No speculative abstraction, no unrequested features.
3. **Anti-hallucination.** Verify any technical or factual claim not directly checkable in the current codebase (web search, cite the source) before asserting it. Below roughly 98% confidence, say so plainly instead of asserting.
4. **No AI sloppiness.** Every markdown file cadence produces or edits -- skills, design docs, spec docs, brain notes -- uses short declarative sentences, active voice, no filler, no hedge-padding, no restating the obvious, no emoji.

This skill is reference material only -- it has no process, inputs, or outputs of its own. See the skill that is actually running for its steps and error handling.
