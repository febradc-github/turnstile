# Changelog

## Unreleased

- New per-project settings file `turnstile/config.yml`, read by the
  dependency-free `scripts/config.js` (CLI: one JSON line). Missing file
  means defaults; unknown keys are ignored and invalid values fall back to
  defaults, each with a warning the reading skill surfaces once — bad
  config never breaks the pipeline.
- `profile: solo | full` (default `full`). Solo collapses the design and
  spec gates for leaf items into one plan artifact —
  `turnstile/plans/PL-<n>.md`, design and acceptance criteria together —
  written by `/turnstile:refine`; one approval marks the item `ready`.
  Epics use the full breakdown pipeline in both profiles. `/turnstile:spec`
  explains instead of failing when a plan already covers the item.
  `/turnstile:review` resolves criteria per ticket (SP → PL → item note),
  so switching profile mid-project is safe and mixed artifacts coexist.
  The review gate is unchanged in both profiles.
- `/turnstile:quick` ceiling raised from 2 to 3 points and made
  configurable (`quick_max_points`). The `added_mid_sprint` honesty flag
  is unchanged.
- `cadence: sprint | flow` (default `sprint`). Flow has no sprint
  ceremony: `ready` items queue in the backlog and the new
  `/turnstile:next` pulls the top one onto the flow board — `sprint.yml`
  with a `mode: flow` marker, so every board hook and invariant applies
  unchanged. `/turnstile:sprint-plan` in flow mode explains the mode,
  offers to archive a leftover sprint (the required step before the
  switch takes effect), and points to `/turnstile:next`.
  `validate-board.js` validates the `mode` header (`sprint`/`flow`).
- The brain is lazy by default: `turnstile/code/` notes are created or
  updated only for files a ticket touched, at the moment the ticket
  passes review. `/turnstile:brain-init` becomes an explicit opt-in with
  a vault-size and staleness warning before anything is scanned — empty
  brain beats stale brain.
- `capture: gates | opportunistic` (default `gates`). Gates mode
  dispatches brain-curator deterministically at exactly four transitions,
  each with bounded input: review passes (diff + ticket + criteria, also
  writes the touched files' code notes), design/plan approved, ticket
  dropped (dead-end note), systematic-debugger concludes (confirmed root
  cause only, never mid-investigation guesses). Opportunistic mode keeps
  the previous whenever-something-is-memorable behavior. New
  `/turnstile:remember [note]` in both modes: the user dictates the
  content, the curator only files, tags, and links it.
  `scripts/token-report.js` now models both modes side by side: over the
  30-turn reference session (3 tickets), gates makes 6 curator dispatches
  (73,221 chars, ~18,305 tokens) vs opportunistic's 15 (189,618 chars,
  ~47,405 tokens) — 61.4% less capture overhead.
- `/turnstile:pickup` replaces `/turnstile:standup`: instead of a progress
  report, it restores work state — the in-progress ticket, its
  implementation state, what was blocking, and the relevant
  decision/brain notes — answering "where was I and what was I about to
  do". It restores state from the board and vault, unlike the built-in
  `/resume`, which restores a past conversation (the command is
  deliberately not named `resume`). `/turnstile:standup` remains for one
  release as a deprecated alias that prints a notice and runs pickup;
  planned for removal in the next release. Standup's `added_mid_sprint`
  scope-honesty summary moved to `/turnstile:board`. New contributor
  rule in the README: command basenames must not duplicate Claude Code
  built-ins or core mode names.
- New `/turnstile:park [reason]` and `parked` status: stashes the single
  `in_progress` ticket with a `parked_at` timestamp on the board and a
  resume note (current state, next step, blockers) in the item note, so
  urgent unrelated work can start while the one-`in_progress` invariant
  holds — parked items don't count against it. `/turnstile:pickup` with
  nothing in progress offers to un-park the most recently parked ticket,
  reading its resume note first; the `## Resume` section stays as history
  after un-parking. `validate-board.js` enforces both invariants on live
  boards (parked ⇒ `parked_at` present, and a shallow check that the item
  note exists with a `## Resume` heading — it never parses note structure
  beyond that).
