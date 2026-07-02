# Cadence

A gated, file-based agile workflow plugin for Claude Code. Cadence tracks work
on a YAML board, enforces hard approval gates so nothing skips ahead of its
own readiness, and maintains a persistent, Obsidian-linked knowledge brain
that survives across sessions.

## Install (local development)

    claude --plugin-dir ./cadence-plugin

## Commands vs. skills

Every capability has two files: a `commands/<name>.md` (the one-word command
you type, e.g. `/cadence:refine`) and a `skills/cadence-<name>/SKILL.md` (the
actual behavior, internally named `cadence-<name>` so it's never ambiguous
with a same-named skill from a different plugin). The command is a thin
wrapper that dispatches to the skill.

## Commands

| Command | Purpose |
|---|---|
| `/cadence:conversate [message]` | Casual entry point; classifies intent and directly invokes the right skill. |
| `/cadence:brainstorm [idea]` | Loose, exploratory idea-shaping. No file writes. Hands off to refine. |
| `/cadence:refine [idea]` | Gap-closing dialogue; writes a design doc for approval. |
| `/cadence:spec [id]` | Turns an approved design into a checkable spec; requires approval. |
| `/cadence:sprint-plan` | Starts a new sprint; requires a goal; rolls over unfinished work. |
| `/cadence:work [id]` | Implements one ticket with TDD. |
| `/cadence:review [id]` | Independent done-ness check; commits on pass. |
| `/cadence:standup` | Read-only progress/blocker report on the active sprint. |
| `/cadence:board` | Read-only render of the whole board. |
| `/cadence:systematic-debugger [bug]` | Independent root-cause debugging. Ad hoc, not gated. |
| `/cadence:code-reviewer [scope]` | Advisory code/diff review. Ad hoc, not gated, never commits. |

## Workflow

    rough idea --(/cadence:brainstorm)--> shaped idea
               --(/cadence:refine)------> design approved
               --(/cadence:spec)--------> spec approved --> ready
               --(/cadence:sprint-plan)-> todo --> in_progress
               --(/cadence:review, passes)--> done

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

Open `cadence/` in Obsidian to browse the brain notes as a linked graph.

## Design

See `docs/superpowers/specs/2026-07-01-cadence-plugin-design.md` for the
original design rationale, and
`docs/superpowers/specs/2026-07-02-cadence-commands-conversate-design.md`
for the commands layer, conversate, and the debugger/code-reviewer skills.
