---
name: brain
description: Cadence's brain note format and the "check the brain first" mandate. Auto-loads whenever a cadence skill is about to start new work (refine, work, sprint-plan, standup) or /cadence:review is about to commit.
user-invocable: false
---

# Cadence Brain Rules

<important>
- Before starting new work, search cadence/brain/*.md for notes related to the topic (by filename, tags, and heading text). Surface what you find, including conflicting notes, before proceeding -- never silently pick a side.
- Only the brain-curator agent writes or edits files in cadence/brain/. Other skills describe what happened; they do not write notes directly.
- Every commit made by /cadence:review follows the message convention below and never includes an Anthropic or Claude co-author tag.
</important>

## Purpose

Defines the one note format used across cadence/brain/, and the commit message convention /cadence:review uses, so both stay consistent without a separate skill for each.

## Brain note format

    ---
    type: domain          # domain | process
    tags: [tag-one, tag-two]
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
- `sources` -- populate only when the note was informed by something looked up externally, per the anti-hallucination core value.

## Commit message convention

Format: `<verb>: <ticket title> (<id>)`, e.g. `feat: add password reset endpoint (C-12)`.

Never include a `Co-Authored-By: Claude` or any Anthropic attribution line. Never use `--no-verify`.

## Process

This skill has no steps of its own -- it is reference material other cadence skills rely on.

## Inputs

cadence/brain/*.md, read by any skill before starting new work.

## Outputs

None directly -- the brain-curator agent is the only writer.

## Error handling

- **Brain search finds nothing relevant:** proceed normally, note that no prior context was found.
- **Brain search finds a conflicting note:** surface it to the user explicitly before proceeding.
