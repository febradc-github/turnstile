---
name: cadence-spec
description: Turns an approved design doc into a concrete, checkable spec file. Requires the user's explicit approval before the item can be marked ready. Gate 1b of the cadence workflow.
argument-hint: "[id]"
disable-model-invocation: true
---

# Spec

<important>
- Refuse to run if cadence/backlog.yml has no item with this id and status: idea, or if cadence/designs/<id>.md does not exist. Tell the user to run /cadence:refine first.
- Do not flip the item's status to ready until the user has explicitly approved the spec file.
- Design and spec are always separate files. Never skip writing cadence/specs/<id>.md and just reuse the design doc.
</important>

## Purpose

Converts the rationale in `cadence/designs/<id>.md` into a checklist of concrete acceptance criteria that `/cadence:review` can later verify mechanically, and gates the item's move to `ready`.

## Process

1. Look up `<id>` (from `$ARGUMENTS`) in `cadence/backlog.yml`. If no item exists with that id and `status: idea`, refuse and tell the user to run `/cadence:refine <idea>` first.
2. Read `cadence/designs/<id>.md`. If it doesn't exist, refuse with the same message.
3. Search `cadence/brain/*.md` for notes related to `<id>`'s topic (by filename, tags, and heading text). Surface anything relevant, including conflicts, before continuing.
4. If `cadence/specs/<id>.md` already exists (the item's `status` is still `idea`, so this is not an approved spec -- it can only be a draft left over from an abandoned prior `/cadence:spec` session), warn the user it looks like a leftover draft and ask whether to overwrite it or keep it as-is before continuing. Do not silently overwrite it.
5. Write `cadence/specs/<id>.md`, turning the design's "Acceptance criteria" section into a checklist, and carrying forward anything explicitly out of scope from the dialogue:

       # <id>: <title> -- Spec

       ## Acceptance criteria
       - [ ] <criterion 1>
       - [ ] <criterion 2>

       ## Out of scope
       <explicitly excluded items discussed during refine, or "None.">

       ## Reference
       See cadence/designs/<id>.md for rationale and trade-offs.

6. Present the spec file content to the user and ask them to explicitly approve it. If they request changes, revise and re-present. Do not proceed until approved.
7. Once approved, update the item in `cadence/backlog.yml`:
   - `status: ready`
   - `acceptance_criteria` set to match the checklist items verbatim (as plain strings, without the `[ ]` markers)
   - `updated` set to today's date
8. Tell the user the item is `ready` and can be pulled into a sprint with `/cadence:sprint-plan`.

## Inputs

`cadence/backlog.yml`, `cadence/designs/<id>.md`, `cadence/brain/*.md`.

## Outputs

`cadence/specs/<id>.md` (new file), `cadence/backlog.yml` (item's `status`, `acceptance_criteria`, `updated` fields).

## Error handling

- **No matching idea-status item, or missing design doc:** refuse; direct the user to `/cadence:refine <idea>`.
- **User approves with changes each round:** keep revising and re-presenting until they approve without changes -- don't flip status on a conditional approval.
- **A spec file already exists at this id:** warn the user it looks like an abandoned draft; ask before overwriting.
- **Malformed YAML in backlog.yml:** surface the parse error and ask the user to fix it by hand -- never guess or auto-repair.
