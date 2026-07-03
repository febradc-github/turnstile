const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { openObsidian, buildUri } = require('./open-obsidian.js');

function makeDeps(overrides = {}) {
  const calls = { run: [], writes: {}, mkdirs: [] };
  const existing = overrides.existing || [];
  const files = overrides.files || {};
  return {
    calls,
    deps: {
      platform: overrides.platform || 'win32',
      env: overrides.env || {},
      cwd: overrides.cwd || 'D:\\proj',
      exists: (p) => existing.includes(p) || p in files,
      readFile: (p) => {
        if (!(p in files)) throw new Error('ENOENT: ' + p);
        return files[p];
      },
      writeFile: (p, content) => {
        if (overrides.writeFails) throw new Error('EACCES: read-only');
        calls.writes[p] = content;
      },
      mkdir: (p) => calls.mkdirs.push(p),
      randomId: () => 'deadbeefdeadbeef',
      now: () => 1234567890,
      run: (cmd, args) => {
        calls.run.push([cmd, ...args]);
        return overrides.runResult || { status: 0, stdout: '', stderr: '' };
      },
    },
  };
}

test('buildUri percent-encodes the vault path', () => {
  assert.equal(buildUri('D:\\proj\\cadence'), 'obsidian://open?path=D%3A%5Cproj%5Ccadence');
});

test('open refuses without a cadence dir', () => {
  const { deps, calls } = makeDeps();
  assert.deepEqual(openObsidian(deps), { opened: false, reason: 'no-cadence-dir' });
  assert.equal(calls.run.length, 0);
});

test('open on windows uses cmd start and reports hotkey + vault status', () => {
  const cadence = path.resolve('D:\\proj', 'cadence');
  const { deps, calls } = makeDeps({ existing: [cadence] });
  const result = openObsidian(deps);
  assert.equal(result.opened, true);
  assert.equal(result.vaultConfigured, false);
  assert.equal(result.graphHotkey, 'Ctrl+G');
  assert.deepEqual(calls.run[0].slice(0, 3), ['cmd', '/c', 'start']);
  assert.match(calls.run[0][calls.run[0].length - 1], /^obsidian:\/\/open\?path=/);
});

test('open on macos uses open and Cmd+G; configured vault is reported', () => {
  const cadence = path.resolve('/proj', 'cadence');
  const { deps, calls } = makeDeps({
    platform: 'darwin',
    cwd: '/proj',
    existing: [cadence, path.join(cadence, '.obsidian')],
  });
  const result = openObsidian(deps);
  assert.equal(result.opened, true);
  assert.equal(result.vaultConfigured, true);
  assert.equal(result.graphHotkey, 'Cmd+G');
  assert.equal(calls.run[0][0], 'open');
});

test('open on linux uses xdg-open', () => {
  const cadence = path.resolve('/proj', 'cadence');
  const { deps, calls } = makeDeps({ platform: 'linux', cwd: '/proj', existing: [cadence] });
  assert.equal(openObsidian(deps).opened, true);
  assert.equal(calls.run[0][0], 'xdg-open');
});

test('open on unsupported platform returns the uri for manual use', () => {
  const cadence = path.resolve('/proj', 'cadence');
  const { deps, calls } = makeDeps({ platform: 'freebsd', cwd: '/proj', existing: [cadence] });
  const result = openObsidian(deps);
  assert.equal(result.opened, false);
  assert.equal(result.reason, 'unsupported-platform');
  assert.match(result.uri, /^obsidian:/);
  assert.equal(calls.run.length, 0);
});

test('open surfaces opener failure', () => {
  const cadence = path.resolve('D:\\proj', 'cadence');
  const { deps } = makeDeps({ existing: [cadence], runResult: { status: 1, stdout: '', stderr: 'no handler' } });
  const result = openObsidian(deps);
  assert.equal(result.opened, false);
  assert.equal(result.reason, 'opener-failed');
  assert.match(result.message, /no handler/);
});

