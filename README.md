# Cadence

A gated, file-based agile workflow plugin for Claude Code. Cadence tracks work
on a YAML board, enforces hard approval gates so nothing skips ahead of its
own readiness, and maintains a persistent, Obsidian-linked knowledge brain
that survives across sessions.

## Requirements

Node.js (any current LTS) must be on `PATH` — the plugin's hooks are small
dependency-free Node scripts.

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
| `/cadence:sprint-plan` | Starts a new sprint; recommends which ready items to pull in and proposes a goal; rolls over unfinished work. |
| `/cadence:work [id]` | Implements one ticket with TDD. |
| `/cadence:review [id]` | Independent done-ness check; commits on pass. |
| `/cadence:standup` | Read-only progress/blocker report on the active sprint. |
| `/cadence:board` | Read-only render of the whole board. |
| `/cadence:systematic-debugger [bug]` | Independent root-cause debugging. Ad hoc, not gated. |
| `/cadence:code-reviewer [scope]` | Advisory code/diff review. Ad hoc, not gated, never commits. |
| `/cadence:install-obsidian` | One-time setup: installs Obsidian via the OS package manager (with confirmation) and scaffolds `cadence/.obsidian/` as a working vault. Idempotent. |
| `/cadence:obsidian-graph` | Opens `cadence/` in Obsidian and points you at Graph View (Ctrl+G / Cmd+G). |

## Agents

Three agents exist because each structurally requires isolation from the main
session; nothing else is agent-shaped.

| Agent | Model | Role |
|---|---|---|
| `cadence-coder` | inherit | Language-adaptive implementation of one ticket or confirmed bug fix, test-first, matching the repo's existing conventions. Dispatched by `/cadence:work` (self-contained tickets) and `/cadence:systematic-debugger` (non-trivial fixes). Never commits, never touches `cadence/` data files. |
| `cadence-reviewer` | opus | Independent done-ness verdict for `/cadence:review`; judges only the criteria and the diff, read-only. |
| `brain-curator` | haiku | Sole writer of `cadence/brain/` notes; dispatched opportunistically when something worth remembering happens. |

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

`/cadence:conversate` classifies a message and drives this pipeline directly
instead of requiring each command to be typed by hand.

## Data

Cadence reads and writes a `cadence/` folder in your project repo:

    cadence/
      backlog.yml
      sprint-1.yml
      designs/<id>.md
      specs/<id>.md
      brain/*.md
      .brain-state.json   # hand-edit tracking baseline (created on first sync)

Run `/cadence:install-obsidian` once to install Obsidian (if needed) and
configure `cadence/` as a vault, then open that folder in Obsidian to browse
the brain notes as a linked graph. Brain notes use hierarchical tags
(`api/auth`) and hub notes (`moc-<topic>.md`, Maps of Content) so the graph
stays navigable as it grows; the brain-curator agent maintains both.

Board files may be hand-edited; the validation hook (below) checks every
write, and the skills surface parse errors instead of auto-repairing.

## Hooks

Three hooks enforce the workflow mechanically (all no-ops outside a project
with a `cadence/` directory, except the commit guard, which is safe anywhere):

| Hook | Event | Enforces |
|---|---|---|
| `remind.js` | UserPromptSubmit | Re-injects the gate rules and conversate routing each turn. |
| `guard.js` | PreToolUse (Bash) | Blocks `git commit --no-verify` and Anthropic/Claude attribution lines. |
| `validate-board.js` | PostToolUse (Write/Edit) | Board invariants: valid statuses, `C-<n>` ids, no duplicate ids, one `in_progress` item, one active sprint, one live copy per item, hierarchy rules (`type`/`parent` values, epics stay in the backlog, epic -> story -> task nesting only, containers never `ready`). |

Run the hook tests with:

    node --test hooks/remind.test.js hooks/guard.test.js hooks/validate-board.test.js

## Brain MCP server

The plugin ships a dependency-free MCP server (`scripts/brain-mcp.js`) exposing
the brain as structured tools: `search_notes`, `read_note`, `write_note`,
`list_backlinks`, `get_related`, `list_orphans`, `list_unresolved_links`,
`list_tags`, `list_changed_notes`.
It reads `<project>/cadence/brain/` per call, so results always reflect the
files on disk. Registered via `.mcp.json`; agents without a `tools:`
restriction (like `brain-curator`) can use these automatically.

The brain is two-way aware: `list_changed_notes` diffs the brain against the
baseline in `cadence/.brain-state.json`, so notes hand-edited in Obsidian are
detected, flagged by the every-turn reminder, and reconciled by the
brain-curator (hand-edits are ground truth, never clobbered).

Run its tests with:

    node --test scripts/brain-mcp.test.js scripts/open-obsidian.test.js

## Design

See `docs/superpowers/specs/2026-07-01-cadence-plugin-design.md` and
`docs/superpowers/specs/2026-07-02-cadence-commands-conversate-design.md`
in the originating repository for the full design rationale -- the first
covers the original plugin, the second covers the commands layer,
conversate, and the debugger/code-reviewer skills.
