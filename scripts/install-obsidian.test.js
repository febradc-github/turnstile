const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.join(__dirname, 'install-obsidian.js');
const {
  platformName,
  detectInstall,
  detect,
  install,
  scaffold,
  VAULT_FILES,
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

test('detect on windows without obsidian offers winget when available', () => {
  const { deps } = makeDeps({
    platform: 'win32',
    commands: { 'winget --version': { status: 0, stdout: 'v1.8', stderr: '' } },
  });
  assert.deepEqual(detect(deps), {
    platform: 'windows',
    alreadyInstalled: false,
    installPath: null,
    packageManager: 'winget',
    installCommand: 'winget install Obsidian.Obsidian',
  });
});

test('detect reports packageManager null when nothing is available', () => {
  const { deps } = makeDeps({ platform: 'win32' });
  const result = detect(deps);
  assert.equal(result.packageManager, null);
  assert.equal(result.installCommand, null);
});

test('detect on macos offers brew cask', () => {
  const { deps } = makeDeps({
    platform: 'darwin',
    commands: { 'brew --version': { status: 0, stdout: '4.3', stderr: '' } },
  });
  const result = detect(deps);
  assert.equal(result.packageManager, 'brew');
  assert.equal(result.installCommand, 'brew install --cask obsidian');
});

test('detect on linux prefers snap over flatpak', () => {
  const { deps } = makeDeps({
    platform: 'linux',
    commands: {
      'snap version': { status: 0, stdout: 'snap 2.63', stderr: '' },
      'flatpak --version': { status: 0, stdout: 'Flatpak 1.15', stderr: '' },
    },
  });
  const result = detect(deps);
  assert.equal(result.packageManager, 'snap');
  assert.equal(result.installCommand, 'snap install obsidian --classic');
});

test('detect on linux falls back to flatpak when snap is missing', () => {
  const { deps } = makeDeps({
    platform: 'linux',
    commands: { 'flatpak --version': { status: 0, stdout: 'Flatpak 1.15', stderr: '' } },
  });
  const result = detect(deps);
  assert.equal(result.packageManager, 'flatpak');
  assert.equal(result.installCommand, 'flatpak install -y flathub md.obsidian.Obsidian');
});

test('detect on an unsupported platform reports platform null', () => {
  const { deps } = makeDeps({ platform: 'freebsd' });
  assert.deepEqual(detect(deps), {
    platform: null,
    alreadyInstalled: false,
    installPath: null,
    packageManager: null,
    installCommand: null,
  });
});

test('install runs the resolved package-manager command and reports success', () => {
  const { deps, calls } = makeDeps({
    platform: 'win32',
    commands: {
      'winget --version': { status: 0, stdout: 'v1.8', stderr: '' },
      'winget install Obsidian.Obsidian': { status: 0, stdout: 'Successfully installed', stderr: '' },
    },
  });
  const result = install(deps);
  assert.equal(result.success, true);
  assert.match(result.message, /Successfully installed/);
  assert.ok(calls.run.includes('winget install Obsidian.Obsidian'));
});

test('install surfaces a failing command verbatim', () => {
  const { deps } = makeDeps({
    platform: 'win32',
    commands: {
      'winget --version': { status: 0, stdout: 'v1.8', stderr: '' },
      'winget install Obsidian.Obsidian': { status: 5, stdout: '', stderr: 'requires elevation' },
    },
  });
  const result = install(deps);
  assert.equal(result.success, false);
  assert.match(result.message, /status 5/);
  assert.match(result.message, /requires elevation/);
});

test('install refuses when no package manager is available', () => {
  const { deps, calls } = makeDeps({ platform: 'win32' });
  const result = install(deps);
  assert.equal(result.success, false);
  assert.match(result.message, /obsidian\.md\/download/);
  assert.ok(!calls.run.includes('winget install Obsidian.Obsidian'));
});

test('scaffold refuses when cadence/ does not exist', () => {
  const { deps, calls } = makeDeps({ cwd: '/proj' });
  assert.deepEqual(scaffold(deps), { scaffolded: false, reason: 'no-cadence-dir' });
  assert.equal(calls.run.length, 0);
});

test('scaffold is a no-op when cadence/.obsidian already exists', () => {
  const writes = [];
  const { deps } = makeDeps({
    cwd: '/proj',
    existing: [path.join('/proj', 'cadence'), path.join('/proj', 'cadence', '.obsidian')],
  });
  deps.writeFile = (p) => writes.push(p);
  assert.deepEqual(scaffold(deps), { scaffolded: false, reason: 'already-exists' });
  assert.equal(writes.length, 0);
});

test('scaffold writes the three captured vault files on first run', () => {
  const writes = {};
  const mkdirs = [];
  const { deps } = makeDeps({ cwd: '/proj', existing: [path.join('/proj', 'cadence')] });
  deps.mkdir = (p) => mkdirs.push(p);
  deps.writeFile = (p, c) => { writes[path.basename(p)] = c; };
  assert.deepEqual(scaffold(deps), { scaffolded: true, reason: 'created' });
  assert.deepEqual(mkdirs, [path.join('/proj', 'cadence', '.obsidian')]);
  assert.deepEqual(Object.keys(writes).sort(), ['app.json', 'appearance.json', 'core-plugins.json']);
  // New notes default into brain/ so unresolved-link clicks can't create
  // alias-shadowing strays at the vault root.
  assert.deepEqual(JSON.parse(writes['app.json']), { newFileLocation: 'folder', newFileFolderPath: 'brain' });
  assert.deepEqual(JSON.parse(writes['appearance.json']), {});
  const corePlugins = JSON.parse(writes['core-plugins.json']);
  assert.equal(corePlugins.graph, true);
  assert.equal(corePlugins.backlink, true);
  assert.equal(corePlugins['tag-pane'], true);
  assert.equal(corePlugins['global-search'], true);
  assert.equal(corePlugins['file-explorer'], true);
  assert.deepEqual(corePlugins, VAULT_FILES['core-plugins.json']);
});

test('cli: unknown subcommand exits 1 with a JSON error line', () => {
  const result = spawnSync('node', [SCRIPT_PATH, 'bogus'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.match(parsed.error, /bogus/);
});

test('cli: detect prints one parseable JSON line', () => {
  const result = spawnSync('node', [SCRIPT_PATH, 'detect'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.ok(['windows', 'macos', 'linux', null].includes(parsed.platform));
  assert.equal(typeof parsed.alreadyInstalled, 'boolean');
});

test('cli: scaffold outside a cadence project refuses politely', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-test-'));
  try {
    const result = spawnSync('node', [SCRIPT_PATH, 'scaffold'], { encoding: 'utf8', cwd: tmp });
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), { scaffolded: false, reason: 'no-cadence-dir' });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
