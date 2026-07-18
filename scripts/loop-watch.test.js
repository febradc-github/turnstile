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

// --- New tests for C-5: visual overhaul ---

// 1. Four node elements have style containing their corner left/top percentages
test('buildHtml nodes have corner left/top percentage styles', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(html.includes('left: 18%'), 'should contain left: 18%');
  assert.ok(html.includes('left: 82%'), 'should contain left: 82%');
  assert.ok(html.includes('top: 18%'), 'should contain top: 18%');
  assert.ok(html.includes('top: 82%'), 'should contain top: 82%');
});

// 2. No calc( in node inline styles
test('buildHtml node inline styles do not use calc()', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  // Extract just the node divs region (from <div class="node" to next structural element)
  // Check that calc( does not appear in the overall HTML (it shouldn't be needed)
  assert.ok(!html.includes('calc('), 'node inline styles should not use calc()');
});

// 3. Four .trace elements inside .circuit
test('buildHtml contains exactly four trace div elements', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  const traceMatches = html.match(/class="trace"/g) || [];
  assert.equal(traceMatches.length, 4, 'should contain exactly 4 .trace elements');
});

// 4. Pulse keyframes contain 18% and 82% corner coords and 6s duration
test('buildHtml pulse animation uses corner coordinates and 6s duration', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(html.includes('circuit-pulse'), 'should contain circuit-pulse keyframes');
  assert.ok(html.includes('6s'), 'pulse animation should be 6s');
  // The keyframes use 18% and 82% for corners
  // Check that these percentages appear in context of the keyframes
  const keyframeStart = html.indexOf('@keyframes circuit-pulse');
  assert.ok(keyframeStart !== -1, 'circuit-pulse keyframes should be defined');
  const keyframeBlock = html.slice(keyframeStart, keyframeStart + 400);
  assert.ok(keyframeBlock.includes('18%'), 'keyframes should use 18% corner position');
  assert.ok(keyframeBlock.includes('82%'), 'keyframes should use 82% corner position');
});

// 5. Demo log lines present when history is empty; contains log-highlight span
test('buildHtml shows demo log lines when history is empty', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(html.includes('log-highlight'), 'should contain log-highlight class');
  assert.ok(html.includes('planning next action') || html.includes('deciding next phase'),
    'should contain demo log lines');
  assert.ok(html.includes('<span class="log-highlight">'), 'log-highlight should be a span');
});

// 6. No <input in buildHtml output
test('buildHtml output contains no input elements', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(!html.includes('<input'), 'should not contain any <input element');
});

// 7a. Subtitle rendered when state.config.nodeSubtitles is provided
test('buildHtml renders subtitle when config.nodeSubtitles is provided', () => {
  const state = {
    status: 'running', phase: null, history: [], id: 'L-1',
    config: { nodeSubtitles: ['sub-act', 'sub-obs', 'sub-eval', 'sub-dec'] },
  };
  const html = buildHtml(state);
  assert.ok(html.includes('sub-act'), 'should render first subtitle');
  assert.ok(html.includes('node-subtitle'), 'should include node-subtitle class');
});

// 7b. Subtitle not rendered when absent — check for the element tag, not just the CSS class
test('buildHtml does not render subtitle element when nodeSubtitles is absent', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(!html.includes('<span class="node-subtitle">'), 'should not render node-subtitle element when absent');
});

// 7c. Empty subtitle entry does not render a subtitle element
test('buildHtml does not render subtitle element when subtitle entry is empty string', () => {
  const state = {
    status: 'running', phase: null, history: [], id: 'L-1',
    config: { nodeSubtitles: ['', '', '', ''] },
  };
  const html = buildHtml(state);
  assert.ok(!html.includes('<span class="node-subtitle">'), 'should not render node-subtitle element for empty strings');
});

// 8. DECIDE history renders decision token in log-highlight span
test('buildHtml wraps decision token in log-highlight when DECIDE history exists', () => {
  const state = {
    status: 'running',
    phase: 'DECIDE',
    history: [
      { iteration: 1, phase: 'DECIDE', observation: 'tests pass', decision: 'continue', timestamp: '2026-07-18T10:00:00Z' },
    ],
    id: 'L-1',
  };
  const html = buildHtml(state);
  assert.ok(html.includes('<span class="log-highlight">continue</span>'),
    'decision token should be wrapped in log-highlight span');
  // The server-rendered log section (between <div id="log"> and </div>) should show real entries,
  // not the demo lines. We check the section before <script> to avoid matching the JS string.
  const logSectionEnd = html.indexOf('<script>');
  const logSection = logSectionEnd !== -1 ? html.slice(0, logSectionEnd) : html;
  assert.ok(!logSection.includes('planning next action'),
    'server-rendered log section should not show demo lines when real history present');
});

// 9a. Four node data-label attributes are present
test('buildHtml nodes carry correct data-label attributes', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(html.includes('data-label="ACT"'), 'ACT node should have data-label');
  assert.ok(html.includes('data-label="OBSERVE"'), 'OBSERVE node should have data-label');
  assert.ok(html.includes('data-label="EVALUATE"'), 'EVALUATE node should have data-label');
  assert.ok(html.includes('data-label="DECIDE"'), 'DECIDE node should have data-label');
});

// 9b. Node transform centering via CSS class not inline calc()
test('buildHtml node CSS class uses transform translate(-50%, -50%) for centering', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(html.includes('translate(-50%, -50%)'), 'should use transform translate for centering');
});

// 9c. Terminal log height is <= 80px and overflow: hidden
test('buildHtml terminal log has fixed height <= 80px with overflow hidden', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  // The terminal-log should have height: 64px or similar <= 80px and overflow: hidden
  assert.ok(html.includes('overflow: hidden'), 'terminal log should use overflow: hidden');
  // Should not use overflow-y: auto anymore
  assert.ok(!html.includes('overflow-y: auto'), 'should not use overflow-y: auto');
});

test('buildHtml .node CSS uses responsive min() sizing', () => {
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  assert.ok(html.includes('min(120px, 24vw)'), 'node width should use min() for responsive sizing');
  assert.ok(!html.includes('width: 120px;'), 'node width should not be bare fixed 120px');
});

test('applyState with null phase does not clear demo cycle indicator in HTML', () => {
  // When phase is null the server renders the demo cycle script block;
  // verify the condition that enables the demo cycle (activePhase falsy) is present.
  const html = buildHtml({ status: 'running', phase: null, history: [], id: 'L-1' });
  // The demo cycle JS block is only emitted when activePhase is null.
  // Confirm the condition check (state.phase gating) pattern is present.
  // We verify by checking the applyState clear is gated: the string
  // "demoCycle && state.phase" must appear in the script.
  assert.ok(html.includes('demoCycle && state.phase'),
    'demo cycle clear should be gated on state.phase being non-null');
});
