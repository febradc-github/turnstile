const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('remind.js prints the workflow reminder to stdout', () => {
  const output = execFileSync('node', [path.join(__dirname, 'remind.js')], { encoding: 'utf8' });
  assert.equal(
    output,
    'Follow the cadence workflow gates in order; never skip a step. If anything is unclear, ask before proceeding.\n'
  );
});
