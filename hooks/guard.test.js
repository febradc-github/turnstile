const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const GUARD_PATH = path.join(__dirname, 'guard.js');

function runGuard(input) {
  return spawnSync('node', [GUARD_PATH], {
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
}

function bashCommand(command) {
  return { tool_name: 'Bash', tool_input: { command } };
}

test('allows a normal git commit', () => {
  const result = runGuard(bashCommand('git commit -m "feat: add endpoint (C-12)"'));
  assert.equal(result.status, 0);
});

test('allows non-git and non-commit commands', () => {
  assert.equal(runGuard(bashCommand('npm test')).status, 0);
  assert.equal(runGuard(bashCommand('git status')).status, 0);
});

test('allows file tools on normal paths', () => {
  assert.equal(runGuard({ tool_name: 'Write', tool_input: { file_path: 'src/index.js' } }).status, 0);
  assert.equal(runGuard({ tool_name: 'Read', tool_input: { file_path: 'docs/environment.md' } }).status, 0);
  assert.equal(runGuard({ tool_name: 'Read', tool_input: { file_path: '.venv/pyvenv.cfg' } }).status, 0);
  assert.equal(runGuard({ tool_name: 'Grep', tool_input: { pattern: 'process\\.env', path: 'src' } }).status, 0);
});

test('blocks reading env files in every spelling', () => {
  for (const file_path of ['.env', 'app/.env.local', 'C:\\proj\\.env.production', 'config/prod.env', '.envrc']) {
    const result = runGuard({ tool_name: 'Read', tool_input: { file_path } });
    assert.equal(result.status, 2, `expected block for ${file_path}`);
    assert.match(result.stderr, /env files/);
  }
});

test('blocks writing, editing, searching, and globbing env files', () => {
  assert.equal(runGuard({ tool_name: 'Write', tool_input: { file_path: '.env' } }).status, 2);
  assert.equal(runGuard({ tool_name: 'Edit', tool_input: { file_path: 'api/.env.test' } }).status, 2);
  assert.equal(runGuard({ tool_name: 'Grep', tool_input: { pattern: 'KEY', path: '.env' } }).status, 2);
  assert.equal(runGuard({ tool_name: 'Grep', tool_input: { pattern: 'KEY', glob: '**/.env*' } }).status, 2);
  assert.equal(runGuard({ tool_name: 'Glob', tool_input: { pattern: '**/*.env' } }).status, 2);
});

test('blocks shell commands that reference env files', () => {
  for (const command of ['cat .env', 'type ..\\.env.local', 'cp .env /tmp/x', 'grep KEY app/.env', 'Get-Content .env.production', 'cat .env*']) {
    const result = runGuard({ tool_name: 'Bash', tool_input: { command } });
    assert.equal(result.status, 2, `expected block for: ${command}`);
    assert.match(result.stderr, /env files/);
  }
});

test('allows shell commands that merely mention the environment', () => {
  assert.equal(runGuard(bashCommand('node --test scripts/env-check.test.js')).status, 0);
  assert.equal(runGuard(bashCommand('echo $NODE_ENV')).status, 0);
  assert.equal(runGuard(bashCommand('source .venv/bin/activate')).status, 0);
});

test('blocks violations coming through the PowerShell tool too', () => {
  const result = runGuard({
    tool_name: 'PowerShell',
    tool_input: { command: 'git commit --no-verify -m "fix: x (C-1)"' },
  });
  assert.equal(result.status, 2);
});

test('blocks git commit --no-verify', () => {
  const result = runGuard(bashCommand('git commit --no-verify -m "fix: x (C-1)"'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--no-verify/);
});

test('blocks Claude co-author trailers', () => {
  const result = runGuard(
    bashCommand('git commit -m "fix: x (C-1)\n\nCo-Authored-By: Claude <noreply@anthropic.com>"')
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /attribution/);
});

test('blocks anthropic noreply addresses regardless of trailer wording', () => {
  const result = runGuard(bashCommand('git commit -m "x" --author="Bot <noreply@anthropic.com>"'));
  assert.equal(result.status, 2);
});

test('never blocks on unparseable input', () => {
  const result = spawnSync('node', [GUARD_PATH], { input: 'not json', encoding: 'utf8' });
  assert.equal(result.status, 0);
});
