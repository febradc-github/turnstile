---
name: cadence-brain
description: The cadence vault layout, the one note format every cadence markdown file follows, and the "check the brain first" mandate. Auto-loads whenever a cadence skill is about to start new work (refine, breakdown, work, sprint-plan, standup, brainstorm, systematic-debugger, code-reviewer) or /cadence:review is about to commit.
user-invocable: false
---

# Cadence Vault Rules

<important>
- Before starting new work, search the vault for notes related to the topic -- prefer the cadence-brain MCP tools (search_notes, get_related) over raw greps when available; they index every markdown note in cadence/. Surface what you find, including conflicting notes, before proceeding -- never silently pick a side.
- Only the brain-curator agent writes or edits files in cadence/brain/, cadence/decisions/, and cadence/architecture/. Item notes, designs, and specs are written by their gated skills (refine, breakdown, spec). No other writes.
- Status lives only in the YAML board (backlog.yml, sprint-N.yml). Notes never carry a status field -- a second copy would drift.
- If the every-turn reminder or list_changed_notes reports hand-edited knowledge notes, surface them before relying on their content -- the user's edits in Obsidian are ground truth.
- If the every-turn reminder or list_stray_notes reports stray notes (vault-root files, or files named exactly like another note's alias), clean them up before trusting any wikilink: Obsidian resolves exact filenames before aliases, so a stray C-2.md silently captures every [[C-2]]. Delete empty strays after telling the user; fold a non-empty stray's content into the real note first.
- Every commit made by /cadence:review follows the message convention below and never includes an Anthropic or Claude co-author tag.
</important>

## Purpose

Defines the vault layout, the shared note format that makes every cadence
artifact a node in the Obsidian graph, and the commit message convention.

## Vault layout

`cadence/` is the Obsidian vault. Every markdown file in it follows the
shared note format, so everything interconnects in Graph View:

    cadence/
      backlog.yml, sprint-N.yml         # the board: status, points, planning
      epics/C-<n>-<slug>.md             # one item note per epic
      user-stories/C-<n>-<slug>.md      # one item note per user story
      tasks/C-<n>-<slug>.md             # one item note per task
      designs/C-<n>-<slug>-design.md    # design doc per item
      specs/C-<n>-<slug>-spec.md        # spec per leaf item
      architecture/arch-<topic>.md      # how the system is shaped
      decisions/adr-<NNN>-<slug>.md     # why it is shaped that way
      brain/<topic>.md, moc-<topic>.md  # domain/process knowledge, MOCs

Naming: `<slug>` is the item title in kebab-case, at most five words.
`<NNN>` is a zero-padded ADR sequence (`adr-001-...`). Note basenames must be
unique across the whole vault -- Obsidian wikilinks resolve by basename, which
is why designs and specs carry their `-design`/`-spec` suffix.

## Shared note format

    ---
    type: epic            # epic | story | task | design | spec |
                          # architecture | decision | domain | process | moc
    tags: [api/auth]      # hierarchical where a parent exists, max two levels
    aliases: []           # item notes carry their ticket id, e.g. ["C-12"]
    created: YYYY-MM-DD
    updated: YYYY-MM-DD
    related: ["[[other-note]]"]
    sources: []           # URLs consulted, only for web-informed content
    ---

    # C-12: Title

    Body prose. Reference tickets as [[C-12]] -- the id is an alias of the
    item note, so the link resolves and shows up in the graph.

    See also: [[other-note]]

Per-kind rules:

- **Item notes** (`type: epic|story|task`): alias = the ticket id, so every
  `[[C-<n>]]` anywhere in the vault lands on them. Body: one-paragraph
  summary, then links -- `Design: [[...-design]]`, `Spec: [[...-spec]]`,
  `Parent: [[...]]`, and a `Children:` list on containers. No status, no
  acceptance criteria -- the board and the spec own those.
- **Designs** (`type: design`) and **specs** (`type: spec`): keep their
  existing body sections, plus frontmatter and a link back to their item note
  (and the parent's design for breakdown children).
- **Decisions** (`type: decision`): one ADR per significant choice --
  context, the decision, alternatives rejected and why. Link every item note
  the decision affects and any architecture notes it shapes.
- **Architecture** (`type: architecture`): current-state descriptions of a
  system area. Link the ADRs that produced the shape and the items that
  touched it.
- **Brain** (`type: domain|process|moc`): as before -- discovered knowledge,
  process learnings, and Maps of Content (`moc-<topic>.md`) once a top-level
  tag reaches 5 notes.

Linking is bidirectional by convention: when a note links to another, add the
back-reference to the target's `related` list.

## Stray notes

Clicking an unresolved-looking wikilink in Obsidian offers to create the
missing note -- accepting mints an empty file (by default at the vault root)
named exactly like the link target. Because Obsidian resolves an exact
filename before an alias, a stray `C-2.md` hijacks every `[[C-2]]` that
should land on the real item note. Cadence never writes vault-root notes, so
any root-level file is a stray; so is any file named exactly like another
note's alias. The every-turn reminder and the `list_stray_notes` MCP tool
flag both. Fresh vaults scaffolded by `/cadence:install-obsidian` point
Obsidian's new-note default at `brain/` so accidental creations land in
tracked territory instead.

## Legacy paths

Boards created before 0.10 have flat `designs/<id>.md` and `specs/<id>.md`
files without frontmatter. Read them where the new path is missing; whenever
a skill rewrites one anyway, move it to the new name, add frontmatter, and
update inbound links -- opportunistic migration, no bulk rewrites.

## Commit message convention

Format: `<verb>: <ticket title> (<id>)`, e.g. `feat: add password reset endpoint (C-12)`.

Never include a `Co-Authored-By: Claude` or any Anthropic attribution line. Never use `--no-verify`. The plugin's PreToolUse guard hook blocks commits that violate either rule -- if a commit is rejected, fix the message or the failing check, never work around the hook.

## Error handling

- **Vault search finds nothing relevant:** proceed normally, note that no prior context was found.
- **Vault search finds a conflicting note:** surface it to the user explicitly before proceeding.
