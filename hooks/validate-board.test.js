const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const VALIDATOR_PATH = path.join(__dirname, 'validate-board.js');

function makeCadenceDir(files) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-validate-test-'));
  const cadenceDir = path.join(tmpDir, 'cadence');
  fs.mkdirSync(cadenceDir);
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(cadenceDir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  return cadenceDir;
}

function runValidator(filePath) {
  return spawnSync('node', [VALIDATOR_PATH], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath } }),
    encoding: 'utf8',
  });
}

const GOOD_BACKLOG = `items:
  - id: C-1
    title: "First"
    status: idea
  - id: C-2
    title: "Second"
    status: ready
`;

const GOOD_SPRINT = `sprint:
  name: "Sprint 1"
  number: 1
  goal: "Ship it"
  status: active
items:
  - id: C-3
    title: "Third"
    status: in_progress
  - id: C-4
    title: "Fourth"
    status: todo
`;

test('passes a valid backlog and current sprint', () => {
  const dir = makeCadenceDir({ 'backlog.yml': GOOD_BACKLOG, 'sprint.yml': GOOD_SPRINT });
  assert.equal(runValidator(path.join(dir, 'backlog.yml')).status, 0);
  assert.equal(runValidator(path.join(dir, 'sprint.yml')).status, 0);
});

test('ignores files outside cadence board paths', () => {
  const result = runValidator(path.join(os.tmpdir(), 'src', 'index.js'));
  assert.equal(result.status, 0);
});

