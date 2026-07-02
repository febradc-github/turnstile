#!/usr/bin/env node
'use strict';

const path = require('node:path');

function platformName(platform) {
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return 'linux';
  return null;
}

function windowsInstallPath(deps) {
  const candidates = [];
  if (deps.env.LOCALAPPDATA) {
    candidates.push(path.win32.join(deps.env.LOCALAPPDATA, 'Programs', 'Obsidian', 'Obsidian.exe'));
  }
  candidates.push('C:\\Program Files\\Obsidian\\Obsidian.exe');
  return candidates.find((p) => deps.exists(p)) || null;
}

function detectInstall(deps) {
  const name = platformName(deps.platform);
  if (name === 'windows') {
    const installPath = windowsInstallPath(deps);
    return { alreadyInstalled: installPath !== null, installPath };
  }
  if (name === 'macos') {
    const appPath = '/Applications/Obsidian.app';
    if (deps.exists(appPath)) return { alreadyInstalled: true, installPath: appPath };
    return { alreadyInstalled: false, installPath: null };
  }
  if (name === 'linux') {
    if (deps.run('snap', ['list', 'obsidian']).status === 0) {
      return { alreadyInstalled: true, installPath: 'snap:obsidian' };
    }
    const flatpak = deps.run('flatpak', ['list', '--app']);
    if (flatpak.status === 0 && flatpak.stdout.includes('md.obsidian.Obsidian')) {
      return { alreadyInstalled: true, installPath: 'flatpak:md.obsidian.Obsidian' };
    }
    return { alreadyInstalled: false, installPath: null };
  }
  return { alreadyInstalled: false, installPath: null };
}

module.exports = { platformName, detectInstall };
