---
name: cadence-brainstorm
description: Loose, exploratory dialogue for a not-yet-scoped idea -- purpose, rough shape, and alternatives, with no file writes. Epic-scale ideas can convene a pitch-agent panel (minimalist/skeptic/scout) for unanchored perspectives. Hands off to /cadence:refine once the idea is concrete enough to formalize into a ticket. Only invoke when dispatched by the /cadence:brainstorm command or cadence-conversate routing.
argument-hint: "[rough idea]"
user-invocable: false
---

# Brainstorm

<important>
- Never write to cadence/backlog.yml, cadence/designs/, or any other cadence data file from this skill -- brainstorming has no side effects. Only `cadence-refine` writes the design doc and backlog entry.
- Do not ask for acceptance criteria, a points estimate, or an assignee -- those belong to `cadence-refine`. Keep questions open-ended and exploratory.
- Search the vault (brain, decisions, architecture, item notes) for related notes before starting the dialogue, and surface what you find.
- The pitch panel is gated: dispatch pitch-agent only for epic-scale ideas (multiple independent deliverables, or a clear >8-point feel) or when the user asks for more perspectives. Trivial ideas get no panel -- it would be token theater.
- Panelists never see the dialogue. Pass each one only the idea summary, its stance, and the step-1 vault findings -- an unanchored take is the entire point of dispatching them.
</important>

## Purpose

Turns a vague idea ($ARGUMENTS) into a clear enough shape that `/cadence:refine` can formalize it -- the loose stage before the strict gap-closing gate.

## Process

1. Search the vault (brain, decisions, architecture, and existing item notes -- the search_notes MCP tool indexes all of them) for notes related to the idea's topic. Surface anything relevant, including conflicts, before continuing.
2. Run an open-ended, one-question-at-a-time dialogue with the user to explore:
   - What problem this actually solves and for whom.
   - The rough shape of an approach (not a full design -- just enough to know it's worth formalizing).
   - How it would sit in the existing system: which components it touches, and whether any `cadence/architecture/` or `cadence/decisions/` note found in step 1 supports or conflicts with it. Surfacing an architectural conflict here is cheaper than discovering it in refine.
   - Any alternatives briefly considered and why this direction seems right.
3. **Pitch panel (gated -- see the rules above).** If the idea is epic-scale or the user asks for perspectives, offer the panel; on yes, dispatch the `pitch-agent` agent three times in parallel, one stance each -- minimalist, skeptic, scout (swap in a custom stance if the user names one). Each dispatch gets only: a two-or-three-sentence idea summary, the stance, and the relevant step-1 vault findings. Never the dialogue transcript.
4. Synthesize the pitches yourself: deduplicate overlap, keep genuinely distinct directions (usually 2-3), and present them compactly -- each direction with its strongest argument and biggest risk, quoting a pitch where it's sharp. Let the user pick, mix, or reject; the dialogue continues from their reaction. Panel output is advisory input to the conversation, never a decision.
5. Keep exploring until the idea is concrete enough that `cadence-refine` could immediately start asking its own (stricter) questions without having to re-derive the basic problem statement.
6. Summarize the idea in two or three sentences and confirm with the user that it's ready to formalize.
7. Once confirmed, invoke the `cadence-refine` skill, passing the summary as its starting description -- including any architecture observations, tentative design directions from step 2, and the panel's rejected directions with why (refine's curator dispatch records the decision trail; brainstorm itself still writes nothing).

## Inputs

The vault's markdown notes (`cadence/brain/`, `cadence/decisions/`, `cadence/architecture/`, item notes).

## Outputs

None directly -- this skill only explores and summarizes; `cadence-refine` (invoked at the end) performs the actual writes.

## Error handling

- **User's idea stays vague after several rounds of questions:** keep asking narrower open-ended questions; do not force a summary or hand off to refine until there's an actual problem statement.
- **Panel pitches all converge on the same take:** say so honestly and present it as one direction -- do not manufacture fake disagreement. The panel is the same underlying model arguing stances; useful spread, not independent minds.
- **A pitch contradicts a recorded ADR:** that is the skeptic doing its job -- surface the conflict to the user explicitly.
- **User describes something that already exists in the backlog or a sprint:** point this out and ask whether they mean to extend that existing item instead (in which case they should be routed to the appropriate gate for that item, not refine, which only mints new ids).
