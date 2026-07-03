---
name: cadence-refine
description: Gap-closing dialogue for a raw idea. Writes a design doc that requires the user's explicit approval before the idea can move toward being spec'd. Gate 1a of the cadence workflow. Only invoke when dispatched by the /cadence:refine command, cadence-conversate routing, or cadence-brainstorm's handoff.
argument-hint: "[idea description]"
user-invocable: false
---

# Refine

<important>
- Do not finish this skill until acceptance_criteria (non-empty), a points estimate, and an assignee are all known. Ask one question at a time for anything missing or ambiguous.
- Gap-closing includes architecture and design, not just requirements: establish where the work sits in the existing system (check cadence/architecture/ and cadence/decisions/) and which design decisions it forces. A significant decision made here becomes an ADR via brain-curator.
- Do not add the item to cadence/backlog.yml until the user has explicitly approved the design doc. "Looks good" or equivalent counts as approval; silence does not.
- Search the vault (brain, decisions, architecture, item notes) for related notes before starting the dialogue, and surface what you find.
- Assess scale during the dialogue: an idea with multiple independent deliverables, or an estimate above 8 points, is an epic. Record it with type: epic and hand off to cadence-breakdown -- do not force epic-sized work into one flat ticket.
</important>

## Purpose

Turns a raw idea ($ARGUMENTS) into an approved design doc and a tracked backlog item, so nothing enters a sprint half-specified.

## Process

1. Search the vault (brain, decisions, architecture, and existing item notes -- the search_notes MCP tool indexes all of them) for notes related to the idea's topic. Surface anything relevant, including conflicts, before continuing.
2. Compute the next ticket ID: scan `cadence/backlog.yml`, `cadence/sprint.yml`, `cadence/sprints/*.yml`, and any legacy `cadence/sprint-*.yml` for existing `C-<N>` ids across all `items` lists; the new id is `C-<max+1>`, or `C-1` if none exist. If `cadence/backlog.yml` does not exist yet, it will be created in step 6 with `items: []`.
3. Run a one-question-at-a-time dialogue with the user to establish:
   - A clear title and one-paragraph description of the problem.
   - **Architecture fit:** where this sits in the existing system. Read any related `cadence/architecture/AR-*.md` and `cadence/decisions/adr-*.md` notes first (the step 1 search surfaces them); ask about integration points, affected components, and whether the work bends any recorded decision. If it contradicts an existing ADR, surface that conflict explicitly -- the user decides whether the old decision is superseded.
   - **Design decisions:** the approach, and any choice between real alternatives this work forces (storage, protocol, library, pattern). Close these gaps now -- a ticket that reaches `/cadence:work` with an open design question was refined too early.
   - Non-empty `acceptance_criteria` (a list of concrete, checkable statements).
   - A `points` estimate (any positive integer the user agrees to).
   - `assignee`: ask who implements this -- `claude` or `human`. Default to `claude` if the user has no preference.
   Do not proceed to step 4 while any of these is missing or the user's answer is ambiguous.
   While talking, assess scale: if the idea contains multiple independent deliverables, or the estimate lands above 8 points, tell the user this is epic-sized and will be recorded as `type: epic`, with acceptance criteria at the outcome level (what the whole epic must achieve). The pieces get their own criteria later via `/cadence:breakdown`.
4. The ticket's number `<n>` (from `<id>` = `C-<n>`) names every file: design `DS-<n>`, spec `SP-<n>`, item note `EP-<n>` or `US-<n>`. Before writing, check whether `cadence/designs/DS-<n>.md` (or a legacy `cadence/designs/<id>*.md`) already exists. Since `id` is computed from `cadence/backlog.yml` and `cadence/sprint-*.yml` (step 2), a file can exist at that path with no matching entry in either source -- this means an earlier refine session was abandoned after writing its design doc but before the user approved it in step 6. If a file exists, warn the user that a draft already exists at `<id>` and is likely an abandoned prior session, and ask whether to overwrite it or start a fresh draft. If they want a fresh draft, recompute using `id+1` and repeat this check against the new id (it too may already exist). Do not silently overwrite an existing design doc.

   Write `cadence/designs/DS-<n>.md`:

       ---
       type: design
       tags: []
       created: <today, YYYY-MM-DD>
       updated: <today, YYYY-MM-DD>
       related: ["[[<EP-n|US-n>]]"]
       sources: []
       ---

       # <id>: <title> -- Design

       ## Problem
       <problem statement from the dialogue>

       ## Architecture
       <where this sits in the system: affected components, integration
       points, and links to the [[AR-...]] and [[adr-...]] notes it relies
       on or bends -- link only notes that exist (verified in step 1's
       search); name a missing one in plain text instead>

       ## Approach
       <the approach agreed on>

       ## Trade-offs considered
       <alternatives discussed and why not chosen, or "None discussed.">

       ## Acceptance criteria
       - <criterion 1>
       - <criterion 2>

       ## Estimate
       <points> points

       ## Assignee
       <claude|human>

