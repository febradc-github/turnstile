# Turnstile

A gated, file-based agile workflow plugin for Claude Code. Turnstile tracks
work on a YAML board, enforces hard approval gates so nothing skips ahead of
its own readiness, and maintains a persistent, Obsidian-linked knowledge brain
that survives across sessions.

## Requirements

Node.js (any current LTS) must be on `PATH` — the plugin's hooks are small
dependency-free Node scripts.

## Install

In Claude Code:

1. Run `/plugin`.
2. Choose **Marketplaces** -> **Add marketplace**.
3. Paste the repo link: `https://github.com/febradc-github/cadence-ai`
4. Back in the plugin menu, install **cadence** from the `cadence-ai`
   marketplace.

## Install (local development)

    claude --plugin-dir ./cadence-plugin

## Commands vs. skills

Every capability has two files: a `commands/<name>.md` (the one-word command
you type, e.g. `/cadence:refine`) and a `skills/cadence-<name>/SKILL.md` (the
actual behavior, internally named `cadence-<name>` so it's never ambiguous
with a same-named skill from a different plugin). The command is a thin
wrapper that dispatches to the skill.

Every skill sets `user-invocable: false`, so the commands are the only
entries in the `/` menu -- skills never appear there and are reachable only
through their command wrapper or conversate's routing (via the Skill tool).

## Commands

| Command | Purpose |
|---|---|
| `/cadence:conversate [message]` | Casual entry point; classifies intent and directly invokes the right skill. |
| `/cadence:brainstorm [idea]` | Loose, exploratory idea-shaping. No file writes. Hands off to refine. |
| `/cadence:refine [idea]` | Gap-closing dialogue; writes a design doc for approval. Epic-sized ideas are recorded as epics and handed to breakdown. |
| `/cadence:breakdown [id]` | Decomposes an epic into user stories, or an oversized story into tasks; requires approval. |
| `/cadence:spec [id]` | Turns an approved design into a checkable spec; requires approval. |
| `/cadence:sprint-plan` | Starts a new sprint; archives the finished one; recommends which ready items to pull in and proposes a goal; rolls over unfinished work. |
| `/cadence:quick [description]` | Fast lane: trivial work or a diagnosed bug becomes a small task in the current sprint after one approval -- no design doc, no spec. 2 points max. |
| `/cadence:drop [id] [reason]` | Cancels a ticket: status `dropped` with a recorded reason. History, not deletion. |
| `/cadence:work [id]` | Implements one ticket with TDD. |
| `/cadence:review [id]` | Independent done-ness check; commits on pass. |
| `/cadence:standup` | Read-only progress/blocker report on the active sprint. |
| `/cadence:board` | Read-only render of the whole board. |
| `/cadence:systematic-debugger [bug]` | Independent root-cause debugging. Ad hoc, not gated. |
| `/cadence:code-reviewer [scope]` | Advisory code/diff review. Ad hoc, not gated, never commits. |
| `/cadence:install-obsidian` | One-time setup: installs Obsidian via the OS package manager (with confirmation) and scaffolds `cadence/.obsidian/` as a working vault. Idempotent. |
| `/cadence:obsidian-graph` | Opens `cadence/` in Obsidian and points you at Graph View (Ctrl+G / Cmd+G). |
| `/cadence:brain-init` | Bulk-documents every source file as a linked `cadence/code/` note (purpose, imports, exports, callers). Re-runnable; only adds missing notes. |

## Agents

Four agents exist because each structurally requires isolation from the main
session; nothing else is agent-shaped.

| Agent | Model | Role |
|---|---|---|
| `cadence-coder` | inherit | Language-adaptive implementation of one ticket or confirmed bug fix, test-first, matching the repo's existing conventions. Dispatched by `/cadence:work` (self-contained tickets) and `/cadence:systematic-debugger` (non-trivial fixes). Never commits, never touches `cadence/` data files. |
| `cadence-reviewer` | opus | Independent done-ness verdict for `/cadence:review`; judges only the criteria and the diff, read-only. |
| `brain-curator` | haiku | Sole writer of the knowledge folders (`cadence/brain/`, `cadence/decisions/`, `cadence/architecture/`, `cadence/code/`); dispatched opportunistically when something worth remembering happens. |
| `pitch-agent` | inherit | Anchoring-free idea pitches for `/cadence:brainstorm`'s panel: dispatched 2-3× in parallel with forced stances (minimalist, skeptic, scout) on epic-scale ideas or on request. Sees the idea summary, never the dialogue. Read-only. |

## Workflow

    rough idea --(/cadence:brainstorm)--> shaped idea
               --(/cadence:refine)------> design approved
               --(/cadence:spec)--------> spec approved --> ready
               --(/cadence:sprint-plan)-> todo --> in_progress
               --(/cadence:review, passes)--> done

