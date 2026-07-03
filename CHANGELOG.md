# Changelog

## 0.10.1 — 2026-07-03

- Stray-note defense. Clicking an unresolved-looking wikilink in Obsidian can
  mint an empty note at the vault root named exactly like the link target
  (e.g. `C-2.md`), and Obsidian resolves exact filenames before aliases — so
  the stray silently hijacks every `[[C-2]]` meant for the real item note.
  Three layers now prevent a recurrence:
  - New `list_stray_notes` MCP tool: flags any vault-root note (cadence never
    writes one) and any note named exactly like another note's alias, with
    empty/has-content and what it shadows.
  - The every-turn reminder runs the same check and instructs cleanup: delete
    empty strays, fold a non-empty stray's content into the real note first.
  - `/cadence:install-obsidian` now scaffolds `app.json` with the new-note
    default pointed at `brain/`, so accidental creations land in hand-edit-
    tracked territory instead of the root (existing vaults are untouched;
    the detection layers cover them).

## 0.10.0 — 2026-07-03

- The whole `cadence/` folder is now one interconnected Obsidian vault. Every
  markdown artifact follows the shared brain note format (frontmatter with
  `type`/`tags`/`aliases`/`related`, wikilinks) and lives in a typed folder:
  `epics/`, `user-stories/`, `tasks/` (item notes, named `C-<n>-<slug>.md`),
  `designs/` (`C-<n>-<slug>-design.md`), `specs/` (`C-<n>-<slug>-spec.md`),
  `decisions/` (`adr-<NNN>-<slug>.md`), `architecture/` (`arch-<topic>.md`),
  plus `brain/` as before. Item notes carry their ticket id as an alias, so
  `[[C-12]]` resolves in the graph; status stays exclusively in the YAML
  board so nothing drifts.
- refine and breakdown now write an item note per epic/story/task alongside
  the design doc, linking design ↔ item ↔ parent/children; spec links the
  spec note back to the item. Legacy flat `designs/<id>.md` / `specs/<id>.md`
  are read as fallbacks and migrated opportunistically.
- Architecture and design are now first-class in gap-closing: brainstorm
  explores system fit early, and refine must establish architecture fit
  (reading `architecture/` and `decisions/`, surfacing ADR conflicts) and
  close forced design decisions before an item is accepted. Significant
  choices become ADRs and system shape becomes architecture notes, both via
  brain-curator — its routing, ADR numbering, and supersede rules are new.
- The brain MCP server indexes the entire vault per call (with ticket-id
  alias resolution in search/read/backlinks/unresolved-links) and its
  `write_note` gains a `folder` argument for `decisions/` and
  `architecture/`. Hand-edit tracking covers exactly the curator-owned
  knowledge folders — workflow notes written by gated skills are deliberately
  untracked — and pre-0.10 `.brain-state.json` baselines migrate in place.
- All skills search the vault (not just `brain/`) before starting work;
  `/cadence:work` and `/cadence:code-reviewer` explicitly check recorded
  decisions so implementations don't silently contradict an ADR.

## 0.9.0 — 2026-07-03

- Epic -> user story -> task hierarchy. Items gain optional `type`
  (`epic`/`story`/`task`; absent means story) and `parent` fields — same
  `C-<n>` id counter, fully backward compatible with existing boards.
- New `/cadence:breakdown [id]`: approval-gated decomposition of an epic into
  stories or an oversized story into tasks (two levels max). Writes a design
  doc per child referencing the parent's, appends children to the backlog at
  `status: idea`, and resets a formerly-`ready` parent to `idea` — containers
  never enter sprints; their leaves do. A skill, not an agent: breakdown is an
  interactive approval dialogue, which cadence's core values keep in-session.
- `/cadence:refine` detects epic-sized ideas (multiple independent
  deliverables, or above 8 points), records them as `type: epic`, and hands
  off to breakdown — so large backlog entries are split into workable items
  at creation time.
- `/cadence:sprint-plan` UX: candidates (ready leaves only, grouped under
  their epic) come with a recommended selection — budgeted against last
  sprint's velocity minus carryovers, favoring items that close out an
  in-flight epic, then epic coherence, then oldest-first — each with a
  one-line reason. The skill then *proposes* a goal derived from the
  selection instead of asking cold. Accepting either is one word; the user
  keeps the final pick and the no-goal-no-sprint gate stands.
