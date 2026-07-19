# Turnstile note format reference

Read this before writing or restructuring any vault note. Loaded on demand by
turnstile-brain; not needed for searching or reading.

## Shared note format

    ---
    type: epic            # epic | story | task | design | spec | plan |
                          # architecture | decision | domain | process | moc | file
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

## Per-kind rules

- **Item notes** (`type: epic|story|task`): named `EP-<n>`/`US-<n>`/`TK-<n>`;
  aliases carry the board id and the title so the quick switcher and
  search_notes find them either way. Body: heading `# C-<n>: <title>`, a
  one-paragraph summary, then links -- `Design: [[DS-<n>]]`,
  `Spec: [[SP-<n>]]`, `Parent: [[EP-<p>]]`, and a `Children:` list on
  containers. No status -- the board owns it. No acceptance criteria either,
  with one exception: quick-lane items (created by /turnstile:quick, which skips
  design and spec) carry an inline "## Acceptance criteria" section in the
  item note, and /turnstile:review reads it from there.
- **Designs** (`type: design`, `DS-<n>`), **specs** (`type: spec`,
  `SP-<n>`), and **plans** (`type: plan`, `PL-<n>` -- solo profile's merged
  design+spec): keep their existing body sections, plus frontmatter and a
  link back to their item note (and the parent's design for breakdown
  children). Item notes link a plan as `Plan: [[PL-<n>]]`.
- **Decisions** (`type: decision`): one ADR per significant choice --
  context, the decision, alternatives rejected and why. Link every item note
  the decision affects and any architecture notes it shapes.
- **Architecture** (`type: architecture`, `AR-<topic>`): current-state
  descriptions of a system area. Link the ADRs that produced the shape and
  the items that touched it.
- **Brain** (`type: domain|process|moc`): discovered knowledge, process
  learnings, and Maps of Content (`moc-<topic>.md`) once a top-level tag
  reaches 5 notes.
- **Code files** (`type: file`, `code/<path-slug>.md`): one note per source
  file -- purpose, exports, imports, callers. Named by the slugified
  repo-relative path (`scripts/brain-mcp.js` -> `scripts-brain-mcp-js`);
  the exact path is the note's only alias (never the bare basename).
  Wikilinks to file notes target the slug -- `[[scripts-brain-mcp-js|scripts/brain-mcp.js]]`
  -- never the path, which would not resolve. Written only by brain-curator:
  opportunistically after work passes, in bulk by /turnstile:brain-init. A note
  is a map, not a mirror -- it can drift from the file it describes. Anyone
  answering a question from a code note (turnstile-conversate does this for
  ad-hoc "what does X do" questions) reads the tagged source file to verify
  before trusting the note; source wins on a mismatch, and brain-curator is
  dispatched opportunistically to correct the note -- the note is never
  edited inline by whatever consumed it.

Linking is bidirectional by convention: when a note links to another, add the
back-reference to the target's `related` list. Links point only at notes that
exist: verify the target name before writing the link, and after a skill
finishes its writes, everything it linked must resolve -- the every-turn
reminder flags any unresolved target left behind.

## Stray notes

Clicking an unresolved-looking wikilink in Obsidian offers to create the
missing note -- accepting mints an empty file (by default at the vault root)
named exactly like the link target, which then captures every matching link.
Turnstile never writes vault-root notes, so any root-level file is a stray; so
is a duplicate basename or a file named exactly like another note's alias.
The every-turn reminder and the `list_stray_notes` MCP tool flag all three.
Fresh vaults scaffolded by `/turnstile:install-obsidian` point Obsidian's
new-note default at `brain/` so accidental creations land in tracked
territory instead.

## Legacy paths

Earlier turnstile versions used flat `designs/<id>.md` / `specs/<id>.md`
(pre-0.10) and slug names like `C-2-checkout-form.md` /
`C-2-checkout-form-design.md` (0.10.x). Read them where the current name is
missing; whenever a skill rewrites one anyway, move it to the current name,
add frontmatter, and update inbound links -- opportunistic migration, no bulk
rewrites.
