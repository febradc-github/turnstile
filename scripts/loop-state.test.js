'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const { initState, writePhase, finalizeLoop, readState } = require('./loop-state.js');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'loop-state-test-'));
}

// Each test gets its own tmp dir so tests are fully isolated.

test('initState creates cadence/loops/<id>/state.json with correct initial shape', () => {
  const root = makeTmp();
  initState('L-1', 'Optimize query', 'p99 < 200ms', 5, 'autonomous', root);

  const stateFile = path.join(root, 'cadence', 'loops', 'L-1', 'state.json');
  assert.ok(fs.existsSync(stateFile), 'state.json should exist');

  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  assert.equal(state.id, 'L-1');
  assert.equal(state.goal, 'Optimize query');
  assert.equal(state.success, 'p99 < 200ms');
  assert.equal(state.maxIterations, 5);
  assert.equal(state.mode, 'autonomous');
  assert.equal(state.status, 'running');
  assert.equal(state.iteration, 0);
  assert.deepEqual(state.history, []);
  assert.ok(typeof state.startedAt === 'string', 'startedAt should be an ISO string');
});

test('initState accepts manual mode', () => {
  const root = makeTmp();
  initState('L-2', 'Fix flaky test', 'CI green', 3, 'manual', root);

  const stateFile = path.join(root, 'cadence', 'loops', 'L-2', 'state.json');
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  assert.equal(state.mode, 'manual');
});

test('initState creates parent directories when they do not exist', () => {
  const root = makeTmp();
  // No cadence/loops directory yet -- initState should create it.
  initState('L-3', 'goal', 'success', 10, 'autonomous', root);
  assert.ok(fs.existsSync(path.join(root, 'cadence', 'loops', 'L-3', 'state.json')));
});

test('initState throws when maxIterations is not a positive integer', () => {
  const root = makeTmp();
  assert.throws(() => initState('L-4', 'g', 's', 0, 'autonomous', root), /maxIterations/);
  assert.throws(() => initState('L-4', 'g', 's', -1, 'autonomous', root), /maxIterations/);
  assert.throws(() => initState('L-4', 'g', 's', 1.5, 'autonomous', root), /maxIterations/);
});

test('initState throws when mode is not autonomous or manual', () => {
  const root = makeTmp();
  assert.throws(() => initState('L-5', 'g', 's', 3, 'rocket', root), /mode/);
});

test('initState throws when id is empty', () => {
  const root = makeTmp();
  assert.throws(() => initState('', 'g', 's', 3, 'autonomous', root), /id/);
});

test('writePhase appends a record to history and updates iteration and phase', () => {
  const root = makeTmp();
  initState('L-10', 'goal', 'success', 5, 'autonomous', root);

  writePhase('L-10', 1, 'ACT', 'ran tests', 'proceed', root);

  const state = readState('L-10', root);
  assert.equal(state.iteration, 1);
  assert.equal(state.phase, 'ACT');
  assert.equal(state.history.length, 1);

  const entry = state.history[0];
  assert.equal(entry.id, 'L-10');
  assert.equal(entry.iteration, 1);
  assert.equal(entry.phase, 'ACT');
  assert.equal(entry.observation, 'ran tests');
  assert.equal(entry.decision, 'proceed');
  assert.equal(entry.mode, 'autonomous');
  assert.ok(typeof entry.timestamp === 'string', 'timestamp should be an ISO string');
});

test('writePhase appends multiple entries across phases and iterations', () => {
  const root = makeTmp();
  initState('L-11', 'goal', 'success', 5, 'autonomous', root);

  writePhase('L-11', 1, 'ACT', 'dispatched coder', null, root);
  writePhase('L-11', 1, 'OBSERVE', 'tests pass', null, root);
  writePhase('L-11', 1, 'EVALUATE', 'improvement noted', null, root);
  writePhase('L-11', 1, 'DECIDE', 'continue', 'continue', root);

  const state = readState('L-11', root);
  assert.equal(state.history.length, 4);
  assert.deepEqual(
    state.history.map((e) => e.phase),
    ['ACT', 'OBSERVE', 'EVALUATE', 'DECIDE']
  );
});

test('writePhase throws for an invalid phase name', () => {
  const root = makeTmp();
  initState('L-12', 'goal', 'success', 5, 'autonomous', root);
  assert.throws(() => writePhase('L-12', 1, 'THINK', 'obs', 'dec', root), /phase/);
});

test('writePhase throws when state.json does not exist', () => {
  const root = makeTmp();
  assert.throws(() => writePhase('L-99', 1, 'ACT', 'obs', 'dec', root), /not found|ENOENT/i);
});

test('finalizeLoop sets status to success and records finishedAt', () => {
  const root = makeTmp();
  initState('L-20', 'goal', 'success', 5, 'autonomous', root);

  finalizeLoop('L-20', 'success', root);

  const state = readState('L-20', root);
  assert.equal(state.status, 'success');
  assert.ok(typeof state.finishedAt === 'string', 'finishedAt should be an ISO string');
});

test('finalizeLoop sets status to max_iterations_reached', () => {
  const root = makeTmp();
  initState('L-21', 'goal', 'success', 3, 'autonomous', root);

  finalizeLoop('L-21', 'max_iterations_reached', root);

  const state = readState('L-21', root);
  assert.equal(state.status, 'max_iterations_reached');
  assert.ok(state.finishedAt);
});

test('finalizeLoop sets status to error', () => {
  const root = makeTmp();
  initState('L-22', 'goal', 'success', 3, 'autonomous', root);

  finalizeLoop('L-22', 'error', root);

  const state = readState('L-22', root);
  assert.equal(state.status, 'error');
  assert.ok(state.finishedAt);
});

test('finalizeLoop throws for an unrecognised status', () => {
  const root = makeTmp();
  initState('L-23', 'goal', 'success', 3, 'autonomous', root);
  assert.throws(() => finalizeLoop('L-23', 'cancelled', root), /status/);
});

test('finalizeLoop throws when state.json does not exist', () => {
  const root = makeTmp();
  assert.throws(() => finalizeLoop('L-99', 'success', root), /not found|ENOENT/i);
});

test('readState parses and returns the full state object', () => {
  const root = makeTmp();
  initState('L-30', 'my goal', 'done when green', 7, 'manual', root);
  writePhase('L-30', 1, 'ACT', 'acted', null, root);

  const state = readState('L-30', root);
  assert.equal(state.id, 'L-30');
  assert.equal(state.goal, 'my goal');
  assert.equal(state.mode, 'manual');
  assert.equal(state.history.length, 1);
});

test('readState throws when state.json does not exist', () => {
  const root = makeTmp();
  assert.throws(() => readState('L-99', root), /not found|ENOENT/i);
});

test('readState throws when state.json is corrupt JSON', () => {
  const root = makeTmp();
  const dir = path.join(root, 'cadence', 'loops', 'L-bad');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), 'not json');
  assert.throws(() => readState('L-bad', root), /parse|JSON|invalid/i);
});
