#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

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

function parseTags(content) {
  const m = content.match(/^tags:\s*\[([^\]]*)\]/m);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((t) => t.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
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

function loadBrain(dir) {
  if (!fs.existsSync(dir)) return null;
  const notes = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    notes.push({ name: file.slice(0, -3), content, links: parseLinks(content), tags: parseTags(content) });
  }
  return notes;
}

function requireBrain(dir) {
  const notes = loadBrain(dir);
  if (notes === null) throw new Error('no cadence/brain directory in this project');
  return notes;
}

function findNote(notes, name) {
  const lower = String(name).toLowerCase();
  return notes.find((n) => n.name.toLowerCase() === lower) || null;
}

function backlinksFor(notes, name) {
  const lower = String(name).toLowerCase();
  return notes.filter((n) => n.links.some((l) => l.toLowerCase() === lower)).map((n) => n.name);
}

function searchNotes(dir, args) {
  const query = String((args && args.query) || '').toLowerCase();
  if (!query) throw new Error('query is required');
  const notes = loadBrain(dir);
  if (notes === null) return { results: [], note: 'no cadence/brain directory in this project' };
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
    if (nameHit || tagHit || matches.length > 0) {
      results.push({ name: note.name, tags: note.tags, matches });
    }
  }
  return { results };
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
  return { name: note.name, content: note.content };
}

function writeNote(dir, args) {
  const name = (args && args.name) || '';
  const content = args && args.content;
  if (!validName(name)) throw new Error('invalid name: must be a bare note name without path separators');
  if (typeof content !== 'string' || content.length === 0) throw new Error('content is required');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, name + '.md');
  const overwrote = fs.existsSync(filePath);
  fs.writeFileSync(filePath, content);
  return { written: name, path: filePath, overwrote };
}

function listBacklinks(dir, args) {
  const name = (args && args.name) || '';
  if (!validName(name)) throw new Error('name is required (no path separators)');
  const notes = loadBrain(dir);
  if (notes === null) return { name, backlinks: [], note: 'no cadence/brain directory in this project' };
  return { name, backlinks: backlinksFor(notes, name) };
}

function getRelated(dir, args) {
  const name = (args && args.name) || '';
  if (!validName(name)) throw new Error('name is required (no path separators)');
  const notes = loadBrain(dir);
  if (notes === null) {
    return { name, outgoing: [], backlinks: [], sharedTags: [], note: 'no cadence/brain directory in this project' };
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
  if (notes === null) return { orphans: [], note: 'no cadence/brain directory in this project' };
  const orphans = notes
    .filter((note) => {
      const resolvedOut = note.links.filter((l) => findNote(notes, l));
      return resolvedOut.length === 0 && backlinksFor(notes, note.name).length === 0;
    })
    .map((n) => n.name);
  return { orphans };
}

function listUnresolvedLinks(dir) {
  const notes = loadBrain(dir);
  if (notes === null) return { unresolved: [], note: 'no cadence/brain directory in this project' };
  const byTarget = new Map();
  for (const note of notes) {
    for (const link of note.links) {
      if (findNote(notes, link)) continue;
      const key = link.toLowerCase();
      if (!byTarget.has(key)) byTarget.set(key, { target: link, sources: [] });
      const entry = byTarget.get(key);
      if (!entry.sources.includes(note.name)) entry.sources.push(note.name);
    }
  }
  return { unresolved: [...byTarget.values()] };
}

function listTags(dir) {
  const notes = loadBrain(dir);
  if (notes === null) return { tags: [], note: 'no cadence/brain directory in this project' };
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
      'Search cadence/brain/ notes by name, tag, and content (case-insensitive substring). Returns matching notes with up to 5 matching lines each. Use this before starting new work to find prior knowledge.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Substring to search for' } }, required: ['query'] },
    handler: searchNotes,
  },
  {
    name: 'read_note',
    description: 'Read the full raw content of one brain note by name (case-insensitive, no .md extension).',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Note name without extension' } }, required: ['name'] },
    handler: readNote,
  },
  {
    name: 'write_note',
    description:
      'Create or overwrite a brain note. Follow the cadence-brain note format (frontmatter with type/tags/created/updated/related/sources, then a # Title). Read the existing note first when overwriting — this replaces the whole file. Intended for the brain-curator agent.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Note name without extension' },
        content: { type: 'string', description: 'Full markdown content including frontmatter' },
      },
      required: ['name', 'content'],
    },
    handler: writeNote,
  },
  {
    name: 'list_backlinks',
    description: 'List notes that link to the given name via [[wikilinks]]. Works for targets with no note file too (e.g. ticket ids like C-12).',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Link target' } }, required: ['name'] },
    handler: listBacklinks,
  },
  {
    name: 'get_related',
    description: 'Full neighborhood of one note: outgoing links, backlinks, and notes sharing tags.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Note name' } }, required: ['name'] },
    handler: getRelated,
  },
  {
    name: 'list_orphans',
    description: 'List notes with no resolved outgoing links and no backlinks — candidates for linking into the graph.',
    inputSchema: { type: 'object', properties: {} },
    handler: listOrphans,
  },
  {
    name: 'list_unresolved_links',
    description: 'List every [[link target]] that has no note file, with the notes referencing it — candidates for new notes.',
    inputSchema: { type: 'object', properties: {} },
    handler: listUnresolvedLinks,
  },
  {
    name: 'list_tags',
    description:
      'Aggregate all frontmatter tags across the brain with note counts, sorted by frequency. Use before tagging a new note (reuse or nest under an existing tag instead of inventing a synonym) and to decide when a topic has enough notes (5+) to deserve a MOC.',
    inputSchema: { type: 'object', properties: {} },
    handler: listTags,
  },
];

const SERVER_INFO = { name: 'cadence-brain', version: '0.7.0' };

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

function main() {
  const dir = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), 'cadence', 'brain');
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
  parseLinks,
  parseTags,
  validName,
  loadBrain,
  searchNotes,
  readNote,
  writeNote,
  listBacklinks,
  getRelated,
  listOrphans,
  listUnresolvedLinks,
  listTags,
  handleMessage,
  TOOLS,
};
