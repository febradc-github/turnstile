const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.join(__dirname, 'install-obsidian.js');
const {
  platformName,
} = require('./install-obsidian.js');

test('platformName maps node platforms to friendly names', () => {
  assert.equal(platformName('win32'), 'windows');
  assert.equal(platformName('darwin'), 'macos');
  assert.equal(platformName('linux'), 'linux');
  assert.equal(platformName('freebsd'), null);
});