- `/cadence:review` rolls done-ness up: when the last child of a parent
  passes review, the parent flips to `done` in the backlog (cascading upward)
  — the one derived exception to "only the reviewer marks done."
- `/cadence:spec` refuses epics/containers; `/cadence:work` reads the parent
  chain's design docs for context; `/cadence:board` renders the hierarchy
  with per-container child progress; conversate routes "break this down" and
  childless-epic references to breakdown.
- `validate-board.js` enforces the hierarchy: valid `type` values, epics only
  in the backlog and never nested, story parents must be epics and task
  parents stories, `parent` must resolve to a backlog item for live copies,
  containers only `idea`/`done`, and backlog `done` only for containers.

## 0.8.1 — 2026-07-03

- Fixed `/cadence:obsidian-graph` failing with Obsidian's "Vault not found"
  dialog on first use: `obsidian://open?path=` only resolves paths inside
  vaults Obsidian already knows, and nothing registered `cadence/` in
  Obsidian's global vault registry. `open-obsidian.js` now registers the
  vault (idempotently, best-effort) in `obsidian.json` — found per platform,
  including snap/flatpak locations on Linux — before launching the URI, and
  reports `vaultRegistered`/`registration` in its JSON output. If Obsidian
  was already running when the vault was first registered, it may need a
  restart to pick it up; the skill now says so.

## 0.8.0 — 2026-07-03

- Two-way brain awareness (fourth and final Obsidian sub-project): notes
  hand-edited directly in Obsidian are now detected instead of silently
  absorbed or overwritten. A baseline of note mtimes lives in
  `cadence/.brain-state.json`; the new `list_changed_notes` MCP tool diffs
  against it (added / modified / deleted) and `acknowledge: true` marks
  everything seen (the first acknowledge creates the baseline, so tracking
  is opt-in and older brains behave as before). `write_note` keeps the
  baseline in sync with its own writes, so only genuine outside edits show
  up.
- The every-turn reminder now appends a hand-edit alert (count + up to five
  note names) whenever tracked brain notes changed outside cadence, routing
  reconciliation to the brain-curator.
- brain-curator now starts by checking for hand-edits (hand-edited content
  is ground truth — folded around, never reverted) and finishes by
  acknowledging the sync.

## 0.7.0 — 2026-07-03

- Richer brain note structure (third of the four Obsidian sub-projects):
  hierarchical tags (`api/auth`, max two levels, reuse-over-synonyms),
  optional `aliases` frontmatter, and Maps of Content — hub notes named
  `moc-<topic>.md` with `type: moc` that the brain-curator creates once a
  top-level tag reaches 5 notes and keeps linked thereafter. Existing notes
  migrate opportunistically whenever the curator touches them.
- New `list_tags` MCP tool: tag → count/notes aggregation that makes the
  tag-reuse and MOC-threshold rules executable instead of aspirational.
- Canvas files were evaluated and deliberately descoped: auto-generated
  canvases need manual spatial layout to be worth anything, and Graph View
  plus MOCs already cover the navigation value.

## 0.6.0 — 2026-07-03

- Added the `cadence-brain` MCP server (`scripts/brain-mcp.js`), a
  dependency-free MCP stdio implementation registered via `.mcp.json`. It
  exposes the brain as structured tools — `search_notes`, `read_note`,
  `write_note`, `list_backlinks`, `get_related`, `list_orphans`,
  `list_unresolved_links` — reading `cadence/brain/` fresh on every call so
  results always reflect the files on disk. Second of the four planned
  Obsidian sub-projects.
- Added `/cadence:obsidian-graph`: opens the project's `cadence/` folder in
  Obsidian via the `obsidian://open` URI and points the user at Graph View
  with the default hotkey (Ctrl+G / Cmd+G). Obsidian's URI scheme has no
  direct graph action, and pre-writing `workspace.json` is deliberately
  avoided (undocumented schema, machine-specific ids), so the hotkey hint is
  the honest mechanism.
- `brain-curator` and the cadence-brain rules now prefer the MCP tools over
  raw file greps when available; `write_note`'s description enforces
  read-before-overwrite.