test('open registers the vault in the global registry before launching', () => {
  const cadence = path.resolve('D:\\proj', 'cadence');
  const registry = path.join('C:\\Users\\d\\AppData\\Roaming', 'obsidian', 'obsidian.json');
  const { deps, calls } = makeDeps({
    existing: [cadence],
    env: { APPDATA: 'C:\\Users\\d\\AppData\\Roaming' },
    files: { [registry]: '{"vaults":{"aaaa":{"path":"C:\\\\other","ts":1,"open":true}}}' },
  });
  const result = openObsidian(deps);
  assert.equal(result.opened, true);
  assert.equal(result.vaultRegistered, true);
  assert.equal(result.registration, 'added');
  const written = JSON.parse(calls.writes[registry]);
  assert.equal(written.vaults.aaaa.path, 'C:\\other');
  assert.deepEqual(written.vaults.deadbeefdeadbeef, { path: cadence, ts: 1234567890 });
});

test('an already-registered vault is not duplicated (case-insensitive on windows)', () => {
  const cadence = path.resolve('D:\\proj', 'cadence');
  const registry = path.join('C:\\Users\\d\\AppData\\Roaming', 'obsidian', 'obsidian.json');
  const { deps, calls } = makeDeps({
    existing: [cadence],
    env: { APPDATA: 'C:\\Users\\d\\AppData\\Roaming' },
    files: { [registry]: JSON.stringify({ vaults: { bbbb: { path: cadence.toUpperCase(), ts: 1 } } }) },
  });
  const result = openObsidian(deps);
  assert.equal(result.vaultRegistered, true);
  assert.equal(result.registration, 'already-registered');
  assert.deepEqual(calls.writes, {});
});

test('open creates the registry when Obsidian has never written one', () => {
  const cadence = path.resolve('/proj', 'cadence');
  const registry = path.join('/home/d', '.config', 'obsidian', 'obsidian.json');
  const { deps, calls } = makeDeps({
    platform: 'linux',
    cwd: '/proj',
    env: { HOME: '/home/d' },
    existing: [cadence],
  });
  const result = openObsidian(deps);
  assert.equal(result.vaultRegistered, true);
  assert.equal(calls.mkdirs.length, 1);
  const written = JSON.parse(calls.writes[registry]);
  assert.deepEqual(written.vaults.deadbeefdeadbeef, { path: cadence, ts: 1234567890 });
});

test('open finds the snap registry on linux when it exists', () => {
  const cadence = path.resolve('/proj', 'cadence');
  const snapRegistry = path.join('/home/d', 'snap', 'obsidian', 'current', '.config', 'obsidian', 'obsidian.json');
  const { deps, calls } = makeDeps({
    platform: 'linux',
    cwd: '/proj',
    env: { HOME: '/home/d' },
    existing: [cadence],
    files: { [snapRegistry]: '{"vaults":{}}' },
  });
  const result = openObsidian(deps);
  assert.equal(result.vaultRegistered, true);
  assert.ok(calls.writes[snapRegistry]);
});

test('registration failure is reported but does not block opening', () => {
  const cadence = path.resolve('D:\\proj', 'cadence');
  const registry = path.join('C:\\Users\\d\\AppData\\Roaming', 'obsidian', 'obsidian.json');
  const { deps } = makeDeps({
    existing: [cadence],
    env: { APPDATA: 'C:\\Users\\d\\AppData\\Roaming' },
    files: { [registry]: '{"vaults":{}}' },
    writeFails: true,
  });
  const result = openObsidian(deps);
  assert.equal(result.opened, true);
  assert.equal(result.vaultRegistered, false);
  assert.equal(result.registration, 'write-failed');
});

test('a corrupt registry is left alone and reported', () => {
  const cadence = path.resolve('D:\\proj', 'cadence');
  const registry = path.join('C:\\Users\\d\\AppData\\Roaming', 'obsidian', 'obsidian.json');
  const { deps, calls } = makeDeps({
    existing: [cadence],
    env: { APPDATA: 'C:\\Users\\d\\AppData\\Roaming' },
    files: { [registry]: 'not json{' },
  });
  const result = openObsidian(deps);
  assert.equal(result.opened, true);
  assert.equal(result.vaultRegistered, false);
  assert.equal(result.registration, 'unreadable-registry');
  assert.deepEqual(calls.writes, {});
});

test('CLAUDE_PROJECT_DIR overrides cwd', () => {
  const cadence = path.resolve('/elsewhere', 'cadence');
  const { deps } = makeDeps({
    platform: 'linux',
    cwd: '/proj',
    env: { CLAUDE_PROJECT_DIR: '/elsewhere' },
    existing: [cadence],
  });
  assert.equal(openObsidian(deps).opened, true);
});
