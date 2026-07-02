const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REMIND_PATH = path.join(__dirname, 'remind.js');
const EXPECTED_MESSAGE =
  "This project uses the cadence workflow; never skip a gate. Only /cadence:review marks an item done; search cadence/brain/ before starting new work. If this message concerns project work (an idea, a ticket, a bug, a review request, or board status), invoke the cadence-conversate skill to classify and route it -- unless you just asked the user a follow-up question inside a gated cadence skill (refine/spec/sprint-plan/work/review). Answer messages unrelated to cadence work normally, without routing.\n";

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