- Obsidian decoupled in framing: the vault is plain markdown with
  wikilinks — greppable, diffable, readable in any editor — and Obsidian
  is the optional viewer, not a dependency. Nothing in the pipeline
  requires it. `/turnstile:install-obsidian` stays as explicitly optional
  convenience tooling (README Data section, command, and skill
  descriptions reworded; no behavior change).

## 0.21.0 — 2026-07-18

- Renamed plugin display name to **Turnstile** (`plugin.json`, `marketplace.json`, README).
- Loop Watch dashboard visual overhaul (C-5): corner node positions with
  `transform: translate(-50%,-50%)` replacing broken edge-midpoint `calc()` offsets;
  responsive `min(120px,24vw)` × `min(60px,12vw)` node sizing; four `.trace` divs for
  circuit lines; pulse keyframes rewritten to corner coordinates at 6s; JS demo cycle
  (1.5s per node) when `state.phase` is null, gated clear on non-null phase; terminal
  log fixed to 64px with `overflow:hidden`, demo lines with `.log-highlight` cyan spans.
  31 tests (16 prior + 15 new).

## 0.20.0 — 2026-07-13

Progressive-disclosure release: the plugin now loads in three layers —
always-on metadata, on-invoke skill bodies, and on-demand `references/`
files read only at the step that needs them. All numbers measured with
`scripts/token-report.js` against the 0.19.0 tree (30-turn reference
session).

- Every counted frontmatter description rewritten as a lean capability
  statement (6,735 -> 3,870 chars) and the three model-visible wrapper
  commands (board, standup, conversate) marked
  `disable-model-invocation: true` — their skills carry the routing
  descriptions, so the commands now cost the / menu only. MCP tool and
  schema descriptions trimmed to one sentence each. Always-on overhead:
  10,106 -> 6,479 chars (−35.9%).
- Templates, format blocks, and mode detail moved out of skill/agent
  bodies into references loaded on demand: refine and breakdown design/
  item-note/backlog templates, the sprint file template, the quick item
  note, the spec template, and brain-curator's code-note format + bulk
  mode (now `skills/turnstile-brain/references/curator-code-notes.md`,
  loaded via `${CLAUDE_PLUGIN_ROOT}` only when a code note is written).
  Reference-workflow invoked bodies: 42,848 -> 30,255 chars (−29.4%);
  per-invoke bodies of the write-heavy skills drop 45–55% (e.g. refine
  9,421 -> ~4,600).
- Boilerplate Purpose/Inputs/Outputs sections and duplicated error-handling
  prose removed across skills; every rule in an `<important>` block kept
  verbatim or tightened in place, never moved to a reference.
- Net effect: total plugin-emitted context 56,737 -> 40,517 chars
  (−28.6%, ~4,000 tokens saved per session) and 30-turn cumulative context
  −29.4%, on top of 0.18.0's 27–47% cut. All 121 tests pass; no behavior
  change intended anywhere — every gate, refusal, and dispatch rule
  survives in the lean layer.

## 0.19.0 — 2026-07-13

- New core rule (in the `<important>` block, where hard rules stick): chat
  replies are lean -- lead with the answer or verdict, include only what
  changes the user's next action, never quote file contents, board tables,
  or the rules back unprompted, and never recap a rendered table in prose.
  Closes the output-token side of the token-economy value: 0.18.0 cut what
  the plugin injects into the context window; this constrains what the
  model says back. One line in turnstile-core covers every skill, since core
  auto-loads whenever any cadence skill is active.
- Discoverability: the GitHub repo now carries 14 topics (claude-code,
  claude-code-plugin, agile-workflow, obsidian, sprint-planning, ...) so
  the plugin is findable via GitHub topic pages and search engines.
  Repo-metadata change; nothing in the tree.

## 0.18.0 — 2026-07-13

Token-efficiency and enterprise-readiness release. All numbers below are
measured (scripts/token-report.js, real hook runs against a v0.17.1 git
worktree), not estimated.

- `remind.js` is session-aware: the full workflow reminder is injected on the
  first prompt of a session and every 30th after (so it survives context
  compaction); every other prompt gets a one-line anchor. Recurring reminder
  overhead drops 80.6% over a 30-turn session (19,530 -> 3,783 chars) and
  80.1% over 100 turns (65,100 -> 12,972). Total plugin-emitted context falls
  27% (30 turns) to 47% (100 turns). Without a session id on stdin the hook
  falls back to the old always-full behavior. State lives in
  `turnstile/.remind-state.json` (pruned to 20 sessions).