## 0.5.0 — 2026-07-03

- Added `/cadence:install-obsidian`: one-time, user-only setup that detects
  whether Obsidian is installed (fixed per-OS install locations, so manual
  installs are recognized), offers to install it via winget / brew cask /
  snap / flatpak after showing the exact command and getting confirmation,
  and scaffolds `cadence/.obsidian/` with config captured verbatim from a
  real Obsidian-generated vault (core plugins for graph view, backlinks,
  tags, and search). Scaffolding is skip-if-exists — it never overwrites a
  live vault config, so re-running the command is always safe. First of the
  four planned Obsidian sub-projects (setup, MCP server, richer notes,
  two-way sync).
- New `scripts/` directory for command-owned Node scripts (previously only
  hooks had scripts); `node --test scripts/install-obsidian.test.js` covers
  platform detection, package-manager resolution, install dispatch, and the
  scaffold guard.

## 0.4.0 — 2026-07-02

- Added the `cadence-coder` agent (`model: inherit`): language-adaptive
  implementation of one ticket or one confirmed bug fix. It detects the repo's
  stack and conventions, implements test-first to the language community's own
  standard, never commits, and never touches `cadence/` data files.
  `cadence-work` dispatches it as the default implementation path for
  self-contained tickets (inline implementation remains for dialogue-heavy
  work), and `cadence-systematic-debugger` dispatches it for fixes bigger than
  a few lines -- keeping the orchestrating session's context lean.
- The every-turn reminder now routes only messages that concern project work
  through `cadence-conversate`; unrelated questions are answered directly
  instead of being forced into classification.
- `cadence-work`'s frontend-design deferral is now conditional on that skill
  being installed, matching the existing TDD-skill phrasing.

## 0.3.0 — 2026-07-02

- Skills no longer appear in the `/` menu: every `skills/cadence-*` file now
  sets `user-invocable: false`, making the `commands/*` wrappers the only
  user-facing entry points (previously each capability showed up twice).
- Gated skills swap `disable-model-invocation: true` for a description guard
  ("only invoke when dispatched by the command or conversate routing") --
  the flag would have blocked the command wrappers' own Skill-tool dispatch
  once the skills were hidden. The skills' internal approval gates remain
  the enforcement mechanism, unchanged.

## 0.2.0 — 2026-07-02

- Added `hooks/guard.js` (PreToolUse on Bash and PowerShell): mechanically
  blocks git commits that use `--no-verify` or carry an Anthropic/Claude
  attribution line. These rules were previously prose-only in
  `cadence-brain`/`cadence-core`.
- Added `hooks/validate-board.js` (PostToolUse): validates `cadence/backlog.yml`
  and `cadence/sprint-*.yml` after every write — status values, `C-<n>` id
  format, duplicate ids, one `in_progress` item, one active sprint, and the
  one-live-copy-per-item rule. Feeds violations straight back to Claude.
- Quoted `${CLAUDE_PLUGIN_ROOT}` in `hooks.json` (paths with spaces) and set
  a 10s timeout on every hook.
- Trimmed the every-turn reminder text for token economy.
- `cadence-work` now flips a ticket to `in_progress` before implementation
  starts, so an interrupted session leaves the board accurate.
- `cadence-review` documents the not-a-git-repo / no-commits edge case.
- `cadence-review` now resumes an item stuck at `status: review` (interrupted
  review session) instead of refusing it, and `cadence-conversate` routes such
  items back to review -- previously the only recovery was hand-editing YAML.
- `brain-curator` is explicitly scoped to writing inside `cadence/brain/`.
- Trimmed boilerplate sections from the `cadence-core` and `cadence-brain`
  background skills; the every-turn reminder now carries the two most critical
  core rules (review-only done, brain-first) instead of relying solely on
  description-based auto-loading.
- Simplified `brain-curator`'s backlinking step into two explicit passes for
  reliable execution on haiku.
- Test coverage for all three hook scripts (`node --test hooks/*.test.js`).

## 0.1.0 — 2026-07-02

- Initial release: conversate, brainstorm, refine, spec, sprint-plan, work,
  review, standup, board, systematic-debugger, code-reviewer; cadence-reviewer
  and brain-curator agents; every-turn workflow reminder hook.
