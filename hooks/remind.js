#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const cadenceDir = path.join(process.cwd(), 'cadence');
if (!fs.existsSync(cadenceDir)) {
  process.exit(0);
}

const MESSAGE =
  "This project uses the cadence workflow; never skip a gate. Only /cadence:review marks an item done; search cadence/brain/ before starting new work. Never read env files (.env, .env.*, *.env, .envrc) -- no tool, no shell command, no exceptions; ask the user for config values. If this message concerns project work (an idea, a ticket, a bug, a review request, or board status), invoke the cadence-conversate skill to classify and route it -- unless you just asked the user a follow-up question inside a gated cadence skill (refine/breakdown/spec/sprint-plan/quick/drop/work/review). Answer messages unrelated to cadence work normally, without routing.\n";

let handEditLine = '';
let strayLine = '';
let unresolvedLine = '';
try {
  const { snapshotBrain, readState, diffBrainState, listStrayNotes, listUnresolvedLinks } = require(path.join(__dirname, '..', 'scripts', 'brain-mcp.js'));
  const current = snapshotBrain(cadenceDir);
  const state = current && readState(cadenceDir);
  if (current && state) {
    const changed = diffBrainState(current, state.notes);
    if (changed.length > 0) {
      const names = changed.slice(0, 5).map((c) => c.name).join(', ');
      handEditLine = `${changed.length} knowledge note(s) changed outside cadence since last sync (hand-edits in Obsidian?): ${names}. Dispatch brain-curator to reconcile (list_changed_notes MCP tool, acknowledge when done).\n`;
    }
  }
  const { strays } = listStrayNotes(cadenceDir);
  if (strays.length > 0) {
    const described = strays
      .slice(0, 5)
      .map((s) => `${s.relPath} (${s.empty ? 'empty' : 'has content'}${s.shadows ? `, shadows ${s.shadows}` : ''}${s.collidesWith ? `, collides with ${s.collidesWith}` : ''})`)
      .join(', ');
    strayLine = `${strays.length} stray note(s) hijacking wikilinks (Obsidian resolves exact filenames before aliases): ${described}. Usually Obsidian's "create new note" on a click of an unresolved-looking link. Surface to the user, then delete empty strays; a stray with content: fold it into the real note (or migrate a legacy design/spec to its typed name) before deleting.\n`;
  }
  const { unresolved } = listUnresolvedLinks(cadenceDir);
  if (unresolved && unresolved.length > 0) {
    const described = unresolved
      .slice(0, 5)
      .map((u) => `[[${u.target}]] (in ${u.sources.slice(0, 2).join(', ')})`)
      .join(', ');
    unresolvedLine = `${unresolved.length} unresolved wikilink target(s) in the vault: ${described}. Each is a click-trap -- Obsidian offers to create the missing note, minting a stray. Fix the link to an existing note/alias, create the missing note properly (item notes via their gated skill, knowledge notes via brain-curator), or drop the link.\n`;
  }
} catch {
  // the reminder must never break on tracking errors
}

process.stdout.write(MESSAGE + handEditLine + strayLine + unresolvedLine);
