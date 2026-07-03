---
name: cadence-brain
description: Cadence's brain note format and the "check the brain first" mandate. Auto-loads whenever a cadence skill is about to start new work (refine, work, sprint-plan, standup, brainstorm, systematic-debugger, code-reviewer) or /cadence:review is about to commit.
user-invocable: false
---

# Cadence Brain Rules

<important>
- Before starting new work, search cadence/brain/*.md for notes related to the topic (by filename, tags, and heading text) -- prefer the cadence-brain MCP tools (search_notes, get_related) over raw greps when available. Surface what you find, including conflicting notes, before proceeding -- never silently pick a side.
- Only the brain-curator agent writes or edits files in cadence/brain/. Other skills describe what happened; they do not write notes directly.
- If the every-turn reminder or list_changed_notes reports hand-edited brain notes, surface them before relying on brain content -- the user's edits in Obsidian are ground truth.
- Every commit made by /cadence:review follows the message convention below and never includes an Anthropic or Claude co-author tag.
</important>

## Purpose

Defines the one note format used across cadence/brain/, and the commit message convention /cadence:review uses, so both stay consistent without a separate skill for each.

## Brain note format

    ---
    type: domain          # domain | process | moc
    tags: [api/auth]      # hierarchical where a parent exists, max two levels
    aliases: []           # optional alternate names Obsidian should resolve
    created: YYYY-MM-DD
    updated: YYYY-MM-DD
    related: ["[[other-note]]"]
    sources: []            # URLs consulted, only if this note came from a web lookup
    ---

    # Title

    Body prose. Reference ticket IDs as [[C-12]] even if C-12 has no note file --
    Obsidian shows it as an unresolved link, which is still useful in the graph.

    See also: [[other-note]]

- `type: domain` -- architecture/codebase knowledge discovered while implementing.
- `type: process` -- recurring estimation bias, blockers, or workflow friction.
- `type: moc` -- a Map of Content: a hub note named `moc-<topic>.md` whose body is a curated list of [[links]] grouped under ## headings.
- Tags nest under a broad top-level area using Obsidian's `parent/child` syntax (`api/auth`, `process/estimation`); reuse existing tags (see the list_tags MCP tool) instead of inventing synonyms; max two levels.
- `aliases` -- optional alternate names; Obsidian resolves [[an alias]] to this note, cutting unresolved-link noise.
- `sources` -- populate only when the note was informed by something looked up externally, per the anti-hallucination core value.

## Commit message convention

Format: `<verb>: <ticket title> (<id>)`, e.g. `feat: add password reset endpoint (C-12)`.

Never include a `Co-Authored-By: Claude` or any Anthropic attribution line. Never use `--no-verify`. The plugin's PreToolUse guard hook blocks commits that violate either rule -- if a commit is rejected, fix the message or the failing check, never work around the hook.

This skill is reference material only; the brain-curator agent is the sole writer of cadence/brain/ files.

## Error handling

- **Brain search finds nothing relevant:** proceed normally, note that no prior context was found.
- **Brain search finds a conflicting note:** surface it to the user explicitly before proceeding.
