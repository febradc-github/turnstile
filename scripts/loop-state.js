#!/usr/bin/env node
'use strict';
// Manages persistent loop state for turnstile's loop runner.
//
// State lives at: <projectRoot>/turnstile/loops/<id>/state.json
//
// The projectRoot is passed explicitly so the module can be used from tests
// without touching the real working directory.  When called from hooks or
// skills the caller passes process.cwd() or CLAUDE_PROJECT_DIR.
//
// Exports:
//   initState(id, goal, success, maxIterations, mode, projectRoot)
//   writePhase(id, iteration, phase, observation, decision, projectRoot)
//   finalizeLoop(id, status, projectRoot)
//   readState(id, projectRoot)
//   addBrainNote(id, noteName, projectRoot)

const fs = require('node:fs');
const path = require('node:path');

const VALID_PHASES = ['ACT', 'OBSERVE', 'EVALUATE', 'DECIDE'];
const VALID_MODES = ['autonomous', 'manual'];
const VALID_FINAL_STATUSES = ['success', 'max_iterations_reached', 'error'];

function stateDir(id, projectRoot) {
  return path.join(projectRoot, 'turnstile', 'loops', id);
}

function stateFile(id, projectRoot) {
  return path.join(stateDir(id, projectRoot), 'state.json');
}

function readRaw(id, projectRoot) {
  const file = stateFile(id, projectRoot);
  if (!fs.existsSync(file)) {
    throw new Error(`Loop state not found: ${file}`);
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse loop state JSON at ${file}: ${err.message}`);
  }
  return raw;
}

function writeRaw(id, projectRoot, state) {
  const dir = stateDir(id, projectRoot);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(stateFile(id, projectRoot), JSON.stringify(state, null, 2) + '\n', 'utf8');
}

/**
 * Initialise a new loop run and write turnstile/loops/<id>/state.json.
 *
 * @param {string} id            - Unique loop identifier (e.g. 'L-1' or a UUID).
 * @param {string} goal          - What the loop is trying to achieve.
 * @param {string} success       - Human-readable condition that ends the loop successfully.
 * @param {number} maxIterations - Hard cap on iterations; must be a positive integer.
 * @param {string} mode          - 'autonomous' or 'manual'.
 * @param {string} projectRoot   - Absolute path to the project root (contains turnstile/).
 */
function initState(id, goal, success, maxIterations, mode, projectRoot) {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw new Error('id must be a non-empty string');
  }
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new Error('maxIterations must be a positive integer');
  }
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`mode must be one of: ${VALID_MODES.join(', ')} -- got: ${mode}`);
  }

  const state = {
    id,
    goal,
    success,
    maxIterations,
    mode,
    status: 'running',
    iteration: 0,
    phase: null,
    history: [],
    brain_notes: [],
    startedAt: new Date().toISOString(),
  };

  writeRaw(id, projectRoot, state);
}

/**
 * Append a phase record to the loop's history and update the current phase
 * and iteration counters.
 *
 * @param {string}      id          - Loop identifier.
 * @param {number}      iteration   - Current iteration number (1-based).
 * @param {string}      phase       - One of ACT, OBSERVE, EVALUATE, DECIDE.
 * @param {string|null} observation - What was observed in this phase.
 * @param {string|null} decision    - Decision made (populated at DECIDE phase).
 * @param {string}      projectRoot - Absolute path to the project root.
 */
function writePhase(id, iteration, phase, observation, decision, projectRoot) {
  if (!VALID_PHASES.includes(phase)) {
    throw new Error(`phase must be one of: ${VALID_PHASES.join(', ')} -- got: ${phase}`);
  }

  const state = readRaw(id, projectRoot);

  const entry = {
    id,
    iteration,
    phase,
    observation: observation !== undefined ? observation : null,
    decision: decision !== undefined ? decision : null,
    timestamp: new Date().toISOString(),
    mode: state.mode,
  };

  state.iteration = iteration;
  state.phase = phase;
  state.history.push(entry);

  writeRaw(id, projectRoot, state);
}

/**
 * Mark the loop as finished with one of the three terminal statuses.
 *
 * @param {string} id          - Loop identifier.
 * @param {string} status      - 'success' | 'max_iterations_reached' | 'error'.
 * @param {string} projectRoot - Absolute path to the project root.
 */
function finalizeLoop(id, status, projectRoot) {
  if (!VALID_FINAL_STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${VALID_FINAL_STATUSES.join(', ')} -- got: ${status}`);
  }

  const state = readRaw(id, projectRoot);
  state.status = status;
  state.finishedAt = new Date().toISOString();

  writeRaw(id, projectRoot, state);
}

/**
 * Read and return the full state object for a loop.
 *
 * @param {string} id          - Loop identifier.
 * @param {string} projectRoot - Absolute path to the project root.
 * @returns {object} The parsed state.
 */
function readState(id, projectRoot) {
  return readRaw(id, projectRoot);
}

/**
 * Append a brain note name to the loop's brain_notes array in state.json.
 * Called after brain-curator has written a note for a DECIDE outcome.
 *
 * @param {string} id          - Loop identifier.
 * @param {string} noteName    - The note name (e.g. 'loop-L-1-iter-1'), without path or extension.
 * @param {string} projectRoot - Absolute path to the project root.
 */
function addBrainNote(id, noteName, projectRoot) {
  const state = readRaw(id, projectRoot);
  state.brain_notes.push(noteName);
  writeRaw(id, projectRoot, state);
}

module.exports = { initState, writePhase, finalizeLoop, readState, addBrainNote };