- The reminder's vault health checks (hand-edits, strays, unresolved links)
  now share one vault load via the new `vaultAlerts` helper instead of three
  separate full-vault reads per prompt.
- `search_notes` caps results at 20 notes by default (`limit` up to 100) and
  reports `total`/`truncated`, so a broad query on a large vault cannot flood
  the context window. MCP tool descriptions trimmed ~45% with the same
  semantics.
- `turnstile-brain` moved its note-format reference (shared frontmatter, per-
  kind rules, stray handling, legacy paths) to
  `skills/turnstile-brain/references/note-format.md`, loaded only when a note
  is about to be written; an `<important>` rule mandates reading it before
  any note write. The auto-loaded body shrinks ~48% with no rule dropped.
- The brain MCP server version now tracks plugin.json instead of a hardcoded
  string (was stuck at 0.11.0).
- New `scripts/token-report.js` measures plugin-injected context overhead
  (fixed, per-prompt, invoked bodies) for any checkout, so future changes are
  held to measured numbers.
- Enterprise: MIT LICENSE; GitHub Actions CI (test suite on Linux + Windows,
  Node 20/22, plugin/marketplace version-consistency check); `.gitattributes`
  normalizes line endings (ends the CRLF warning noise on Windows). Test
  suite grows 110 -> 121.

## 0.17.1 — 2026-07-13

- Fix: `turnstile-conversate` was not reliably checking `turnstile/code/` before
  answering ad-hoc code questions -- verified live in a brand-new session
  with 0.17.0 installed, the note-then-verify-source procedure was skipped
  entirely in favor of Grep/Read. Root cause: the rule lived only as prose
  inside a 10-item case list, competing with a strong default habit. Fix:
  promoted a short, imperative version of the rule into the `<important>`
  block at the top of the skill (the pattern that already makes the other
  conversate gating rules and `turnstile-brain`'s own "check the brain first"
  mandate stick); the detailed procedure stays in the case list unchanged.

## 0.17.0 — 2026-07-13

- `turnstile-conversate` now checks `turnstile/code/` before answering an ad-hoc
  "what does this code do" question: read the note, then read the source
  file its alias points to, and answer from the file if the two have
  drifted apart. On drift, conversate dispatches `brain-curator`
  (opportunistic, single file) to correct the note -- it never edits a
  `turnstile/code/` note itself. Missing notes fall back to Grep/Read as
  before; conversate never backfills coverage, that stays `/turnstile:brain-init`'s job.

## 0.16.1 — 2026-07-10

- README: replaced the `Design` section (links only) with a `Usage` section
  -- an ASCII sequence diagram of the golden path through one ticket
  (brainstorm -> refine -> spec -> sprint-plan -> work -> review), showing
  where Turnstile writes to `turnstile/` and dispatches agents. Docs only, no
  functional change.

## 0.16.0 — 2026-07-10

- New `/turnstile:brain-init`: bulk-bootstraps code-level documentation. Every
  source file (git ls-files, source-extension allowlist) gets a
  `turnstile/code/<path-slug>.md` note -- purpose, exports, imports, callers --
  written by parallel brain-curator dispatches (model overridden to sonnet;
  grep-verified connections, no parser; at most 4 in flight). Reruns are
  additive: documented files are skipped, notes for deleted files are removed
  after a single named-list confirmation. A final stitch pass links each
  directory's file notes into `AR-<dir>` architecture notes and cleans
  backlinks to removed notes.
- brain-curator gains the code-file branch and now also keeps `code/` notes
  current opportunistically: work and systematic-debugger include touched
  files in their existing curator dispatch. Still four agents.
- `code/` is the fourth curator-owned knowledge folder: `write_note
  folder: code`, hand-edit tracking, and the remind alert extend to it.
- Link safety: file-note links always target the path slug
  (`[[scripts-brain-mcp-js|scripts/brain-mcp.js]]`); aliases carry the full
  relative path only. Paths inside link targets and basename aliases are
  click-traps that mint stray notes.

