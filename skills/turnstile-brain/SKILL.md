---
name: turnstile-brain
description: Vault layout, the shared note format, and the check-the-brain-first mandate. Auto-loads whenever any turnstile skill starts new work or /turnstile:review is about to commit.
user-invocable: false
---

# Turnstile Vault Rules

<important>
- Before starting new work, search the vault for notes related to the topic -- prefer the turnstile-brain MCP tools (search_notes, get_related) over raw greps when available; they index every markdown note in turnstile/. Surface what you find, including conflicting notes, before proceeding -- never silently pick a side.
- Before writing or restructuring ANY vault note, Read references/note-format.md from this skill's base directory -- it holds the shared frontmatter format, per-kind rules, stray-note handling, and legacy-path migration. Do not write a note from memory of the format.
- Only the brain-curator agent writes or edits files in turnstile/brain/, turnstile/decisions/, turnstile/architecture/, and turnstile/code/. One exception: /turnstile:brain-init deletes stale code notes (their source file no longer exists) after a named-list user confirmation. Item notes, designs, and specs are written by their gated skills (refine, breakdown, spec). No other writes.
- Status lives only in the YAML board (backlog.yml, sprint.yml, archived sprints). Notes never carry a status field -- a second copy would drift.
- Obsidian resolves a [[wikilink]] by exact filename only. Aliases feed autocomplete and the quick switcher but never resolve a typed link. So: every [[wikilink]] written to any turnstile note must name an existing file exactly (verify with read_note or search_notes first), and never write a board id as a link -- [[C-2]] does not resolve; the item note is [[US-2]] (or [[EP-2]]/[[TK-2]]). Write C-2 as plain text or link the typed name. An unresolved link is a click-trap that mints a stray note.
- When a set of mutually-linked notes is created together (item note + design), finish all of them in the same pass and confirm nothing is left dangling (list_unresolved_links).
- If the every-turn reminder or list_stray_notes reports stray notes (vault-root files, duplicate basenames, or files named exactly like another note's alias), clean them up before trusting any wikilink. Delete empty strays after telling the user; fold a non-empty stray's content into the real note first.
- If the every-turn reminder or list_changed_notes reports hand-edited knowledge notes, surface them before relying on their content -- the user's edits in Obsidian are ground truth.
- Every commit made by /turnstile:review follows the message convention below and never includes an Anthropic or Claude co-author tag.
</important>

## Vault layout

`turnstile/` is plain markdown that doubles as an Obsidian vault -- Obsidian
is the optional viewer, never a dependency. Every markdown file follows the
shared note format, so everything interconnects:

    turnstile/
      config.yml                   # settings: profile, turnstile, capture, quick_max_points
      backlog.yml                  # unplanned work (idea/ready/dropped)
      sprint.yml                   # the current sprint -- always this name
      sprints/sprint-<N>.yml       # completed sprints, immutable archive
      epics/EP-<n>.md              # one item note per epic
      user-stories/US-<n>.md       # one item note per user story
      tasks/TK-<n>.md              # one item note per task
      designs/DS-<n>.md            # design doc per item (profile: full)
      specs/SP-<n>.md              # spec per leaf item (profile: full)
      plans/PL-<n>.md              # merged design+spec per leaf item (profile: solo)
      architecture/AR-<topic>.md   # how the system is shaped
      decisions/adr-<NNN>-<slug>.md# why it is shaped that way (ADRs)
      brain/<topic>.md, moc-*.md   # domain/process knowledge, MOCs
      code/<path-slug>.md          # one note per source file (curator-written)

Naming: `<n>` is the ticket's board number -- ticket `C-7` maps to `EP-7`,
`US-7`, or `TK-7` (by type) plus `DS-7` and `SP-7` (or `PL-7` in solo). One glance at a filename
gives kind and ticket; one number traces a ticket across every folder. Typed
prefixes keep basenames unique vault-wide, which Obsidian's filename-based
link resolution requires. `<NNN>` is a zero-padded ADR sequence
(`adr-001-...`); `AR-<topic>` is kebab-case.

## Commit message convention

Format: `<verb>: <ticket title> (<id>)`, e.g. `feat: add password reset endpoint (C-12)`.

Never include a `Co-Authored-By: Claude` or any Anthropic attribution line. Never use `--no-verify`. The plugin's PreToolUse guard hook blocks commits that violate either rule -- if a commit is rejected, fix the message or the failing check, never work around the hook.

A vault search that finds nothing relevant is fine -- proceed and say no prior context was found.
