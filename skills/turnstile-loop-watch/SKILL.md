---
name: turnstile-loop-watch
description: Opens a local browser dashboard that polls loop state every second and renders the ACT/OBSERVE/EVALUATE/DECIDE circuit with a live terminal log.
argument-hint: "<id>"
user-invocable: false
---

# Loop Watch

<important>
Read-only console. Never modify state.json or any other file while running this skill.
</important>

## Process

### 1. Parse the id

Read the loop id from `$ARGUMENTS`. If empty or missing, tell the user:

> Usage: /turnstile:loop-watch <id>
> Example: /turnstile:loop-watch L-1721000000

Then stop.

### 2. Locate state.json

Determine the project root: use `CLAUDE_PROJECT_DIR` if set, otherwise `process.cwd()`.

The state file must exist at `<projectRoot>/turnstile/loops/<id>/state.json`.

If the file does not exist, tell the user:

> No loop state found for `<id>`.
> Run `/turnstile:loop-start` to begin a new loop, or check that the id is correct.

Then stop.

### 3. Determine the plugin root

The plugin root is the directory that contains this SKILL.md file's parent `skills/` directory — i.e. the `turnstile` plugin root.  Resolve it from `__dirname` of the SKILL.md when running in the Claude Code harness, or use the known absolute path:

```
<pluginRoot> = the directory containing turnstile's package or plugin root
```

In practice: the loop-watch script lives at `<pluginRoot>/scripts/loop-watch.js`.

### 4. Launch the server

Run:

```
node <pluginRoot>/scripts/loop-watch.js <id> <projectRoot>
```

The script will:
- Start an HTTP server on port 3847 (trying +1 up to 5 times if in use)
- Print the URL to stdout
- Open the browser automatically

Tell the user:

> Loop Watch started for `<id>`.
> Dashboard: http://127.0.0.1:3847  (or the port printed above)
> Press Ctrl+C in the terminal to stop the server.
>
> The page polls state every second and updates without a full reload.
> The server exits automatically when the loop reaches a terminal status.

### 5. Wait or let the user stop

The server process runs until:
- The loop state reaches a terminal status (`success`, `max_iterations_reached`, or `error`) — the server exits automatically after 5 seconds.
- The user presses Ctrl+C.

Do not poll or interact with the server further; the script manages its own lifecycle.
