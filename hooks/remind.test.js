const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REMIND_PATH = path.join(__dirname, 'remind.js');
const EXPECTED_MESSAGE =
  "This project uses the cadence workflow; never skip a gate. Only /cadence:review marks an item done; search cadence/brain/ before starting new work. Never read env files (.env, .env.*, *.env, .envrc) -- no tool, no shell command, no exceptions; ask the user for config values. If this message concerns project work (an idea, a ticket, a bug, a review request, or board status), invoke the cadence-conversate skill to classify and route it -- unless you just asked the user a follow-up question inside a gated cadence skill (refine/breakdown/spec/sprint-plan/quick/drop/work/review). Answer messages unrelated to cadence work normally, without routing.\n";

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

test('remind.js appends a stray-note line when a root file shadows an alias', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-remind-test-'));
  const vault = path.join(tmpDir, 'cadence');
  const epics = path.join(vault, 'epics');
  fs.mkdirSync(epics, { recursive: true });
  fs.writeFileSync(
    path.join(epics, 'EP-1.md'),
    '---\ntype: epic\naliases: ["C-1", "Payment flow"]\n---\n\n# C-1: Payment flow\n'
  );
  fs.writeFileSync(path.join(vault, 'C-1.md'), '');
  const output = execFileSync('node', [REMIND_PATH], { encoding: 'utf8', cwd: tmpDir });
  assert.ok(output.startsWith(EXPECTED_MESSAGE));
  assert.match(output, /1 stray note\(s\) hijacking wikilinks/);
  assert.match(output, /C-1\.md \(empty, shadows EP-1\)/);
});

test('remind.js appends an unresolved-link line for click-trap wikilinks', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-remind-test-'));
  const brain = path.join(tmpDir, 'cadence', 'brain');
  fs.mkdirSync(brain, { recursive: true });
  fs.writeFileSync(
    path.join(brain, 'api-auth.md'),
    '---\ntype: domain\nrelated: ["[[nonexistent-note]]"]\n---\n\n# API auth\n\nSee [[nonexistent-note]].\n'
  );
  const output = execFileSync('node', [REMIND_PATH], { encoding: 'utf8', cwd: tmpDir });
  assert.ok(output.startsWith(EXPECTED_MESSAGE));
  assert.match(output, /1 unresolved wikilink target\(s\)/);
  assert.match(output, /\[\[nonexistent-note\]\] \(in api-auth\)/);
});

test('remind.js appends a hand-edit line when tracked knowledge notes changed', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-remind-test-'));
  const vault = path.join(tmpDir, 'cadence');
  const brain = path.join(vault, 'brain');
  fs.mkdirSync(brain, { recursive: true });
  fs.writeFileSync(path.join(brain, 'known.md'), '# Known\n');
  const { listChangedNotes } = require('../scripts/brain-mcp.js');
  listChangedNotes(vault, { acknowledge: true });
  fs.writeFileSync(path.join(brain, 'hand-made.md'), '# Hand made\n');
  const output = execFileSync('node', [REMIND_PATH], { encoding: 'utf8', cwd: tmpDir });
  assert.ok(output.startsWith(EXPECTED_MESSAGE));
  assert.match(output, /1 knowledge note\(s\) changed outside cadence/);
  assert.match(output, /hand-made/);
});