Epic-sized ideas take a detour: `/cadence:refine` records them as `type: epic`
and `/cadence:breakdown` splits them into user stories (and oversized stories
into tasks; two levels max). Each child then flows through spec -> ready ->
sprint on its own. Epics and other parents never enter a sprint; when the last
child passes review, the parent is marked done automatically.

Two pragmatic side doors keep the pipeline agile. `/cadence:quick` lets
trivial work (≤2 points, criteria written inline in the item note) enter the
current sprint after a single approval, marked `added_mid_sprint` so standup
reports scope growth honestly. And a reported bug becomes tracked work via
the debugger: related to the in-progress ticket, it's fixed within that
ticket's diff; unrelated, it becomes a quick bug task that runs right after —
so every fix is reviewed and committed under a ticket, and only one thing is
ever in progress.

`/cadence:conversate` classifies a message and drives this pipeline directly
instead of requiring each command to be typed by hand.

## Data

Cadence reads and writes a `cadence/` folder in your project repo. The whole
folder is an Obsidian vault; every markdown file in it follows one shared
note format (frontmatter + wikilinks), so items, designs, specs, decisions,
architecture, code, and brain notes all interconnect in Graph View:

    cadence/
      backlog.yml                       # unplanned work: idea -> ready (or dropped)
      sprint.yml                        # the current sprint -- always this filename
      sprints/sprint-<N>.yml            # completed sprints, immutable archive
      epics/EP-<n>.md                   # one item note per epic
      user-stories/US-<n>.md            # one item note per user story
      tasks/TK-<n>.md                   # one item note per task
      designs/DS-<n>.md                 # design doc per item
      specs/SP-<n>.md                   # spec per leaf item
      architecture/AR-<topic>.md        # how the system is shaped
      decisions/adr-<NNN>-<slug>.md     # why it is shaped that way (ADRs)
      brain/*.md, brain/moc-<topic>.md  # domain/process knowledge, MOCs
      code/<path-slug>.md               # one note per source file -- purpose, exports, imports, callers
      .brain-state.json                 # hand-edit tracking baseline

Ticket ids are `C-<n>` -- the `C` simply means *cadence*, one shared counter
for every item so a number is minted exactly once. `<n>` is that same number:
ticket `C-7` maps to `EP-7`/`US-7`/`TK-7` (by type) plus `DS-7` and `SP-7`,
so one number traces a ticket across every folder.

The YAML board holds tracking fields only (id, title, type, parent, status,
points, assignee, carryovers, notes) -- descriptions live in the item notes
and acceptance criteria in the specs, so no fact has two copies that can
drift. Links always use these typed names (`[[US-7]]`, `[[DS-7]]`) because
Obsidian resolves wikilinks by exact filename only -- aliases never resolve a
raw link. Item notes carry the board id and title as aliases for search and
autocomplete. Status lives only in the YAML board -- notes never duplicate
it. Older boards keep working: legacy flat `designs/<id>.md` / `specs/<id>.md`
and 0.10-style slug names are read as fallbacks and migrated
opportunistically.

Run `/cadence:install-obsidian` once to install Obsidian (if needed) and
configure `cadence/` as a vault, then open that folder in Obsidian to browse
everything as a linked graph. Notes use hierarchical tags (`api/auth`) and
hub notes (`moc-<topic>.md`, Maps of Content) so the graph stays navigable as
it grows; the brain-curator agent maintains both. `/cadence:brain-init`
bootstraps `cadence/code/` -- one note per source file with its imports,
exports, and callers -- and work sessions keep those notes current through
the same brain-curator dispatches.

Board files may be hand-edited; the validation hook (below) checks every
write, and the skills surface parse errors instead of auto-repairing.

## Hooks

Three hooks enforce the workflow mechanically (all no-ops outside a project
with a `cadence/` directory, except the commit guard, which is safe anywhere):

| Hook | Event | Enforces |
|---|---|---|
| `remind.js` | UserPromptSubmit | Injects the full gate rules on the first prompt of a session (refreshed every 30 prompts so it survives context compaction) and a one-line anchor on every other prompt; flags hand-edited knowledge notes and stray link-hijacking notes (Obsidian click-artifacts that shadow ticket-id aliases). Session tracking lives in `cadence/.remind-state.json`. |
| `guard.js` | PreToolUse (all file + shell tools) | Blocks `git commit --no-verify` and Anthropic/Claude attribution lines; blocks any access to env files (`.env`, `.env.*`, `*.env`, `.envrc`) by path, glob, or shell command -- secrets are never read. |
| `validate-board.js` | PostToolUse (Write/Edit) | Board invariants: valid statuses (incl. `dropped`), `C-<n>` ids, no duplicate ids, one `in_progress` item, one active sprint (`sprint.yml`; archives in `sprints/` must be completed), one live copy per item, hierarchy rules (`type`/`parent` values, epics stay in the backlog, epic -> story -> task nesting only, containers never `ready`). |

Run the hook tests with:

    node --test hooks/remind.test.js hooks/guard.test.js hooks/validate-board.test.js

## Brain MCP server

The plugin ships a dependency-free MCP server (`scripts/brain-mcp.js`) exposing
the vault as structured tools: `search_notes`, `read_note`, `write_note`,
`list_backlinks`, `get_related`, `list_orphans`, `list_unresolved_links`,
`list_stray_notes`, `list_tags`, `list_changed_notes`.
It indexes every markdown note under `<project>/cadence/` per call (item
notes, designs, specs, decisions, architecture, brain, code), so results
always reflect the files on disk. Lookups accept aliases (asking for `C-12`
finds `EP-12`), while link-resolution checks (`list_unresolved_links`,
`list_stray_notes`) deliberately match Obsidian's real behavior: exact
filenames only.
`write_note` targets the knowledge folders only (`brain/` by default, or
`folder: decisions` / `folder: architecture` / `folder: code`). Registered
via `.mcp.json`; agents without a `tools:` restriction (like
`brain-curator`) can use these automatically.

The knowledge folders are two-way aware: `list_changed_notes` diffs `brain/`,
`decisions/`, `architecture/`, and `code/` against the baseline in
`cadence/.brain-state.json`, so notes hand-edited in Obsidian are detected,
flagged by the every-turn reminder, and reconciled by the brain-curator
(hand-edits are ground truth, never clobbered). Workflow notes written by the
gated skills are deliberately untracked.

Run its tests with:

    node --test scripts/brain-mcp.test.js scripts/open-obsidian.test.js

## Token efficiency

`scripts/token-report.js` measures the context-window overhead the plugin
injects into a session — session-fixed descriptions and MCP tool schemas, the
per-prompt reminder (simulated with real hook runs, periodic refreshes
included), and the skill/agent bodies of a reference workflow:

    node scripts/token-report.js [pluginRoot] [--turns N] [--json]

Compare two versions by running it against a git worktree of the old ref and
the working tree. Measured against v0.17.1, v0.18.0 cut the recurring
per-prompt reminder by 80.6% over a 30-turn session (19,530 → 3,783 chars)
and 80.1% over 100 turns (65,100 → 12,972 chars); total plugin-emitted
context fell 27% (30 turns) to 47% (100 turns), growing with session length.
`search_notes` results are capped (default 20 notes, `limit` up to 100) so a
broad query on a large vault cannot flood the context window.

## Usage

The golden path through one ticket, gate by gate. `Cadence` writes to
`cadence/` (the board and the vault) and dispatches agents for isolated
work; `User` only ever talks to `Cadence`.

    User                                    Cadence
      |                                        |
      |--- /cadence:brainstorm --------------->|
      |                                        |  (dialogue only, no writes)
      |<-------------- shaped idea ------------|
      |                                        |
      |--- /cadence:refine ------------------->|
      |                                        |  [writes: design doc -> cadence/]
      |<------------ approve design? ----------|
      |--- approved -------------------------->|
      |                                        |
      |--- /cadence:spec --------------------->|
      |                                        |  [writes: spec -> cadence/, status: ready]
      |<------------- approve spec? -----------|
      |--- approved -------------------------->|
      |                                        |
      |--- /cadence:sprint-plan -------------->|
      |                                        |  [pulls ready items into sprint, status: todo]
      |                                        |
      |--- /cadence:work <id> ---------------->|
      |                                        |  [status: in_progress]
      |                                        |  [dispatch -> cadence-coder: TDD implementation]
      |                                        |  [dispatch -> brain-curator: code/decision notes]
      |<------- implemented, run review -------|
      |                                        |
      |--- /cadence:review <id> -------------->|
      |                                        |  [dispatch -> cadence-reviewer: verify criteria vs diff]
      |                                        |  [pass: status -> done, commit]
      |<---------- reviewed & committed -------|

`/cadence:conversate` collapses the left column to one message per turn --
it classifies intent and drives the same sequence for you. Epic-sized ideas,
`/cadence:quick`, and bug fixes take the side doors described in
[Workflow](#workflow) but rejoin this same spec -> ready -> sprint -> review
sequence.

## License

MIT — see [LICENSE](LICENSE). CI runs the full test suite on Linux and
Windows (Node 20 and 22) plus a version-consistency check on every push and
pull request.
