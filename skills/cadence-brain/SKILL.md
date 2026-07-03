---
name: cadence-brain
description: The cadence vault layout, the one note format every cadence markdown file follows, and the "check the brain first" mandate. Auto-loads whenever a cadence skill is about to start new work (refine, breakdown, work, sprint-plan, standup, brainstorm, systematic-debugger, code-reviewer) or /cadence:review is about to commit.
user-invocable: false
---

# Cadence Vault Rules

<important>
- Before starting new work, search the vault for notes related to the topic -- prefer the cadence-brain MCP tools (search_notes, get_related) over raw greps when available; they index every markdown note in cadence/. Surface what you find, including conflicting notes, before proceeding -- never silently pick a side.
- Only the brain-curator agent writes or edits files in cadence/brain/, cadence/decisions/, and cadence/architecture/. Item notes, designs, and specs are written by their gated skills (refine, breakdown, spec). No other writes.
- Status lives only in the YAML board (backlog.yml, sprint.yml, archived sprints). Notes never carry a status field -- a second copy would drift.
- Obsidian resolves a [[wikilink]] by exact filename only. Aliases feed autocomplete and the quick switcher but never resolve a typed link. So: every [[wikilink]] written to any cadence note must name an existing file exactly (verify with read_note or search_notes first), and never write a board id as a link -- [[C-2]] does not resolve; the item note is [[US-2]] (or [[EP-2]]/[[TK-2]]). Write C-2 as plain text or link the typed name. An unresolved link is a click-trap that mints a stray note.
- When a set of mutually-linked notes is created together (item note + design), finish all of them in the same pass and confirm nothing is left dangling (list_unresolved_links).
- If the every-turn reminder or list_stray_notes reports stray notes (vault-root files, duplicate basenames, or files named exactly like another note's alias), clean them up before trusting any wikilink. Delete empty strays after telling the user; fold a non-empty stray's content into the real note first.
- If the every-turn reminder or list_changed_notes reports hand-edited knowledge notes, surface them before relying on their content -- the user's edits in Obsidian are ground truth.
- Every commit made by /cadence:review follows the message convention below and never includes an Anthropic or Claude co-author tag.
</important>

## Purpose

Defines the vault layout, the shared note format that makes every cadence
artifact a node in the Obsidian graph, and the commit message convention.

## Vault layout

`cadence/` is the Obsidian vault. Every markdown file in it follows the
shared note format, so everything interconnects in Graph View:

    cadence/
      backlog.yml                  # unplanned work (idea/ready/dropped)
      sprint.yml                   # the current sprint -- always this name
      sprints/sprint-<N>.yml       # completed sprints, immutable archive
      epics/EP-<n>.md              # one item note per epic
      user-stories/US-<n>.md       # one item note per user story
      tasks/TK-<n>.md              # one item note per task
      designs/DS-<n>.md            # design doc per item
      specs/SP-<n>.md              # spec per leaf item
      architecture/AR-<topic>.md   # how the system is shaped
      decisions/adr-<NNN>-<slug>.md# why it is shaped that way (ADRs)
      brain/<topic>.md, moc-*.md   # domain/process knowledge, MOCs

Naming: `<n>` is the ticket's board number -- ticket `C-7` maps to `EP-7`,
`US-7`, or `TK-7` (by type) plus `DS-7` and `SP-7`. One glance at a filename
gives kind and ticket; one number traces a ticket across every folder. Typed
prefixes keep basenames unique vault-wide, which Obsidian's filename-based
link resolution requires. `<NNN>` is a zero-padded ADR sequence
(`adr-001-...`); `AR-<topic>` is kebab-case.

## Shared note format

    ---
    type: epic            # epic | story | task | design | spec |
                          # architecture | decision | domain | process | moc
    tags: [api/auth]      # hierarchical where a parent exists, max two levels
    aliases: []           # item notes: ["C-<n>", "<title>"] -- for search and
                          # autocomplete only; aliases never resolve raw links
    created: YYYY-MM-DD
    updated: YYYY-MM-DD
    related: ["[[other-note]]"]
    sources: []           # URLs consulted, only for web-informed content
    ---

    # C-12: Title

    Body prose. Reference tickets by their typed note name -- [[EP-12]],
    [[US-13]], [[TK-14]] -- which resolves by filename. A bare board id like
    C-12 stays plain text (or use a display alias: [[US-12|C-12]]).

    See also: [[other-note]]

Per-kind rules:

- **Item notes** (`type: epic|story|task`): named `EP-<n>`/`US-<n>`/`TK-<n>`;
  aliases carry the board id and the title so the quick switcher and
  search_notes find them either way. Body: heading `# C-<n>: <title>`, a
  one-paragraph summary, then links -- `Design: [[DS-<n>]]`,
  `Spec: [[SP-<n>]]`, `Parent: [[EP-<p>]]`, and a `Children:` list on
  containers. No status -- the board owns it. No acceptance criteria either,
  with one exception: quick-lane items (created by /cadence:quick, which skips
  design and spec) carry an inline "## Acceptance criteria" section in the
  item note, and /cadence:review reads it from there.
- **Designs** (`type: design`, `DS-<n>`) and **specs** (`type: spec`,
  `SP-<n>`): keep their existing body sections, plus frontmatter and a link
  back to their item note (and the parent's design for breakdown children).
- **Decisions** (`type: decision`): one ADR per significant choice --
  context, the decision, alternatives rejected and why. Link every item note
  the decision affects and any architecture notes it shapes.
- **Architecture** (`type: architecture`, `AR-<topic>`): current-state
  descriptions of a system area. Link the ADRs that produced the shape and
  the items that touched it.
- **Brain** (`type: domain|process|moc`): as before -- discovered knowledge,
  process learnings, and Maps of Content (`moc-<topic>.md`) once a top-level
  tag reaches 5 notes.

Linking is bidirectional by convention: when a note links to another, add the
back-reference to the target's `related` list. Links point only at notes that
exist: verify the target name before writing the link, and after a skill
finishes its writes, everything it linked must resolve -- the every-turn
reminder flags any unresolved target left behind.

## Stray notes

Clicking an unresolved-looking wikilink in Obsidian offers to create the
missing note -- accepting mints an empty file (by default at the vault root)
named exactly like the link target, which then captures every matching link.
Cadence never writes vault-root notes, so any root-level file is a stray; so
is a duplicate basename or a file named exactly like another note's alias.
The every-turn reminder and the `list_stray_notes` MCP tool flag all three.
Fresh vaults scaffolded by `/cadence:install-obsidian` point Obsidian's
new-note default at `brain/` so accidental creations land in tracked
territory instead.

## Legacy paths

Earlier cadence versions used flat `designs/<id>.md` / `specs/<id>.md`
(pre-0.10) and slug names like `C-2-checkout-form.md` /
`C-2-checkout-form-design.md` (0.10.x). Read them where the current name is
missing; whenever a skill rewrites one anyway, move it to the current name,
add frontmatter, and update inbound links -- opportunistic migration, no bulk
rewrites.

## Commit message convention

Format: `<verb>: <ticket title> (<id>)`, e.g. `feat: add password reset endpoint (C-12)`.

Never include a `Co-Authored-By: Claude` or any Anthropic attribution line. Never use `--no-verify`. The plugin's PreToolUse guard hook blocks commits that violate either rule -- if a commit is rejected, fix the message or the failing check, never work around the hook.

## Error handling

- **Vault search finds nothing relevant:** proceed normally, note that no prior context was found.
- **Vault search finds a conflicting note:** surface it to the user explicitly before proceeding.
