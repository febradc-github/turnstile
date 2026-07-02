const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REMIND_PATH = path.join(__dirname, 'remind.js');
const EXPECTED_MESSAGE =
  "This project uses the cadence workflow. Never skip a gate. Unless a gated cadence skill's dialogue is already in progress (you just asked the user a direct follow-up question as part of refine/spec/sprint-plan/work/review), invoke the cadence-conversate skill now to classify this message's intent and route it appropriately.\n";

test('remind.js prints nothing when no cadence/ directory exists', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-remind-test-'));
  const output = execFileSync('node', [REMIND_PATH], { encoding: 'utf8', cwd: tmpDir });
  assert.equal(output, '');
});

test('remind.js prints the workflow + routing reminder when cadence/ directory exists', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-remind-test-'));
  fs.mkdirSync(path.join(tmpDir, 'cadence'));
  const output = execFileSync('node', [REMIND_PATH], { encoding: 'utf8', cwd: tmpDir });
  assert.equal(output, EXPECTED_MESSAGE);
});
