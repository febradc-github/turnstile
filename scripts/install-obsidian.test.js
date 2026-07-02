const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.join(__dirname, 'install-obsidian.js');
const {
  platformName,
  detectInstall,
} = require('./install-obsidian.js');

function makeDeps(overrides = {}) {
  const calls = { run: [] };
  const commands = overrides.commands || {};
  const existing = overrides.existing || [];
  return {
    calls,
    deps: {
      platform: overrides.platform || 'win32',
      env: overrides.env || { LOCALAPPDATA: 'C:\\Users\\t\\AppData\\Local' },
      cwd: overrides.cwd || path.join(__dirname, 'nonexistent-project'),
      exists: (p) => existing.includes(p),
      run: (cmd, args) => {
        const key = [cmd, ...args].join(' ');
        calls.run.push(key);
        return commands[key] || { status: 1, stdout: '', stderr: '' };
      },
      mkdir: () => {},
      writeFile: () => {},
    },
  };
}

const WIN_USER_PATH = 'C:\\Users\\t\\AppData\\Local\\Programs\\Obsidian\\Obsidian.exe';
const WIN_MACHINE_PATH = 'C:\\Program Files\\Obsidian\\Obsidian.exe';

test('platformName maps node platforms to friendly names', () => {
  assert.equal(platformName('win32'), 'windows');
  assert.equal(platformName('darwin'), 'macos');
  assert.equal(platformName('linux'), 'linux');
  assert.equal(platformName('freebsd'), null);
});

test('windows: finds per-user install under LOCALAPPDATA\Programs', () => {
  const { deps } = makeDeps({ platform: 'win32', existing: [WIN_USER_PATH] });
  assert.deepEqual(detectInstall(deps), { alreadyInstalled: true, installPath: WIN_USER_PATH });
});

test('windows: falls back to Program Files', () => {
  const { deps } = makeDeps({ platform: 'win32', existing: [WIN_MACHINE_PATH] });
  assert.deepEqual(detectInstall(deps), { alreadyInstalled: true, installPath: WIN_MACHINE_PATH });
});

test('windows: not installed when neither path exists', () => {
  const { deps } = makeDeps({ platform: 'win32' });
  assert.deepEqual(detectInstall(deps), { alreadyInstalled: false, installPath: null });
});

test('macos: detects /Applications/Obsidian.app', () => {
  const { deps } = makeDeps({ platform: 'darwin', existing: ['/Applications/Obsidian.app'] });
  assert.deepEqual(detectInstall(deps), { alreadyInstalled: true, installPath: '/Applications/Obsidian.app' });
});

test('linux: snap list obsidian succeeding means installed', () => {
  const { deps } = makeDeps({
    platform: 'linux',
    commands: { 'snap list obsidian': { status: 0, stdout: 'obsidian 1.6', stderr: '' } },
  });
  assert.deepEqual(detectInstall(deps), { alreadyInstalled: true, installPath: 'snap:obsidian' });
});

test('linux: flatpak app list containing md.obsidian.Obsidian means installed', () => {
  const { deps } = makeDeps({
    platform: 'linux',
    commands: { 'flatpak list --app': { status: 0, stdout: 'Obsidian\tmd.obsidian.Obsidian\t1.6', stderr: '' } },
  });
  assert.deepEqual(detectInstall(deps), { alreadyInstalled: true, installPath: 'flatpak:md.obsidian.Obsidian' });
});

test('linux: not installed when snap and flatpak both come up empty', () => {
  const { deps } = makeDeps({ platform: 'linux' });
  assert.deepEqual(detectInstall(deps), { alreadyInstalled: false, installPath: null });
});