test('rejects an invalid backlog status', () => {
  const dir = makeCadenceDir({
    'backlog.yml': 'items:\n  - id: C-1\n    status: in_progress\n',
  });
  const result = runValidator(path.join(dir, 'backlog.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid status "in_progress"/);
});

test('accepts dropped items in backlog and sprint', () => {
  const backlog = GOOD_BACKLOG.replace('status: ready', 'status: dropped');
  const sprint = GOOD_SPRINT.replace('status: todo', 'status: dropped');
  const dir = makeCadenceDir({ 'backlog.yml': backlog, 'sprint.yml': sprint });
  assert.equal(runValidator(path.join(dir, 'backlog.yml')).status, 0);
});

test('accepts a dropped epic even without children', () => {
  const dir = makeCadenceDir({
    'backlog.yml': 'items:\n  - id: C-1\n    type: epic\n    status: dropped\n',
  });
  assert.equal(runValidator(path.join(dir, 'backlog.yml')).status, 0);
});

test('rejects duplicate ids within a file', () => {
  const dir = makeCadenceDir({
    'backlog.yml': 'items:\n  - id: C-1\n    status: idea\n  - id: C-1\n    status: ready\n',
  });
  const result = runValidator(path.join(dir, 'backlog.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /duplicate id C-1/);
});

test('rejects two in_progress items in the current sprint', () => {
  const sprint = GOOD_SPRINT.replace('status: todo', 'status: in_progress');
  const dir = makeCadenceDir({ 'sprint.yml': sprint });
  const result = runValidator(path.join(dir, 'sprint.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /only one is allowed/);
});

test('rejects an id living in both backlog and the current sprint', () => {
  const sprint = GOOD_SPRINT.replace('id: C-3', 'id: C-1');
  const dir = makeCadenceDir({ 'backlog.yml': GOOD_BACKLOG, 'sprint.yml': sprint });
  const result = runValidator(path.join(dir, 'sprint.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /exactly one live copy/);
});

test('allows an archived sprint to keep historical copies', () => {
  const completed = GOOD_SPRINT.replace('status: active', 'status: completed').replace(
    'id: C-3',
    'id: C-1'
  );
  const dir = makeCadenceDir({ 'backlog.yml': GOOD_BACKLOG, 'sprints/sprint-1.yml': completed });
  assert.equal(runValidator(path.join(dir, 'backlog.yml')).status, 0);
  assert.equal(runValidator(path.join(dir, 'sprints', 'sprint-1.yml')).status, 0);
});

test('rejects an active sprint in the archive folder', () => {
  const dir = makeCadenceDir({ 'sprints/sprint-1.yml': GOOD_SPRINT });
  const result = runValidator(path.join(dir, 'sprints', 'sprint-1.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /archived sprints must be completed/);
});

test('still validates a legacy root sprint-N.yml as the active sprint', () => {
  const dir = makeCadenceDir({ 'backlog.yml': GOOD_BACKLOG, 'sprint-1.yml': GOOD_SPRINT });
  assert.equal(runValidator(path.join(dir, 'sprint-1.yml')).status, 0);
});

test('rejects two active sprints (sprint.yml plus a legacy root file)', () => {
  const dir = makeCadenceDir({
    'sprint.yml': GOOD_SPRINT,
    'sprint-1.yml': GOOD_SPRINT.replace('id: C-3', 'id: C-5').replace('id: C-4', 'id: C-6'),
  });
  const result = runValidator(path.join(dir, 'sprint.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /multiple active sprints/);
});

test('rejects an invalid sprint status', () => {
  const dir = makeCadenceDir({ 'sprint.yml': GOOD_SPRINT.replace('status: active', 'status: open') });
  const result = runValidator(path.join(dir, 'sprint.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /sprint status "open" is invalid/);
});

test('rejects a malformed ticket id', () => {
  const dir = makeCadenceDir({ 'backlog.yml': 'items:\n  - id: TICKET-9\n    status: idea\n' });
  const result = runValidator(path.join(dir, 'backlog.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /does not match C-<number>/);
});

const HIERARCHY_BACKLOG = `items:
  - id: C-1
    title: "Epic"
    type: epic
    status: idea
  - id: C-2
    title: "Story"
    type: story
    parent: C-1
    status: ready
`;

test('passes a valid epic -> story hierarchy in the backlog', () => {
  const dir = makeCadenceDir({ 'backlog.yml': HIERARCHY_BACKLOG });
  assert.equal(runValidator(path.join(dir, 'backlog.yml')).status, 0);
});

test('passes a task in the current sprint whose parent story lives in the backlog', () => {
  // C-2 has a child, so it is a container and must sit at idea, not ready.
  const backlog = HIERARCHY_BACKLOG.replace('parent: C-1\n    status: ready', 'parent: C-1\n    status: idea');
  const sprint = `sprint:
  status: active
items:
  - id: C-3
    title: "Task"
    type: task
    parent: C-2
    status: todo
`;
  const dir = makeCadenceDir({ 'backlog.yml': backlog, 'sprint.yml': sprint });
  assert.equal(runValidator(path.join(dir, 'sprint.yml')).status, 0);
});

test('rejects an invalid item type', () => {
  const dir = makeCadenceDir({
    'backlog.yml': 'items:\n  - id: C-1\n    type: initiative\n    status: idea\n',
  });
  const result = runValidator(path.join(dir, 'backlog.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid type "initiative"/);
});

test('rejects an epic inside a sprint file', () => {
  const sprint = GOOD_SPRINT.replace('id: C-3\n    title: "Third"', 'id: C-3\n    title: "Third"\n    type: epic');
  const dir = makeCadenceDir({ 'sprint.yml': sprint });
  const result = runValidator(path.join(dir, 'sprint.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /epics never enter a sprint/);
});

test('rejects a ready epic', () => {
  const dir = makeCadenceDir({
    'backlog.yml': HIERARCHY_BACKLOG.replace('type: epic\n    status: idea', 'type: epic\n    status: ready'),
  });
  const result = runValidator(path.join(dir, 'backlog.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /epic C-1 has invalid status "ready"/);
});

test('allows done for a container epic but not for a childless item', () => {
  const doneEpic = HIERARCHY_BACKLOG.replace('type: epic\n    status: idea', 'type: epic\n    status: done');
  const dir = makeCadenceDir({ 'backlog.yml': doneEpic });
  assert.equal(runValidator(path.join(dir, 'backlog.yml')).status, 0);

  const doneLeaf = 'items:\n  - id: C-1\n    status: done\n';
  const dir2 = makeCadenceDir({ 'backlog.yml': doneLeaf });
  const result = runValidator(path.join(dir2, 'backlog.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /item C-1 has invalid status "done"/);
});

test('rejects a container story that is still marked ready', () => {
  const backlog = `items:
  - id: C-1
    title: "Story"
    status: ready
  - id: C-2
    title: "Task"
    type: task
    parent: C-1
    status: idea
`;
  const dir = makeCadenceDir({ 'backlog.yml': backlog });
  const result = runValidator(path.join(dir, 'backlog.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /container \(has children\) C-1 has invalid status "ready"/);
});

test('rejects a live item whose parent is missing from the backlog', () => {
  const dir = makeCadenceDir({
    'backlog.yml': 'items:\n  - id: C-2\n    type: story\n    parent: C-9\n    status: idea\n',
  });
  const result = runValidator(path.join(dir, 'backlog.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /parent C-9, which is not in backlog\.yml/);
});

test('rejects a task whose parent is an epic', () => {
  const backlog = HIERARCHY_BACKLOG.replace('type: story', 'type: task');
  const dir = makeCadenceDir({ 'backlog.yml': backlog });
  const result = runValidator(path.join(dir, 'backlog.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /a task's parent must be a story/);
});

test('rejects a story whose parent is not an epic', () => {
  const backlog = `items:
  - id: C-1
    title: "Story A"
    status: idea
  - id: C-2
    title: "Story B"
    type: story
    parent: C-1
    status: idea
`;
  const dir = makeCadenceDir({ 'backlog.yml': backlog });
  const result = runValidator(path.join(dir, 'backlog.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /a story's parent must be an epic/);
});

test('rejects an epic that itself has a parent', () => {
  const backlog = `items:
  - id: C-1
    type: epic
    status: idea
  - id: C-2
    type: epic
    parent: C-1
    status: idea
`;
  const dir = makeCadenceDir({ 'backlog.yml': backlog });
  const result = runValidator(path.join(dir, 'backlog.yml'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /epics are top-level/);
});

test('never blocks on unparseable input', () => {
  const result = spawnSync('node', [VALIDATOR_PATH], { input: 'not json', encoding: 'utf8' });
  assert.equal(result.status, 0);
});
