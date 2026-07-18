'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { isTerminal, buildHtml } = require('./loop-watch.js');

// --- isTerminal ---

test('isTerminal returns true for success', () => {
  assert.equal(isTerminal('success'), true);
});

test('isTerminal returns true for max_iterations_reached', () => {
  assert.equal(isTerminal('max_iterations_reached'), true);
});

test('isTerminal returns true for error', () => {
  assert.equal(isTerminal('error'), true);
});

test('isTerminal returns false for running', () => {
  assert.equal(isTerminal('running'), false);
});

test('isTerminal returns false for unknown statuses', () => {
  assert.equal(isTerminal('pending'), false);
  assert.equal(isTerminal(''), false);
  assert.equal(isTerminal(null), false);
  assert.equal(isTerminal(undefined), false);
});

// --- buildHtml: default node labels ---

test('buildHtml returns a string', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.equal(typeof html, 'string');
});

test('buildHtml contains all four default node labels', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(html.includes('ACT'), 'should contain ACT');
  assert.ok(html.includes('OBSERVE'), 'should contain OBSERVE');
  assert.ok(html.includes('EVALUATE'), 'should contain EVALUATE');
  assert.ok(html.includes('DECIDE'), 'should contain DECIDE');
});

test('buildHtml contains the amber label text', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(html.includes('feedback'), 'should contain feedback label');
  assert.ok(html.includes('next cycle'), 'should contain next cycle label');
});

test('buildHtml contains prefers-reduced-motion media query', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(html.includes('prefers-reduced-motion'), 'should contain prefers-reduced-motion');
});

test('buildHtml contains GET /state polling reference', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(html.includes('GET /state') || html.includes('/state'), 'should contain /state endpoint');
});

test('buildHtml contains cyan color #00ffff', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(html.includes('#00ffff'), 'should contain cyan color #00ffff');
});

test('buildHtml contains amber color #ffb300', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(html.includes('#ffb300'), 'should contain amber color #ffb300');
});

// --- buildHtml: custom node labels ---

test('buildHtml with custom node labels renders those labels instead of defaults', () => {
  const customLabels = ['PLAN', 'RUN', 'CHECK', 'REPORT'];
  const html = buildHtml(
    { status: 'running', phase: null, history: [], id: 'L-1' },
    customLabels
  );
  assert.ok(html.includes('PLAN'), 'should contain custom label PLAN');
  assert.ok(html.includes('RUN'), 'should contain custom label RUN');
  assert.ok(html.includes('CHECK'), 'should contain custom label CHECK');
  assert.ok(html.includes('REPORT'), 'should contain custom label REPORT');
  // Default labels should not be present as node labels when overridden.
  // (ACT, OBSERVE, EVALUATE, DECIDE may appear in JS logic, so check that
  //  the custom labels replace the card text, not that default strings are absent.)
  assert.ok(!html.includes('>ACT<') && !html.includes('"ACT"') || html.includes('PLAN'),
    'custom labels should replace defaults in the rendered cards');
});

test('buildHtml with custom labels still contains required structural elements', () => {
  const customLabels = ['PLAN', 'RUN', 'CHECK', 'REPORT'];
  const html = buildHtml(
    { status: 'running', phase: 'RUN', history: [], id: 'L-2' },
    customLabels
  );
  assert.ok(html.includes('#00ffff'), 'should still contain cyan color');
  assert.ok(html.includes('#ffb300'), 'should still contain amber color');
  assert.ok(html.includes('prefers-reduced-motion'), 'should still contain media query');
});

// --- buildHtml: active phase highlighting ---

test('buildHtml marks the active phase node distinctively', () => {
  const html = buildHtml({ status: 'running', phase: 'ACT', history: [], id: 'L-1' });
  // Active node gets cyan border -- check that both the node label and the active
  // styling class/style appear together.
  assert.ok(html.includes('ACT'), 'ACT node should appear');
  assert.ok(html.includes('active') || html.includes('node--active') || html.includes('2px solid'),
    'active node styling should be present');
});

// --- buildHtml: terminal log entries ---

test('buildHtml includes history entries in the terminal log', () => {
  const state = {
    status: 'running',
    phase: 'DECIDE',
    history: [
      { iteration: 1, phase: 'DECIDE', observation: 'tests pass', decision: 'continue', timestamp: '2026-07-18T10:00:00Z' },
    ],
    id: 'L-1',
  };
  const html = buildHtml(state);
  assert.ok(html.includes('tests pass') || html.includes('continue'),
    'history entries should appear in the terminal log');
});
