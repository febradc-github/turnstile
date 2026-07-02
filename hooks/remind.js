#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const cadenceDir = path.join(process.cwd(), 'cadence');
if (!fs.existsSync(cadenceDir)) {
  process.exit(0);
}

process.stdout.write(
  "This project uses the cadence workflow. Never skip a gate. Unless a gated cadence skill's dialogue is already in progress (you just asked the user a direct follow-up question as part of refine/spec/sprint-plan/work/review), invoke the cadence-conversate skill now to classify this message's intent and route it appropriately.\n"
);
