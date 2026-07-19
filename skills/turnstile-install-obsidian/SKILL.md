---
name: turnstile-install-obsidian
description: Optional convenience tooling -- installs Obsidian (after explicit confirmation) and scaffolds turnstile/.obsidian/ so the plain-markdown vault opens in it. Nothing in the pipeline requires Obsidian. Dispatched by /turnstile:install-obsidian only.
user-invocable: false
---

# Install Obsidian

<important>
- Never run the `install` subcommand until the user has explicitly confirmed the exact install command shown by `detect` (use AskUserQuestion). This skill never decides on its own to install software.
- Never retry a failed install or guess a fix — surface the command's message verbatim and stop.
- The script never overwrites an existing turnstile/.obsidian/ — treat reason "already-exists" as success ("vault already configured"), not an error. Re-running this command is always safe.
</important>

## Purpose

One-time setup that takes the user from "turnstile has a brain folder" to "that folder is a working Obsidian vault": install Obsidian if needed (with confirmation), then scaffold vault config so `[[wikilinked]]` brain notes open with graph view, backlinks, tags, and search working.

## Script

All OS work goes through the plugin script `scripts/install-obsidian.js`, located at `../../scripts/install-obsidian.js` relative to this skill's base directory. Each subcommand prints exactly one JSON line on stdout:

    node <script> detect    → {platform, alreadyInstalled, installPath, packageManager, installCommand}
    node <script> install   → {success, message}
    node <script> scaffold  → {scaffolded, reason}

## Process

1. Run `detect`. Report the platform and current install status to the user.
   - If `platform` is null, the OS is unsupported: point the user to https://obsidian.md/download, then continue to step 5 (scaffolding is platform-independent).
2. If `alreadyInstalled` is true, say so and skip to step 5.
3. If `packageManager` is non-null, show the exact `installCommand` and ask the user to confirm via AskUserQuestion before running anything. On confirmation, run `install` and report `message`. On failure, show `message` verbatim — do not retry. If the user declines, continue to step 5.
4. If `packageManager` is null, tell the user to install manually from https://obsidian.md/download.
5. Run `scaffold` regardless of the outcome of steps 2–4 — it only writes files and doesn't require Obsidian to be installed or running. Report the result:
   - `created` — vault config created at `turnstile/.obsidian/`.
   - `already-exists` — vault already configured; untouched.
   - `no-turnstile-dir` — there's no `turnstile/` here yet: suggest running `/turnstile:refine` (or another turnstile command) first so there's a brain worth opening; this command never creates `turnstile/` itself.
6. If Obsidian is installed and the vault is configured, tell the user to open the project's `turnstile/` folder in Obsidian ("Open folder as vault") to browse the brain graph.

## Error handling

- **Unsupported platform:** point to https://obsidian.md/download; still scaffold.
- **Install command fails** (elevation needed, cask conflict, …): surface the script's `message` verbatim; never retry silently or guess a fix.
- **No `turnstile/` directory:** redirect to `/turnstile:refine`; do not create `turnstile/`.
- **`turnstile/.obsidian/` already exists:** success ("vault already configured"), not an error.
