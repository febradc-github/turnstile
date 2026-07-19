#!/usr/bin/env node
// UserPromptSubmit reminder. The full workflow message is emitted on the
// first prompt of a session and refreshed every REFRESH_EVERY prompts (so it
// survives context compaction); other prompts get a one-line anchor. Alert
// lines (hand-edits, strays, unresolved links) are appended whenever present.
// Without a parseable session id on stdin, every prompt gets the full message.
const fs = require('node:fs');
const path = require('node:path');

const MESSAGE =
  "This project uses the turnstile workflow; never skip a gate. Only /turnstile:review marks an item done; search turnstile/brain/ before starting new work. Never read env files (.env, .env.*, *.env, .envrc) -- no tool, no shell command, no exceptions; ask the user for config values. If this message concerns project work (an idea, a ticket, a bug, a review request, or board status), invoke the turnstile-conversate skill to classify and route it -- unless you just asked the user a follow-up question inside a gated turnstile skill (refine/breakdown/spec/sprint-plan/next/quick/drop/park/pickup/work/review). Answer messages unrelated to turnstile work normally, without routing.\n";
const ANCHOR = 'turnstile active: route project work via the turnstile-conversate skill; gates and the no-env-files rule apply.\n';
const REFRESH_EVERY = 30; // full message on prompts 1, 31, 61, ...
const MAX_TRACKED_SESSIONS = 20;

// Returns the number of prompts seen so far in this session (0 for the
// first), updating the state file. Any failure means "first prompt".
function promptIndex(statePath, sessionId) {
  let state = { sessions: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (parsed && typeof parsed.sessions === 'object' && parsed.sessions !== null) state = parsed;
  } catch {
    // missing or corrupt state: treat as fresh
  }
  const entry = state.sessions[sessionId] || { count: 0 };
  const index = entry.count;
  state.sessions[sessionId] = { count: index + 1, at: Date.now() };
  const ids = Object.keys(state.sessions);
  if (ids.length > MAX_TRACKED_SESSIONS) {
    ids
      .sort((a, b) => (state.sessions[a].at || 0) - (state.sessions[b].at || 0))
      .slice(0, ids.length - MAX_TRACKED_SESSIONS)
      .forEach((id) => delete state.sessions[id]);
  }
  try {
    fs.writeFileSync(statePath, JSON.stringify(state) + '\n');
  } catch {
    // read-only project: fall back to full message every prompt
  }
  return index;
}

function alertLines(turnstileDir) {
  let handEditLine = '';
  let strayLine = '';
  let unresolvedLine = '';
  try {
    const { vaultAlerts } = require(path.join(__dirname, '..', 'scripts', 'brain-mcp.js'));
    const alerts = vaultAlerts(turnstileDir);
    if (!alerts) return '';
    if (alerts.changed.length > 0) {
      const names = alerts.changed.slice(0, 5).map((c) => c.name).join(', ');
      handEditLine = `${alerts.changed.length} knowledge note(s) changed outside turnstile since last sync (hand-edits in Obsidian?): ${names}. Dispatch brain-curator to reconcile (list_changed_notes MCP tool, acknowledge when done).\n`;
    }
    if (alerts.strays.length > 0) {
      const described = alerts.strays
        .slice(0, 5)
        .map((s) => `${s.relPath} (${s.empty ? 'empty' : 'has content'}${s.shadows ? `, shadows ${s.shadows}` : ''}${s.collidesWith ? `, collides with ${s.collidesWith}` : ''})`)
        .join(', ');
      strayLine = `${alerts.strays.length} stray note(s) hijacking wikilinks (Obsidian resolves exact filenames before aliases): ${described}. Usually Obsidian's "create new note" on a click of an unresolved-looking link. Surface to the user, then delete empty strays; a stray with content: fold it into the real note (or migrate a legacy design/spec to its typed name) before deleting.\n`;
    }
    if (alerts.unresolved.length > 0) {
      const described = alerts.unresolved
        .slice(0, 5)
        .map((u) => `[[${u.target}]] (in ${u.sources.slice(0, 2).join(', ')})`)
        .join(', ');
      unresolvedLine = `${alerts.unresolved.length} unresolved wikilink target(s) in the vault: ${described}. Each is a click-trap -- Obsidian offers to create the missing note, minting a stray. Fix the link to an existing note/alias, create the missing note properly (item notes via their gated skill, knowledge notes via brain-curator), or drop the link.\n`;
    }
  } catch {
    // the reminder must never break on tracking errors
  }
  return handEditLine + strayLine + unresolvedLine;
}

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let sessionId = null;
  // Prefer the payload's cwd: plugin hosts may run hooks with the plugin
  // root (not the project) as the working directory.
  let projectDir = process.cwd();
  try {
    const input = JSON.parse(raw);
    if (input && typeof input.session_id === 'string' && input.session_id) sessionId = input.session_id;
    if (input && typeof input.cwd === 'string' && input.cwd) projectDir = input.cwd;
  } catch {
    // no usable stdin: emit the full message below
  }
  const turnstileDir = path.join(projectDir, 'turnstile');
  if (!fs.existsSync(turnstileDir)) {
    process.exit(0);
  }
  // kimi-code runs plugin hooks (and the brain MCP server) with the plugin
  // root as cwd and no project env var, so leave a hint the MCP server can
  // read to find this project's vault. No-op on other hosts.
  if (process.env.KIMI_PLUGIN_ROOT) {
    try {
      fs.writeFileSync(
        path.join(process.env.KIMI_PLUGIN_ROOT, '.turnstile-project.json'),
        JSON.stringify({ projectDir }) + '\n'
      );
    } catch {
      // a stale or missing hint only degrades the brain MCP, never the hook
    }
  }
  const index = sessionId === null ? 0 : promptIndex(path.join(turnstileDir, '.remind-state.json'), sessionId);
  const preamble = index % REFRESH_EVERY === 0 ? MESSAGE : ANCHOR;
  process.stdout.write(preamble + alertLines(turnstileDir));
});