5. Present the design doc content to the user and ask them to explicitly approve it. If they request changes, revise the file and re-present. Do not proceed until they approve.
6. Once approved, append the item to `cadence/backlog.yml` (creating the file with `items: []` first if it doesn't exist):

       - id: <id>
         title: "<title>"
         status: idea
         points: <points>
         assignee: <claude|human>
         created: <today, YYYY-MM-DD>
         updated: <today, YYYY-MM-DD>

   For an epic-sized item (step 3), add `type: epic` after `title`. The board holds tracking fields only -- the description lives in the item note, the criteria in the design doc and later the spec. Never copy prose into YAML.

   Also write the item note -- `cadence/epics/EP-<n>.md` for an epic, `cadence/user-stories/US-<n>.md` otherwise:

       ---
       type: <epic|story>
       tags: []
       aliases: ["<id>", "<title>"]
       created: <today, YYYY-MM-DD>
       updated: <today, YYYY-MM-DD>
       related: ["[[DS-<n>]]"]
       ---

       # <id>: <title>

       <one-paragraph description>

       - Design: [[DS-<n>]]

   The aliases make the quick switcher and search_notes find the note by board id or title -- but aliases never resolve raw wikilinks, so links always use the typed name ([[EP-<n>]]/[[US-<n>]]), never [[<id>]].

   Write the design doc and the item note in the same pass -- they link each other, so stopping between them leaves a dangling link. Before finishing, confirm every [[wikilink]] you added resolves to an existing note filename (list_unresolved_links); an unresolved link is a click-trap that mints a stray note in Obsidian.
7. If the dialogue surfaced something worth remembering, dispatch the `brain-curator` agent with a short description of it. In particular: a design choice between real alternatives becomes a decision record (the curator files it in `cadence/decisions/`), and newly established system shape becomes an architecture note (`cadence/architecture/AR-<topic>.md`) -- tell the curator which item notes ([[EP-<n>]]/[[US-<n>]]) the note affects so it links them.
8. For a regular item, tell the user the design is approved and recorded, and that `/cadence:spec <id>` is the next step. For an epic, tell them it needs breaking into stories before anything can be spec'd, and invoke the `cadence-breakdown` skill with the epic's id (its own approval gate governs the split).

## Inputs

The vault's markdown notes (`cadence/brain/`, `cadence/decisions/`, `cadence/architecture/`, item notes), `cadence/backlog.yml`, `cadence/sprint.yml` and `cadence/sprints/*.yml` (for id computation only).

## Outputs

`cadence/designs/DS-<n>.md` (new file), `cadence/epics/EP-<n>.md` or `cadence/user-stories/US-<n>.md` (item note), `cadence/backlog.yml` (new or appended item with `status: idea`), possibly a brain-curator dispatch producing `cadence/decisions/` or `cadence/architecture/` notes.

## Error handling

- **User has no idea yet what they want:** ask open-ended questions to help them articulate the problem before asking for acceptance criteria -- don't force the checklist prematurely.
- **User tries to skip straight to acceptance criteria without a clear problem statement:** ask for the problem statement first; acceptance criteria without a stated problem are usually wrong.
- **The work contradicts a recorded decision (`cadence/decisions/adr-*.md`):** surface the conflict; if the user overrules the old ADR, have brain-curator record the superseding decision -- never silently ignore it.
- **A design doc already exists at the computed id:** this is likely an abandoned draft from a prior refine session that never reached step 6 (so its id never made it into `cadence/backlog.yml` or a sprint file). Warn the user and ask whether to overwrite it or use `id+1` for a fresh draft, checking again for a collision at the new id. Never overwrite silently.
