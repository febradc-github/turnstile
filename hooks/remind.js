#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const cadenceDir = path.join(process.cwd(), 'cadence');
if (!fs.existsSync(cadenceDir)) {
  process.exit(0);
}

const MESSAGE =
  "This project uses the cadence workflow; never skip a gate. Only /cadence:review marks an item done; search cadence/brain/ before starting new work. If this message concerns project work (an idea, a ticket, a bug, a review request, or board status), invoke the cadence-conversate skill to classify and route it -- unless you just asked the user a follow-up question inside a gated cadence skill (refine/breakdown/spec/sprint-plan/work/review). Answer messages unrelated to cadence work normally, without routing.\n";

let handEditLine = '';
let strayLine = '';
try {
  const { snapshotBrain, readState, diffBrainState, listStrayNotes } = require(path.join(__dirname, '..', 'scripts', 'brain-mcp.js'));
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
      .map((s) => `${s.relPath} (${s.empty ? 'empty' : 'has content'}${s.shadows ? `, shadows ${s.shadows}` : ''})`)
      .join(', ');
    strayLine = `${strays.length} stray note(s) hijacking wikilinks (Obsidian resolves exact filenames before aliases): ${described}. Usually Obsidian's "create new note" on a click of an unresolved-looking link. Surface to the user, then delete empty strays; a stray with content: fold it into the real note (or migrate a legacy design/spec to its typed name) before deleting.\n`;
  }
} catch {
  // the reminder must never break on tracking errors
}

process.stdout.write(MESSAGE + handEditLine + strayLine);