## 0.15.0 — 2026-07-08

- Version bump only; no functional changes since 0.14.0.

## 0.14.0 — 2026-07-08

- Hard rule: never read env files. `guard.js` now runs on every file and
  shell tool (Read/Edit/Write/NotebookEdit/Grep/Glob/Bash/PowerShell) and
  blocks any access to `.env`, `.env.*`, `*.env`, or `.envrc` -- by file
  path, by glob, or by a shell command referencing one -- with exit 2, so
  the attempt is stopped before it happens. Wildcards (`cat .env*`,
  `**/*.env`) are caught; look-alikes (`environment.md`, `.venv/`,
  `$NODE_ENV`, `env-check.test.js`) are not blocked. The rule is also
  re-injected every turn by the reminder and stated in turnstile-core and
  turnstile-coder: secrets are never read -- ask the user for config values.

## 0.13.0 — 2026-07-04

- New `pitch-agent` (fourth cadence agent): anchoring-free idea pitches for
  `/turnstile:brainstorm`. On epic-scale ideas (or on request) brainstorm
  convenes a panel — three parallel dispatches with forced stances
  (minimalist: smallest viable version; skeptic: why not, checked against
  recorded ADRs; scout: prior art from the vault and web) — then synthesizes
  the pitches into 2-3 distinct directions for the user to pick from.
  Panelists get the idea summary and vault findings, never the dialogue
  transcript: an unanchored take is the point, same isolation rationale as
  turnstile-reviewer. The panel is gated (no panel for trivial ideas), pitches
  are capped at 150 words, convergent pitches are reported honestly rather
  than dressed up as disagreement, and rejected directions ride the refine
  handoff into the decision trail.

## 0.12.0 — 2026-07-03

- Stable sprint board: the current sprint always lives at `turnstile/sprint.yml`
  (with a `number` field); completed sprints are archived immutably to
  `turnstile/sprints/sprint-<N>.yml` by sprint-plan, which also migrates legacy
  root `sprint-N.yml` files. Two fixed filenames answer "what's waiting"
  (backlog.yml) and "what's happening" (sprint.yml); archives feed velocity.
- Slim YAML: board entries now carry tracking fields only (id, title, type,
  parent, status, points, assignee, carryovers, notes). Descriptions live in
  the item notes, acceptance criteria in the specs — the spec-to-backlog
  verbatim-copy rule is gone, eliminating that drift class. Legacy long
  fields are ignored and removed opportunistically.
- New `/turnstile:quick`: the fast lane. Trivial work (≤2 points, no design
  questions) or a diagnosed bug becomes a task/story with inline acceptance
  criteria in its item note — no design doc, no spec, one approval — added to
  the current sprint (`added_mid_sprint: true`) or as `ready` backlog when no
  sprint is active. work/review read quick items' criteria from the item note.
- Bugs become tracked work: systematic-debugger, after confirming a root
  cause, fixes it inside the related `in_progress` ticket's diff, or (if
  unrelated) creates a quick bug task that runs right after — starting it
  immediately when nothing is in progress. Closes the hole where bug fixes
  ended as unreviewed, uncommitted changes; the one-in_progress rule stands.
- New `/turnstile:drop`: cancellation with a paper trail. Sets `status: dropped`
  with a recorded reason (cascading over children after confirmation) instead
  of hand-deleting YAML; dropped items render as cancelled on the board and
  parent rollups ignore them.
