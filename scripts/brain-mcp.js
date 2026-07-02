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
};
