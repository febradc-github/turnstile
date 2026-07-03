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
try {
  const { snapshotBrain, readState, diffBrainState } = require(path.join(__dirname, '..', 'scripts', 'brain-mcp.js'));
  const brainDir = path.join(cadenceDir, 'brain');
  const current = snapshotBrain(brainDir);
  const state = current && readState(brainDir);
  if (current && state) {
    const changed = diffBrainState(current, state.notes);
    if (changed.length > 0) {
      const names = changed.slice(0, 5).map((c) => c.name).join(', ');
      handEditLine = `${changed.length} brain note(s) changed outside cadence since last sync (hand-edits in Obsidian?): ${names}. Dispatch brain-curator to reconcile (list_changed_notes MCP tool, acknowledge when done).\n`;
    }
  }
} catch {
  // the reminder must never break on tracking errors
}

process.stdout.write(MESSAGE + handEditLine);
