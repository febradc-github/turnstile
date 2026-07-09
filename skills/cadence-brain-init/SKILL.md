---
name: cadence-brain-init
description: Bulk-bootstraps cadence/code/ -- one linked note per source file with imports, exports, and callers. Only invoke when dispatched by the /cadence:brain-init command.
user-invocable: false
---

# Brain Init

<important>
- This skill orchestrates only -- it never writes notes itself. Every note is written by a brain-curator dispatch.
- Bulk batch dispatches override the curator's model to sonnet (the Agent tool's model parameter); the final stitch dispatch uses the curator's default model.
- Reruns are additive: files that already have a code note are skipped. Keeping notes current for changed files is the opportunistic curator path during normal work, not this command.
- Confirm the batch plan with the user once before dispatching -- this is an expensive parallel run.
- Wikilinks to file notes always target the slug ([[scripts-brain-mcp-js|scripts/brain-mcp.js]]); a path inside a link target is an unresolved click-trap that mints a stray note.
</important>

## Purpose

One-time (and safely re-runnable) bootstrap of code-level documentation:
every source file becomes a cadence/code/ note carrying its purpose,
exports, imports, and callers, linked into the vault graph and stitched
into per-directory architecture notes.

## Process

1. Verify the cadence-brain MCP tools respond (any search_notes call). If
   they are unavailable, tell the user to reload the session so .mcp.json
   registers the server, and stop.
2. Build the source file list:
   - In a git repo: `git ls-files` (respects .gitignore).
   - Otherwise: a Glob sweep of the project.
   - Keep only these extensions: .js .mjs .cjs .ts .tsx .jsx .py .rb .go
     .rs .java .kt .c .h .cpp .hpp .cs .php .swift .sh .ps1 .psm1 .sql
     .vue .svelte .lua .r .scala .ex .exs
   - Always exclude: cadence/, node_modules/, vendor/, dist/, build/,
     .git/, lockfiles, minified files (*.min.*), generated files.
3. List existing code notes and their path aliases -- grep the `aliases:`
   frontmatter line of each note in cadence/code/ rather than reading
   whole notes; a missing code/ folder just means no existing notes. Drop
   every file whose path matches an existing alias. Build one path -> slug
   map across ALL remaining files at once (lowercase; every run of
   characters outside a-z0-9 becomes one `-`, trimmed at both ends).
   Resolve collisions -- against existing notes AND between new files --
   by appending -2, -3, ... in path-sorted order.
4. Identify stale notes: every code note whose aliased path no longer
   exists in the repo. Do not delete anything yet.
5. Plan the batches: group by top-level directory, about 15 files per
   batch (split large directories, merge tiny ones).
6. Report the plan -- N files to document in M batches, K skipped as
   already documented, S stale notes to remove -- and confirm once with
   the user (AskUserQuestion). After confirmation: delete the stale note
   files, then dispatch the brain-curator agent once per batch with
   model: sonnet, at most 4 dispatches in flight at a time. Each dispatch
   prompt carries: the batch's file paths with their slugs, the full
   linkable-slugs list (every path -> slug in this run plus every existing
   code note), and the statement that this is bulk code documentation mode.
7. After all batches return, dispatch brain-curator once more (default
   model) to stitch: for each top-level source directory, create or extend
   cadence/architecture/AR-<dir>.md (root-level files: AR-root.md) with a
   ## Files section linking that directory's file notes in [[slug|path]]
   form (extend an existing AR note covering the area rather than creating
   a parallel one); run its normal MOC upkeep; fix unresolved links
   introduced by this run -- the prompt includes the slugs of the stale
   notes deleted in step 6, and the curator runs list_backlinks on each to
   remove dangling references from surviving notes; finish with
   list_changed_notes acknowledge: true.
8. Report: notes written, AR notes created or extended, files skipped or
   failed, and that /cadence:obsidian-graph shows the result.

## Inputs

The repository's source files, existing cadence/code/ notes.

## Outputs

One cadence/code/ note per newly documented source file, created or
extended AR-<dir> architecture notes, MOC updates, a synced change baseline.

## Error handling

- **A batch dispatch fails:** report its file list and continue with the
  rest; a rerun of /cadence:brain-init picks the failed files up (they have
  no notes, so the skip check passes them through).
- **Unreadable or binary-despite-extension file:** the curator skips it;
  list it in the final report.
- **No source files found after filtering:** say so and stop -- nothing to
  document.
- **No cadence/ directory:** create nothing; suggest running a cadence
  command (or /cadence:install-obsidian) first, and stop.
