#!/usr/bin/env node
'use strict';
// Reader for turnstile/config.yml -- the per-project settings file. Flat
// key: value pairs only, parsed structurally without a YAML dependency (same
// convention as validate-board.js). Resilient by design: a missing file means
// defaults, unknown keys are ignored, invalid values fall back to their
// default. Every deviation is returned as a warning so the skill that read
// the config can surface it once -- loadConfig itself never throws and never
// prints.
//
// Settings:
//   profile: solo | full            -- solo collapses design+spec into one
//                                      plan artifact (PL-<n>.md); switching
//                                      mid-project is safe: review falls back
//                                      SP-<n> -> PL-<n> per ticket, so mixed
//                                      artifacts coexist.
//   cadence: sprint | flow          -- flow replaces sprint ceremony with a
//                                      pull queue; switch only with no active
//                                      sprint (archive it first).
//   capture: gates | opportunistic  -- when brain-curator is dispatched.
//   quick_max_points: <int >= 1>    -- the /turnstile:quick ceiling.

const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = Object.freeze({
  profile: 'full',
  cadence: 'sprint',
  capture: 'gates',
  quick_max_points: 3,
});

const ENUMS = {
  profile: ['solo', 'full'],
  cadence: ['sprint', 'flow'],
  capture: ['gates', 'opportunistic'],
};

// Returns { config, warnings }. config always has every key of DEFAULTS.
function loadConfig(turnstileDir) {
  const config = { ...DEFAULTS };
  const warnings = [];
  let raw;
  try {
    raw = fs.readFileSync(path.join(turnstileDir, 'config.yml'), 'utf8');
  } catch {
    return { config, warnings }; // no config file: defaults, silently
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!m) continue; // blank lines, comments, malformed lines: skipped
    const key = m[1];
    const value = m[2].replace(/#.*$/, '').trim().replace(/^["']|["']$/g, '');
    if (!(key in DEFAULTS)) {
      warnings.push(`config.yml: unknown key "${key}" ignored`);
      continue;
    }
    if (key === 'quick_max_points') {
      if (/^\d+$/.test(value) && parseInt(value, 10) >= 1) {
        config[key] = parseInt(value, 10);
      } else {
        warnings.push(
          `config.yml: quick_max_points "${value}" is not a positive integer; using ${DEFAULTS[key]}`
        );
      }
      continue;
    }
    if (ENUMS[key].includes(value)) {
      config[key] = value;
    } else {
      warnings.push(
        `config.yml: ${key} "${value}" is invalid (allowed: ${ENUMS[key].join(', ')}); using ${DEFAULTS[key]}`
      );
    }
  }
  return { config, warnings };
}

module.exports = { loadConfig, DEFAULTS };

// CLI for skills: node scripts/config.js [turnstileDir] prints one JSON line
// {config, warnings}. turnstileDir defaults to ./turnstile under the cwd.
if (require.main === module) {
  const dir = process.argv[2] || path.join(process.cwd(), 'turnstile');
  process.stdout.write(JSON.stringify(loadConfig(dir)) + '\n');
}
