#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { platformName } = require('./install-obsidian.js');

function buildUri(vaultPath) {
  return 'obsidian://open?path=' + encodeURIComponent(vaultPath);
}

// Obsidian's URI handler only resolves paths inside vaults listed in its
// global registry (obsidian.json in Obsidian's config dir) — an unregistered
// folder gets "Vault not found" even if cadence/.obsidian/ exists.
function registryCandidates(deps) {
  const platform = platformName(deps.platform);
  const home = deps.env.HOME || deps.env.USERPROFILE;
  if (platform === 'windows') {
    return deps.env.APPDATA ? [path.join(deps.env.APPDATA, 'obsidian', 'obsidian.json')] : [];
  }
  if (platform === 'macos') {
    return home ? [path.join(home, 'Library', 'Application Support', 'obsidian', 'obsidian.json')] : [];
  }
  if (platform === 'linux') {
    const candidates = [];
    if (deps.env.XDG_CONFIG_HOME) candidates.push(path.join(deps.env.XDG_CONFIG_HOME, 'obsidian', 'obsidian.json'));
    if (home) {
      candidates.push(path.join(home, '.config', 'obsidian', 'obsidian.json'));
      candidates.push(path.join(home, 'snap', 'obsidian', 'current', '.config', 'obsidian', 'obsidian.json'));
      candidates.push(path.join(home, '.var', 'app', 'md.obsidian.Obsidian', 'config', 'obsidian', 'obsidian.json'));
    }
    return candidates;
  }
  return [];
}

function ensureVaultRegistered(deps, vaultPath) {
  const candidates = registryCandidates(deps);
  if (candidates.length === 0) return { registered: false, reason: 'no-registry-location' };
  // Prefer a registry Obsidian already wrote (snap/flatpak live elsewhere);
  // fall back to creating one at the platform default.
  const registryFile = candidates.find((p) => deps.exists(p)) || candidates[0];
  let registry = { vaults: {} };
  if (deps.exists(registryFile)) {
    try {
      registry = JSON.parse(deps.readFile(registryFile));
    } catch (err) {
      return { registered: false, reason: 'unreadable-registry', message: String(err) };
    }
    if (!registry.vaults) registry.vaults = {};
  }
  const caseInsensitive = platformName(deps.platform) === 'windows';
  const norm = (p) => (caseInsensitive ? path.resolve(p).toLowerCase() : path.resolve(p));
  for (const entry of Object.values(registry.vaults)) {
    if (entry && entry.path && norm(entry.path) === norm(vaultPath)) {
      return { registered: true, reason: 'already-registered' };
    }
  }
  registry.vaults[deps.randomId()] = { path: vaultPath, ts: deps.now() };
  try {
    deps.mkdir(path.dirname(registryFile));
    deps.writeFile(registryFile, JSON.stringify(registry));
  } catch (err) {
    return { registered: false, reason: 'write-failed', message: String(err) };
  }
  return { registered: true, reason: 'added' };
}

function openObsidian(deps) {
  const projectDir = deps.env.CLAUDE_PROJECT_DIR || deps.cwd;
  const cadenceDir = path.resolve(projectDir, 'cadence');
  if (!deps.exists(cadenceDir)) return { opened: false, reason: 'no-cadence-dir' };
  const vaultConfigured = deps.exists(path.join(cadenceDir, '.obsidian'));
  const registration = ensureVaultRegistered(deps, cadenceDir);
  const uri = buildUri(cadenceDir);
  const platform = platformName(deps.platform);
  const graphHotkey = platform === 'macos' ? 'Cmd+G' : 'Ctrl+G';
  const openers = {
    windows: ['cmd', ['/c', 'start', '', uri]],
    macos: ['open', [uri]],
    linux: ['xdg-open', [uri]],
  };
  const opener = openers[platform];
  const vaultRegistered = registration.registered;
  if (!opener) {
    return {
      opened: false,
      reason: 'unsupported-platform',
      uri,
      vaultConfigured,
      vaultRegistered,
      registration: registration.reason,
      graphHotkey,
    };
  }
  const result = deps.run(opener[0], opener[1]);
  if (result.status !== 0) {
    return {
      opened: false,
      reason: 'opener-failed',
      uri,
      vaultConfigured,
      vaultRegistered,
      registration: registration.reason,
      graphHotkey,
      message: (result.stderr || result.stdout || '').trim(),
    };
  }
  return { opened: true, uri, vaultConfigured, vaultRegistered, registration: registration.reason, graphHotkey };
}

function main() {
  const deps = {
    platform: process.platform,
    env: process.env,
    cwd: process.cwd(),
    exists: (p) => fs.existsSync(p),
    readFile: (p) => fs.readFileSync(p, 'utf8'),
    writeFile: (p, content) => fs.writeFileSync(p, content),
    mkdir: (p) => fs.mkdirSync(p, { recursive: true }),
    randomId: () => crypto.randomBytes(8).toString('hex'),
    now: () => Date.now(),
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

module.exports = { buildUri, ensureVaultRegistered, openObsidian };
