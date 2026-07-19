---
name: turnstile-brainstorm
description: Exploratory dialogue for a not-yet-scoped idea; no file writes. Convenes a pitch-agent panel for epic-scale ideas and hands off to refine once concrete. Dispatched by /turnstile:brainstorm or conversate routing only.
argument-hint: "[rough idea]"
user-invocable: false
---

# Brainstorm

<important>
- Never write to turnstile/backlog.yml, turnstile/designs/, or any other turnstile data file from this skill -- brainstorming has no side effects. Only `turnstile-refine` writes the design doc and backlog entry.
- Do not ask for acceptance criteria, a points estimate, or an assignee -- those belong to `turnstile-refine`. Keep questions open-ended and exploratory.
- Search the vault (brain, decisions, architecture, item notes) for related notes before starting the dialogue, and surface what you find.
- The pitch panel is gated: dispatch pitch-agent only for epic-scale ideas (multiple independent deliverables, or a clear >8-point feel) or when the user asks for more perspectives. Trivial ideas get no panel -- it would be token theater.
- Panelists never see the dialogue. Pass each one only the idea summary, its stance, and the step-1 vault findings -- an unanchored take is the entire point of dispatching them.
</important>

## Process

1. Search the vault for notes related to the idea's topic ($ARGUMENTS). Surface anything relevant, including conflicts, before continuing. If the idea already exists in the backlog or a sprint, point that out and ask whether they mean to extend the existing item instead (route to that item's gate, not refine, which only mints new ids).
2. Run an open-ended, one-question-at-a-time dialogue to explore:
   - What problem this actually solves and for whom.
   - The rough shape of an approach -- just enough to know it's worth formalizing.
   - How it sits in the existing system: which components it touches, and whether any architecture or decision note from step 1 supports or conflicts with it. Surfacing a conflict here is cheaper than discovering it in refine.
   - Alternatives briefly considered and why this direction seems right.
   If the idea stays vague after several rounds, keep asking narrower open-ended questions; do not force a summary or hand off without an actual problem statement.
3. **Pitch panel (gated -- see rules above).** If epic-scale or requested, offer the panel; on yes, dispatch `pitch-agent` three times in parallel, one stance each -- minimalist, skeptic, scout (swap in a custom stance if the user names one). Each dispatch gets only: a two-or-three-sentence idea summary, the stance, and the relevant step-1 vault findings. Never the dialogue transcript.
4. Synthesize the pitches yourself: deduplicate, keep genuinely distinct directions (usually 2-3), present each with its strongest argument and biggest risk. If the pitches all converge, say so honestly and present one direction -- do not manufacture fake disagreement. A pitch contradicting a recorded ADR is the skeptic doing its job -- surface it. The user picks, mixes, or rejects; panel output is advisory, never a decision.
5. Keep exploring until the idea is concrete enough that `turnstile-refine` could immediately start its own stricter questions without re-deriving the problem statement.
6. Summarize the idea in two or three sentences and confirm it's ready to formalize.
7. Once confirmed, invoke `turnstile-refine` with the summary as its starting description -- including architecture observations, tentative design directions, and the panel's rejected directions with why (refine's curator dispatch records the decision trail; brainstorm itself writes nothing).
