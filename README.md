# Cadence

A gated, file-based agile workflow plugin for Claude Code. Cadence tracks work
on a YAML board, enforces hard approval gates so nothing skips ahead of its
own readiness, and maintains a persistent, Obsidian-linked knowledge brain
that survives across sessions.

## Install (local development)

    claude --plugin-dir ./cadence-plugin

## Commands

| Command | Purpose |
|---|---|
| `/cadence:go [request]` | Casual entry point; tells you which command to run next. |
| `/cadence:refine [idea]` | Gap-closing dialogue; writes a design doc for approval. |
| `/cadence:spec [id]` | Turns an approved design into a checkable spec; requires approval. |
| `/cadence:plan` | Starts a new sprint; requires a goal; rolls over unfinished work. |
| `/cadence:standup` | Read-only progress/blocker report on the active sprint. |
| `/cadence:work [id]` | Implements one ticket with TDD. |
| `/cadence:review [id]` | Independent done-ness check; commits on pass. |
| `/cadence:board` | Read-only render of the whole board. |

## Workflow

    idea --(/cadence:refine)--> design approved
         --(/cadence:spec)----> spec approved --> ready
         --(/cadence:plan)----> todo --> in_progress
         --(/cadence:review, passes)--> done

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

See `docs/superpowers/specs/2026-07-01-cadence-plugin-design.md` in the
originating repository for the full design rationale.
