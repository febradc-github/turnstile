---
name: turnstile-obsidian-graph
description: Opens turnstile/ in Obsidian and points the user at Graph View. Dispatched by /turnstile:obsidian-graph only.
user-invocable: false
---

# Obsidian Graph

## Purpose

Opens the vault in Obsidian so the user can browse all of `turnstile/` -- item notes, designs, specs, decisions, architecture, and brain notes -- as a linked graph. Obsidian's URI scheme has no direct "open graph view" action, so this opens the vault and tells the user the graph hotkey.

## Process

1. Run `node ../../scripts/open-obsidian.js` (path relative to this skill's base directory). It prints one JSON line: `{opened, uri, vaultConfigured, vaultRegistered, registration, graphHotkey, reason?, message?}`. The script registers the vault in Obsidian's global registry before opening, since `obsidian://open?path=` only works for registered vaults.
2. Report by result:
   - `opened: true` — Obsidian is opening the vault; tell the user to press `graphHotkey` (the default "Open graph view" hotkey) once it loads.
   - `registration: "added"` — the vault was just registered; warn that if Obsidian was already running it may show "Vault not found" once, and restarting Obsidian (or picking the vault from its vault switcher) fixes it.
   - `vaultRegistered: false` — Obsidian may show "Vault not found"; relay `registration` (and `message` if present), and suggest opening the folder once via Obsidian's own "Open folder as vault".
   - `vaultConfigured: false` — additionally suggest running `/turnstile:install-obsidian` so the vault opens with graph view, backlinks, and tags enabled.
   - `reason: "no-turnstile-dir"` — no `turnstile/` here; suggest `/turnstile:refine` or another turnstile command first.
   - `reason: "unsupported-platform"` — show the `uri` so the user can open it manually.
   - `reason: "opener-failed"` — show `message` verbatim; if Obsidian isn't installed, suggest `/turnstile:install-obsidian`.

## Error handling

Never retry a failed open; surface the JSON `reason`/`message` and stop.
