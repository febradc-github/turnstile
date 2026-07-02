#!/usr/bin/env node
'use strict';

function platformName(platform) {
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return 'linux';
  return null;
}

module.exports = { platformName };
