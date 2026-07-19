#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

// Folders the brain-curator owns and hand-edit tracking watches. The rest of
// the vault (epics/, user-stories/, tasks/, designs/, specs/, plans/) is
// written by gated skills and indexed read-only.
const KNOWLEDGE_DIRS = ['brain', 'decisions', 'architecture', 'code'];

function parseLinks(content) {
  const links = [];
  const re = /\[\[([^\]|#]+)/g;
  let m;
  while ((m = re.exec(content))) {
    const target = m[1].trim();
    if (target && !links.includes(target)) links.push(target);
  }
  return links;
}

function parseBracketList(content, key) {
  const m = content.match(new RegExp('^' + key + ':\\s*\\[([^\\]]*)\\]', 'm'));
  if (!m) return [];
  return m[1]
    .split(',')
    .map((t) => t.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function parseTags(content) {
  return parseBracketList(content, 'tags');
}

function parseAliases(content) {
  return parseBracketList(content, 'aliases');
}

function validName(name) {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    !name.includes('/') &&
    !name.includes('\\') &&
    !name.includes('..') &&
    !name.startsWith('.')
  );
}

// Recursively collect .md files under dir, skipping dot-entries (.obsidian,
// .trash). Returns [{ relPath, absPath }] with forward-slash relPaths, sorted.
function walkMarkdown(dir, prefix = '') {
  const found = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkMarkdown(abs, prefix + entry.name + '/'));
    } else if (entry.name.endsWith('.md')) {
      found.push({ relPath: prefix + entry.name, absPath: abs });
    }
  }
  return found;
}

// dir is the vault root (<project>/turnstile). Indexes every markdown note in
// the vault. Note names are basenames (Obsidian-style, unique by convention).
function loadBrain(dir) {
  if (!fs.existsSync(dir)) return null;
  const notes = [];
  for (const { relPath, absPath } of walkMarkdown(dir)) {
    const content = fs.readFileSync(absPath, 'utf8');
    const folder = relPath.includes('/') ? relPath.slice(0, relPath.indexOf('/')) : '';
    notes.push({
      name: path.basename(relPath, '.md'),
      folder,
      relPath,
      content,
      links: parseLinks(content),
      tags: parseTags(content),
      aliases: parseAliases(content),
    });
  }
  return notes;
}

function requireBrain(dir) {
  const notes = loadBrain(dir);
  if (notes === null) throw new Error('no turnstile/ directory in this project');
  return notes;
}

// Matches by note name or frontmatter alias (both case-insensitive). For
// convenience lookups (read_note, get_related) only -- Obsidian does NOT
// resolve a raw [[link]] via aliases, so link-resolution checks must use
// resolvesByName instead.
function findNote(notes, name) {
  const lower = String(name).toLowerCase();
  return (
    notes.find((n) => n.name.toLowerCase() === lower) ||
    notes.find((n) => n.aliases.some((a) => a.toLowerCase() === lower)) ||
    null
  );
}

// Obsidian's actual wikilink resolution: exact filename only. Aliases feed
// the autocomplete UI but never resolve a typed [[target]].
function resolvesByName(notes, target) {
  const lower = String(target).toLowerCase();
  return notes.find((n) => n.name.toLowerCase() === lower) || null;
}

function backlinksFor(notes, name) {
  const target = findNote(notes, name);
  const matches = new Set([String(name).toLowerCase()]);
  if (target) {
    matches.add(target.name.toLowerCase());
    target.aliases.forEach((a) => matches.add(a.toLowerCase()));
  }
  return notes
    .filter((n) => n !== target && n.links.some((l) => matches.has(l.toLowerCase())))
    .map((n) => n.name);
}

function searchNotes(dir, args) {
  const query = String((args && args.query) || '').toLowerCase();
  if (!query) throw new Error('query is required');
  const rawLimit = args && args.limit;
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
  const notes = loadBrain(dir);
  if (notes === null) return { results: [], note: 'no turnstile/ directory in this project' };
  const results = [];
  for (const note of notes) {
    const matches = [];
    note.content.split(/\r?\n/).forEach((text, i) => {
      if (matches.length < 5 && text.toLowerCase().includes(query)) {
        matches.push({ line: i + 1, text: text.trim() });
      }
    });
    const nameHit = note.name.toLowerCase().includes(query);
    const tagHit = note.tags.some((t) => t.toLowerCase().includes(query));
    const aliasHit = note.aliases.some((a) => a.toLowerCase().includes(query));
    if (nameHit || tagHit || aliasHit || matches.length > 0) {
      results.push({ name: note.name, folder: note.folder, tags: note.tags, matches });
    }
  }
  if (results.length > limit) {
    return { results: results.slice(0, limit), total: results.length, truncated: true };
  }
  return { results, total: results.length };
}

function readNote(dir, args) {
  const name = (args && args.name) || '';
  const notes = requireBrain(dir);
  const note = findNote(notes, name);
  if (!note) {
    const candidates = notes
      .filter((n) => n.name.toLowerCase().includes(String(name).toLowerCase()))
      .map((n) => n.name);
    throw new Error(
      `no note named "${name}"` + (candidates.length ? `; close matches: ${candidates.join(', ')}` : '')
    );
  }
  return { name: note.name, folder: note.folder, content: note.content };
}

function writeNote(dir, args) {
  const name = (args && args.name) || '';
  const content = args && args.content;
  const folder = (args && args.folder) || 'brain';
  if (!validName(name)) throw new Error('invalid name: must be a bare note name without path separators');
  if (typeof content !== 'string' || content.length === 0) throw new Error('content is required');
  if (!KNOWLEDGE_DIRS.includes(folder)) {
    throw new Error(`invalid folder "${folder}" (allowed: ${KNOWLEDGE_DIRS.join(', ')})`);
  }
  const existing = loadBrain(dir) || [];
  const match = existing.find((n) => n.name.toLowerCase() === name.toLowerCase());
  let targetFolder = folder;
  if (match) {
    if (!KNOWLEDGE_DIRS.includes(match.folder)) {
      throw new Error(
        `"${name}" already exists at ${match.relPath}, which is not curator-owned; note names must be unique across the vault`
      );
    }
    targetFolder = match.folder; // overwrite in place, ignore the folder arg
  }
  const targetDir = path.join(dir, targetFolder);
  fs.mkdirSync(targetDir, { recursive: true });
  const filePath = path.join(targetDir, name + '.md');
  const overwrote = fs.existsSync(filePath);
  fs.writeFileSync(filePath, content);
  const state = readState(dir);
  if (state) {
    state.notes[`${targetFolder}/${name}`] = fs.statSync(filePath).mtimeMs;
    fs.writeFileSync(stateFilePath(dir), JSON.stringify(state, null, 2) + '\n');
  }
  return { written: name, folder: targetFolder, path: filePath, overwrote };
}

function listBacklinks(dir, args) {
  const name = (args && args.name) || '';
  if (!validName(name)) throw new Error('name is required (no path separators)');
  const notes = loadBrain(dir);
  if (notes === null) return { name, backlinks: [], note: 'no turnstile/ directory in this project' };
  return { name, backlinks: backlinksFor(notes, name) };
}

function getRelated(dir, args) {
  const name = (args && args.name) || '';
  if (!validName(name)) throw new Error('name is required (no path separators)');
  const notes = loadBrain(dir);
  if (notes === null) {
    return { name, outgoing: [], backlinks: [], sharedTags: [], note: 'no turnstile/ directory in this project' };
  }
  const note = findNote(notes, name);
  const sharedTags = [];
  if (note) {
    for (const tag of note.tags) {
      const others = notes
        .filter((n) => n !== note && n.tags.some((t) => t.toLowerCase() === tag.toLowerCase()))
        .map((n) => n.name);
      if (others.length) sharedTags.push({ tag, notes: others });
    }
  }
  return {
    name: note ? note.name : name,
    outgoing: note ? note.links : [],
    backlinks: backlinksFor(notes, name),
    sharedTags,
  };
}

function listOrphans(dir) {
  const notes = loadBrain(dir);
  if (notes === null) return { orphans: [], note: 'no turnstile/ directory in this project' };
  const orphans = notes
    .filter((note) => {
      const resolvedOut = note.links.filter((l) => resolvesByName(notes, l));
      return resolvedOut.length === 0 && backlinksFor(notes, note.name).length === 0;
    })
    .map((n) => n.name);
  return { orphans };
}

function listUnresolvedLinks(dir) {
  const notes = loadBrain(dir);
  if (notes === null) return { unresolved: [], note: 'no turnstile/ directory in this project' };
  return { unresolved: unresolvedFrom(notes) };
}

function unresolvedFrom(notes) {
  const byTarget = new Map();
  for (const note of notes) {
    for (const link of note.links) {
      if (resolvesByName(notes, link)) continue;
      const key = link.toLowerCase();
      if (!byTarget.has(key)) byTarget.set(key, { target: link, sources: [] });
      const entry = byTarget.get(key);
      if (!entry.sources.includes(note.name)) entry.sources.push(note.name);
    }
  }
  return [...byTarget.values()];
}

function stateFilePath(dir) {
  return path.join(dir, '.brain-state.json');
}

// Snapshot only the curator-owned knowledge dirs. Workflow notes (item notes,
// designs, specs) are written by gated skills mid-session; tracking them would
// flag every legitimate skill write as a hand-edit.
function snapshotBrain(dir) {
  if (!fs.existsSync(dir)) return null;
  const notes = {};
  for (const sub of KNOWLEDGE_DIRS) {
    const subDir = path.join(dir, sub);
    if (!fs.existsSync(subDir)) continue;
    for (const { relPath, absPath } of walkMarkdown(subDir)) {
      notes[`${sub}/${relPath.slice(0, -3)}`] = fs.statSync(absPath).mtimeMs;
    }
  }
  return notes;
}

function readState(dir) {
  try {
    const state = JSON.parse(fs.readFileSync(stateFilePath(dir), 'utf8'));
    if (!state || typeof state.notes !== 'object' || state.notes === null) return null;
    // Migrate pre-0.10 baselines keyed by bare name (brain/ was the only dir).
    const migrated = {};
    for (const [key, mtime] of Object.entries(state.notes)) {
      migrated[key.includes('/') ? key : `brain/${key}`] = mtime;
    }
    state.notes = migrated;
    return state;
  } catch {
    return null;
  }
}

function writeState(dir, notes) {
  fs.writeFileSync(
    stateFilePath(dir),
    JSON.stringify({ notes, updatedAt: new Date().toISOString() }, null, 2) + '\n'
  );
}

function diffBrainState(current, stateNotes) {
  const changed = [];
  for (const [name, mtime] of Object.entries(current)) {
    if (!(name in stateNotes)) changed.push({ name, status: 'added' });
    else if (stateNotes[name] !== mtime) changed.push({ name, status: 'modified' });
  }
  for (const name of Object.keys(stateNotes)) {
    if (!(name in current)) changed.push({ name, status: 'deleted' });
  }
  return changed;
}

function listChangedNotes(dir, args) {
  const acknowledge = !!(args && args.acknowledge);
  const current = snapshotBrain(dir);
  if (current === null) {
    return { tracked: false, changed: [], acknowledged: false, note: 'no turnstile/ directory in this project' };
  }
  const state = readState(dir);
  if (!state) {
    if (acknowledge) {
      writeState(dir, current);
      return { tracked: true, changed: [], acknowledged: true, note: 'baseline created' };
    }
    return { tracked: false, changed: [], acknowledged: false, note: 'no baseline yet; call with acknowledge: true to start tracking' };
  }
  const changed = diffBrainState(current, state.notes);
  if (acknowledge) writeState(dir, current);
  return { tracked: true, changed, acknowledged: acknowledge };
}

// Stray notes hijack wikilinks: Obsidian resolves an exact filename before an
// alias, so an auto-created empty C-2.md (from clicking an unresolved-looking
// link) captures every [[C-2]] that should resolve to the real item note.
// Two signals: any note at the vault root (turnstile never writes one), and any
// note whose filename equals another note's alias.
function listStrayNotes(dir) {
  const notes = loadBrain(dir);
  if (notes === null) return { strays: [], note: 'no turnstile/ directory in this project' };
  return { strays: straysFrom(notes) };
}

function straysFrom(notes) {
  const strays = [];
  for (const note of notes) {
    const reasons = [];
    if (note.folder === '') reasons.push('vault-root');
    const shadowed = notes.find(
      (n) => n !== note && n.aliases.some((a) => a.toLowerCase() === note.name.toLowerCase())
    );
    if (shadowed) reasons.push('alias-shadow');
    const twin = notes.find((n) => n !== note && n.name.toLowerCase() === note.name.toLowerCase());
    if (twin) reasons.push('name-collision');
    if (reasons.length) {
      strays.push({
        name: note.name,
        relPath: note.relPath,
        empty: note.content.trim().length === 0,
        reasons,
        shadows: shadowed ? shadowed.name : null,
        collidesWith: twin ? twin.relPath : null,
      });
    }
  }
  return strays;
}

// One vault load for everything the every-prompt reminder needs: strays,
// unresolved links, and the hand-edit diff. Returns null when no vault exists.
function vaultAlerts(dir) {
  const notes = loadBrain(dir);
  if (notes === null) return null;
  let changed = [];
  const current = snapshotBrain(dir);
  const state = current && readState(dir);
  if (current && state) changed = diffBrainState(current, state.notes);
  return { strays: straysFrom(notes), unresolved: unresolvedFrom(notes), changed };
}

function listTags(dir) {
  const notes = loadBrain(dir);
  if (notes === null) return { tags: [], note: 'no turnstile/ directory in this project' };
  const byTag = new Map();
  for (const note of notes) {
    for (const tag of note.tags) {
      const key = tag.toLowerCase();
      if (!byTag.has(key)) byTag.set(key, { tag, count: 0, notes: [] });
      const entry = byTag.get(key);
      entry.count += 1;
      entry.notes.push(note.name);
    }
  }
  const tags = [...byTag.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  return { tags };
}

const TOOLS = [
  {
    name: 'search_notes',
    description:
      'Search every turnstile/ vault note by name, alias, tag, and content (case-insensitive substring). Returns up to `limit` notes (default 20) with matching lines.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Substring' },
        limit: { type: 'integer', description: 'Max notes (default 20, max 100)' },
      },
      required: ['query'],
    },
    handler: searchNotes,
  },
  {
    name: 'read_note',
    description:
      'Read one vault note by name or alias (case-insensitive, no .md extension); board ids resolve via alias.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Name or alias, no extension' } }, required: ['name'] },
    handler: readNote,
  },
  {
    name: 'write_note',
    description:
      'Create or overwrite a knowledge note in brain/ (default), decisions/, architecture/, or code/. Replaces the whole file — read an existing note first; an existing note stays in its own folder. Brain-curator only.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name, no extension' },
        content: { type: 'string', description: 'Full markdown incl. frontmatter' },
        folder: { type: 'string', description: 'brain (default), decisions, architecture, or code' },
      },
      required: ['name', 'content'],
    },
    handler: writeNote,
  },
  {
    name: 'list_backlinks',
    description: 'Notes linking to the given name via [[wikilinks]], alias-aware; works for missing targets.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Link target' } }, required: ['name'] },
    handler: listBacklinks,
  },
  {
    name: 'get_related',
    description: 'Neighborhood of one note: outgoing links, backlinks, notes sharing tags.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Name or alias' } }, required: ['name'] },
    handler: getRelated,
  },
  {
    name: 'list_orphans',
    description: 'Notes with no resolved outgoing links and no backlinks.',
    inputSchema: { type: 'object', properties: {} },
    handler: listOrphans,
  },
  {
    name: 'list_unresolved_links',
    description:
      'Every [[link target]] with no note file of that exact name (aliases never resolve raw links), with referencing notes.',
    inputSchema: { type: 'object', properties: {} },
    handler: listUnresolvedLinks,
  },
  {
    name: 'list_tags',
    description: 'All frontmatter tags with counts, by frequency. Check before tagging a new note.',
    inputSchema: { type: 'object', properties: {} },
    handler: listTags,
  },
  {
    name: 'list_stray_notes',
    description:
      'Notes breaking wikilink resolution: vault-root files, duplicate basenames, or files named like another note\'s alias.',
    inputSchema: { type: 'object', properties: {} },
    handler: listStrayNotes,
  },
  {
    name: 'list_changed_notes',
    description:
      'Knowledge notes changed outside turnstile since the last acknowledged sync (hand-edits are ground truth). Pass acknowledge: true after reconciling; the first acknowledge creates the baseline.',
    inputSchema: {
      type: 'object',
      properties: {
        acknowledge: { type: 'boolean', description: 'Snapshot current state as baseline' },
      },
    },
    handler: listChangedNotes,
  },
];

function pluginVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}

const SERVER_INFO = { name: 'turnstile-brain', version: pluginVersion() };

function handleMessage(msg, dir) {
  const hasId = msg.id !== undefined && msg.id !== null;
  const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
  if (msg.method === 'initialize') {
    const requested = (msg.params && msg.params.protocolVersion) || '2025-06-18';
    return reply({ protocolVersion: requested, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
  }
  if (msg.method === 'ping') return reply({});
  if (msg.method === 'tools/list') {
    return reply({ tools: TOOLS.map(({ handler, ...tool }) => tool) });
  }
  if (msg.method === 'tools/call') {
    const params = msg.params || {};
    const tool = TOOLS.find((t) => t.name === params.name);
    if (!tool) return reply({ content: [{ type: 'text', text: `unknown tool: ${params.name}` }], isError: true });
    try {
      const result = tool.handler(dir, params.arguments || {});
      return reply({ content: [{ type: 'text', text: JSON.stringify(result) }] });
    } catch (err) {
      return reply({ content: [{ type: 'text', text: String((err && err.message) || err) }], isError: true });
    }
  }
  if (hasId) return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `method not found: ${msg.method}` } };
  return null;
}

// Resolves the vault root (<project>/turnstile). Claude Code provides
// CLAUDE_PROJECT_DIR; kimi-code spawns plugin MCP servers from the plugin
// root with no project env var and no roots support, so fall back to the
// hint file the remind hook writes on every prompt in a turnstile project.
function vaultDir() {
  if (process.env.CLAUDE_PROJECT_DIR) return path.join(process.env.CLAUDE_PROJECT_DIR, 'turnstile');
  const fromCwd = path.join(process.cwd(), 'turnstile');
  if (fs.existsSync(fromCwd)) return fromCwd;
  if (process.env.KIMI_PLUGIN_ROOT) {
    try {
      const hint = JSON.parse(fs.readFileSync(path.join(process.env.KIMI_PLUGIN_ROOT, '.turnstile-project.json'), 'utf8'));
      if (hint && typeof hint.projectDir === 'string' && hint.projectDir) {
        return path.join(hint.projectDir, 'turnstile');
      }
    } catch {
      // no usable hint yet (the hook has not run): fall through to cwd
    }
  }
  return fromCwd;
}

function main() {
  const dir = vaultDir();
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return; // never crash on bad input
    }
    const response = handleMessage(msg, dir);
    if (response) process.stdout.write(JSON.stringify(response) + '\n');
  });
}

if (require.main === module) main();

module.exports = {
  main,
  KNOWLEDGE_DIRS,
  parseLinks,
  parseTags,
  parseAliases,
  validName,
  loadBrain,
  searchNotes,
  readNote,
  writeNote,
  listBacklinks,
  getRelated,
  listOrphans,
  listUnresolvedLinks,
  listStrayNotes,
  listTags,
  snapshotBrain,
  readState,
  diffBrainState,
  listChangedNotes,
  vaultAlerts,
  handleMessage,
  TOOLS,
};