- Standup now reports mid-sprint scope growth ("N of M points added
  mid-sprint"); the board marks quick-added items.
- validate-board.js enforces the new layout: `sprint.yml` is the only active
  board, `sprints/` archives must be completed, `dropped` accepted everywhere,
  legacy root sprint files still validated.
- README documents what `C-` means (the shared cadence ticket counter).

## 0.11.0 — 2026-07-03

- Corrected a wrong assumption from 0.10.0: Obsidian resolves a `[[wikilink]]`
  by exact filename only — aliases feed autocomplete and the quick switcher
  but never resolve a typed link, so alias-based `[[C-2]]` references were
  unresolved click-traps. Note naming is now typed prefixes carrying the
  ticket number: `EP-<n>` (epics), `US-<n>` (user stories), `TK-<n>` (tasks),
  `DS-<n>` (designs), `SP-<n>` (specs), `AR-<topic>` (architecture); ticket
  `C-7` maps to `EP-7`/`US-7`/`TK-7` plus `DS-7`/`SP-7`, so one number traces
  a ticket across every folder and every link resolves by filename. Board ids
  stay `C-<n>`; item notes carry the board id and title as search aliases.
  Links never use a bare board id — `[[US-7]]`, not `[[C-7]]`.
- Links must exist before they're written: every skill and the brain-curator
  verify a `[[target]]` resolves to a real filename before adding it to a
  `related` list or body (mutually-linked note sets are written in one pass
  and checked with `list_unresolved_links`); the curator ends each dispatch
  by confirming it introduced no unresolved targets.
- The every-turn reminder now also lists unresolved wikilink targets
  vault-wide — each one is a click-trap that would mint a stray note — with
  instructions to fix, create properly, or drop the link.
- MCP server semantics follow Obsidian's: `list_unresolved_links` and
  `list_orphans` count alias-only matches as unresolved (an alias never
  resolves a raw link), while read/search lookups still accept aliases as a
  convenience. `list_stray_notes` additionally flags duplicate basenames
  anywhere in the vault (ambiguous links), reported as `name-collision` with
  the colliding path.

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
  - `/turnstile:install-obsidian` now scaffolds `app.json` with the new-note
    default pointed at `brain/`, so accidental creations land in hand-edit-
    tracked territory instead of the root (existing vaults are untouched;
    the detection layers cover them).

## 0.10.0 — 2026-07-03

- The whole `turnstile/` folder is now one interconnected Obsidian vault. Every
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
  `/turnstile:work` and `/turnstile:code-reviewer` explicitly check recorded
  decisions so implementations don't silently contradict an ADR.

## 0.9.0 — 2026-07-03

- Epic -> user story -> task hierarchy. Items gain optional `type`
  (`epic`/`story`/`task`; absent means story) and `parent` fields — same
  `C-<n>` id counter, fully backward compatible with existing boards.
- New `/turnstile:breakdown [id]`: approval-gated decomposition of an epic into
  stories or an oversized story into tasks (two levels max). Writes a design
  doc per child referencing the parent's, appends children to the backlog at
  `status: idea`, and resets a formerly-`ready` parent to `idea` — containers
  never enter sprints; their leaves do. A skill, not an agent: breakdown is an
  interactive approval dialogue, which cadence's core values keep in-session.
- `/turnstile:refine` detects epic-sized ideas (multiple independent
  deliverables, or above 8 points), records them as `type: epic`, and hands
  off to breakdown — so large backlog entries are split into workable items
  at creation time.
- `/turnstile:sprint-plan` UX: candidates (ready leaves only, grouped under
  their epic) come with a recommended selection — budgeted against last
  sprint's velocity minus carryovers, favoring items that close out an
  in-flight epic, then epic coherence, then oldest-first — each with a
  one-line reason. The skill then *proposes* a goal derived from the
  selection instead of asking cold. Accepting either is one word; the user
  keeps the final pick and the no-goal-no-sprint gate stands.
- `/turnstile:review` rolls done-ness up: when the last child of a parent
  passes review, the parent flips to `done` in the backlog (cascading upward)
  — the one derived exception to "only the reviewer marks done."
- `/turnstile:spec` refuses epics/containers; `/turnstile:work` reads the parent
  chain's design docs for context; `/turnstile:board` renders the hierarchy
  with per-container child progress; conversate routes "break this down" and
  childless-epic references to breakdown.
- `validate-board.js` enforces the hierarchy: valid `type` values, epics only
  in the backlog and never nested, story parents must be epics and task
  parents stories, `parent` must resolve to a backlog item for live copies,
  containers only `idea`/`done`, and backlog `done` only for containers.

## 0.8.1 — 2026-07-03

- Fixed `/turnstile:obsidian-graph` failing with Obsidian's "Vault not found"
  dialog on first use: `obsidian://open?path=` only resolves paths inside
  vaults Obsidian already knows, and nothing registered `turnstile/` in
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
  `turnstile/.brain-state.json`; the new `list_changed_notes` MCP tool diffs
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

- Added the `turnstile-brain` MCP server (`scripts/brain-mcp.js`), a
  dependency-free MCP stdio implementation registered via `.mcp.json`. It
  exposes the brain as structured tools — `search_notes`, `read_note`,
  `write_note`, `list_backlinks`, `get_related`, `list_orphans`,
  `list_unresolved_links` — reading `turnstile/brain/` fresh on every call so
  results always reflect the files on disk. Second of the four planned
  Obsidian sub-projects.
- Added `/turnstile:obsidian-graph`: opens the project's `turnstile/` folder in
  Obsidian via the `obsidian://open` URI and points the user at Graph View
  with the default hotkey (Ctrl+G / Cmd+G). Obsidian's URI scheme has no
  direct graph action, and pre-writing `workspace.json` is deliberately
  avoided (undocumented schema, machine-specific ids), so the hotkey hint is
  the honest mechanism.
- `brain-curator` and the turnstile-brain rules now prefer the MCP tools over
  raw file greps when available; `write_note`'s description enforces
  read-before-overwrite.

## 0.5.0 — 2026-07-03

- Added `/turnstile:install-obsidian`: one-time, user-only setup that detects
  whether Obsidian is installed (fixed per-OS install locations, so manual
  installs are recognized), offers to install it via winget / brew cask /
  snap / flatpak after showing the exact command and getting confirmation,
  and scaffolds `turnstile/.obsidian/` with config captured verbatim from a
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

- Added the `turnstile-coder` agent (`model: inherit`): language-adaptive
  implementation of one ticket or one confirmed bug fix. It detects the repo's
  stack and conventions, implements test-first to the language community's own
  standard, never commits, and never touches `turnstile/` data files.
  `turnstile-work` dispatches it as the default implementation path for
  self-contained tickets (inline implementation remains for dialogue-heavy
  work), and `turnstile-systematic-debugger` dispatches it for fixes bigger than
  a few lines -- keeping the orchestrating session's context lean.
- The every-turn reminder now routes only messages that concern project work
  through `turnstile-conversate`; unrelated questions are answered directly
  instead of being forced into classification.
- `turnstile-work`'s frontend-design deferral is now conditional on that skill
  being installed, matching the existing TDD-skill phrasing.

## 0.3.0 — 2026-07-02

- Skills no longer appear in the `/` menu: every `skills/turnstile-*` file now
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
  `turnstile-brain`/`turnstile-core`.
- Added `hooks/validate-board.js` (PostToolUse): validates `turnstile/backlog.yml`
  and `turnstile/sprint-*.yml` after every write — status values, `C-<n>` id
  format, duplicate ids, one `in_progress` item, one active sprint, and the
  one-live-copy-per-item rule. Feeds violations straight back to Claude.
- Quoted `${CLAUDE_PLUGIN_ROOT}` in `hooks.json` (paths with spaces) and set
  a 10s timeout on every hook.
- Trimmed the every-turn reminder text for token economy.
- `turnstile-work` now flips a ticket to `in_progress` before implementation
  starts, so an interrupted session leaves the board accurate.
- `turnstile-review` documents the not-a-git-repo / no-commits edge case.
- `turnstile-review` now resumes an item stuck at `status: review` (interrupted
  review session) instead of refusing it, and `turnstile-conversate` routes such
  items back to review -- previously the only recovery was hand-editing YAML.
- `brain-curator` is explicitly scoped to writing inside `turnstile/brain/`.
- Trimmed boilerplate sections from the `turnstile-core` and `turnstile-brain`
  background skills; the every-turn reminder now carries the two most critical
  core rules (review-only done, brain-first) instead of relying solely on
  description-based auto-loading.
- Simplified `brain-curator`'s backlinking step into two explicit passes for
  reliable execution on haiku.
- Test coverage for all three hook scripts (`node --test hooks/*.test.js`).

## 0.1.0 — 2026-07-02

- Initial release: conversate, brainstorm, refine, spec, sprint-plan, work,
  review, standup, board, systematic-debugger, code-reviewer; turnstile-reviewer
  and brain-curator agents; every-turn workflow reminder hook.
