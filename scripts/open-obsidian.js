#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { platformName } = require('./install-obsidian.js');

function buildUri(vaultPath) {
  return 'obsidian://open?path=' + encodeURIComponent(vaultPath);
}

function openObsidian(deps) {
  const projectDir = deps.env.CLAUDE_PROJECT_DIR || deps.cwd;
  const cadenceDir = path.resolve(projectDir, 'cadence');
  if (!deps.exists(cadenceDir)) return { opened: false, reason: 'no-cadence-dir' };
  const vaultConfigured = deps.exists(path.join(cadenceDir, '.obsidian'));
  const uri = buildUri(cadenceDir);
  const platform = platformName(deps.platform);
  const graphHotkey = platform === 'macos' ? 'Cmd+G' : 'Ctrl+G';
  const openers = {
    windows: ['cmd', ['/c', 'start', '', uri]],
    macos: ['open', [uri]],
    linux: ['xdg-open', [uri]],
  };
  const opener = openers[platform];
  if (!opener) return { opened: false, reason: 'unsupported-platform', uri, vaultConfigured, graphHotkey };
  const result = deps.run(opener[0], opener[1]);
  if (result.status !== 0) {
    return {
      opened: false,
      reason: 'opener-failed',
      uri,
      vaultConfigured,
      graphHotkey,
      message: (result.stderr || result.stdout || '').trim(),
    };
  }
  return { opened: true, uri, vaultConfigured, graphHotkey };
}

function main() {
  const deps = {
    platform: process.platform,
    env: process.env,
    cwd: process.cwd(),
    exists: (p) => fs.existsSync(p),
    run: (cmd, args) => {
      const r = spawnSync(cmd, args, { encoding: 'utf8' });
      return {
        status: r.status === null ? 1 : r.status,
        stdout: r.stdout || '',
        stderr: r.stderr || (r.error ? String(r.error) : ''),
      };
    },
  };
  process.stdout.write(JSON.stringify(openObsidian(deps)) + '\n');
}

if (require.main === module) main();

module.exports = { buildUri, openObsidian };
