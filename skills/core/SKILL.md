---
name: core
description: Cadence's non-negotiable workflow rules -- gate order, TDD, brain-check-first, commit conventions, and core values. Auto-loads whenever a cadence skill (refine, spec, plan, work, review, standup, board, go) is active.
user-invocable: false
---

# Cadence Core Rules

<important>
- Never skip a gate: idea -> design approved -> spec approved -> ready -> todo -> in_progress -> review -> done. Each arrow requires the named approval or check to have actually happened, not been assumed.
- Never let the implementer self-certify "done." Only /cadence:review, via the cadence-reviewer agent, can move an item to done.
- Only one item in the active sprint may be status: in_progress at a time. /cadence:work refuses to start a second ticket while another is already in_progress -- finish it (move it to review or done) first. This keeps /cadence:review's diff scoped to exactly one ticket's changes.
- Every skill searches cadence/brain/ for related notes before starting new work, and surfaces what it finds -- including conflicting notes -- before proceeding.
- Whenever any cadence skill notices something worth remembering (an architectural decision, a gotcha, a recurring blocker), dispatch the brain-curator agent opportunistically with a short description, not only for the estimate-mismatch case in /cadence:review. This applies to refine, plan, and work too (standup is read-only and never dispatches it; spec is a mechanical translation step with nothing new to surface).
- /cadence:work follows TDD: write the failing test first, then the minimal code to pass it. Defer to the superpowers:test-driven-development skill if it is installed.
- Commits made by /cadence:review never include an Anthropic or Claude co-author tag, and never use --no-verify.
- Malformed YAML in any cadence/*.yml file: surface the parse error and ask the user to fix it by hand. Never guess or auto-repair.
- If a requirement, acceptance criterion, or user request is ambiguous, ask before proceeding. Do not guess.
</important>

## Purpose

This is the shared rulebook every other cadence skill assumes. It has no command of its own. Its description is written so Claude loads it automatically whenever cadence work is underway, reinforcing these rules alongside the plugin's UserPromptSubmit hook.

## Core values

1. **Token economy.** Keep skill and prompt text concise. Do not re-read files already in the conversation. Dispatch an agent only when independence or isolation is structurally required -- this is why cadence has exactly two agents (cadence-reviewer, brain-curator) and no more.
2. **Simplicity first.** Smallest viable file and field structure. No speculative abstraction, no unrequested features.
3. **Anti-hallucination.** Verify any technical or factual claim not directly checkable in the current codebase (web search, cite the source) before asserting it. Below roughly 98% confidence, say so plainly instead of asserting.
4. **No AI sloppiness.** Every markdown file cadence produces or edits -- skills, design docs, spec docs, brain notes -- uses short declarative sentences, active voice, no filler, no hedge-padding, no restating the obvious, no emoji.

## Process

This skill has no steps of its own -- it is reference material other cadence skills rely on.

## Inputs

None.

## Outputs

None.

## Error handling

Not applicable -- see the skill that is actually running for its error handling.
