const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');

const SCRIPT_PATH = path.join(__dirname, 'brain-mcp.js');
const {
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
  listChangedNotes,
} = require('./brain-mcp.js');

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-fixture-'));
  const vault = path.join(root, 'cadence');
  const brain = path.join(vault, 'brain');
  const decisions = path.join(vault, 'decisions');
  const epics = path.join(vault, 'epics');
  fs.mkdirSync(brain, { recursive: true });
  fs.mkdirSync(decisions, { recursive: true });
  fs.mkdirSync(epics, { recursive: true });
  fs.mkdirSync(path.join(vault, '.obsidian'), { recursive: true }); // must be skipped
  fs.writeFileSync(path.join(vault, '.obsidian', 'ignored.md'), '# never indexed\n');
  fs.writeFileSync(
    path.join(brain, 'api-auth.md'),
    '---\ntype: domain\ntags: [api, auth]\ncreated: 2026-07-01\nupdated: 2026-07-01\nrelated: ["[[jwt-tokens]]"]\nsources: []\n---\n\n# API auth\n\nUses [[jwt-tokens]] everywhere. Built for [[C-12]].\n'
  );
  fs.writeFileSync(
    path.join(brain, 'jwt-tokens.md'),
    '---\ntype: domain\ntags: [api]\ncreated: 2026-07-01\nupdated: 2026-07-01\nrelated: ["[[api-auth]]"]\nsources: []\n---\n\n# JWT tokens\n\nSee also: [[api-auth|the auth note]] and [[api-auth#Rotation]].\n'
  );
  fs.writeFileSync(
    path.join(brain, 'loose-note.md'),
    '---\ntype: process\ntags: [estimation]\ncreated: 2026-07-02\nupdated: 2026-07-02\nrelated: []\nsources: []\n---\n\n# Loose note\n\nNo links here.\n'
  );
  fs.writeFileSync(
    path.join(decisions, 'adr-001-use-jwt.md'),
    '---\ntype: decision\ntags: [api]\naliases: []\ncreated: 2026-07-03\nupdated: 2026-07-03\nrelated: []\nsources: []\n---\n\n# ADR-001: Use JWT\n\nApplies to [[C-12]]. See [[jwt-tokens]].\n'
  );
  fs.writeFileSync(
    path.join(epics, 'C-12-payment-flow.md'),
    '---\ntype: epic\ntags: [payments]\naliases: ["C-12"]\ncreated: 2026-07-03\nupdated: 2026-07-03\nrelated: []\n---\n\n# C-12: Payment flow\n\nDecided in [[adr-001-use-jwt]].\n'
  );
  return { root, vault, brain, decisions, epics };
}

test('parseLinks handles plain, alias, and heading wikilinks, deduped', () => {
  assert.deepEqual(parseLinks('a [[x]] b [[x|alias]] c [[x#h]] d [[Y Z]]'), ['x', 'Y Z']);
});

test('parseTags and parseAliases read their frontmatter lines', () => {
  assert.deepEqual(parseTags('---\ntags: [api, auth]\n---\nbody #not-this'), ['api', 'auth']);
  assert.deepEqual(parseTags('no frontmatter'), []);
  assert.deepEqual(parseAliases('---\naliases: ["C-12", other]\n---\n'), ['C-12', 'other']);
  assert.deepEqual(parseAliases('no frontmatter'), []);
});

test('validName rejects path separators, dots, traversal', () => {
  assert.equal(validName('api-auth'), true);
  assert.equal(validName('C-12'), true);
  assert.equal(validName('a/b'), false);
  assert.equal(validName('a\\b'), false);
  assert.equal(validName('..'), false);
  assert.equal(validName('.hidden'), false);
  assert.equal(validName(''), false);
});

test('loadBrain returns null for a missing dir and indexes the whole vault otherwise', () => {
  assert.equal(loadBrain(path.join(os.tmpdir(), 'nope-' + Date.now())), null);
  const { vault } = makeFixture();
  const notes = loadBrain(vault);
  assert.deepEqual(
    notes.map((n) => n.name).sort(),
    ['C-12-payment-flow', 'adr-001-use-jwt', 'api-auth', 'jwt-tokens', 'loose-note']
  );
  const auth = notes.find((n) => n.name === 'api-auth');
  assert.deepEqual(auth.links, ['jwt-tokens', 'C-12']);
  assert.deepEqual(auth.tags, ['api', 'auth']);
  assert.equal(auth.folder, 'brain');
  const epic = notes.find((n) => n.name === 'C-12-payment-flow');
  assert.equal(epic.folder, 'epics');
  assert.deepEqual(epic.aliases, ['C-12']);
});

test('searchNotes matches names, tags, and content lines across folders', () => {
  const { vault } = makeFixture();
  const byContent = searchNotes(vault, { query: 'everywhere' });
  assert.deepEqual(byContent.results.map((r) => r.name), ['api-auth']);
  assert.equal(byContent.results[0].matches[0].text, 'Uses [[jwt-tokens]] everywhere. Built for [[C-12]].');
  const byTag = searchNotes(vault, { query: 'estimation' });
  assert.deepEqual(byTag.results.map((r) => r.name), ['loose-note']);
  const inDecisions = searchNotes(vault, { query: 'adr-001' });
  // The ADR itself plus the epic whose body links to it.
  assert.deepEqual(inDecisions.results.map((r) => r.folder), ['decisions', 'epics']);
  const byAlias = searchNotes(vault, { query: 'c-12' });
  assert.ok(byAlias.results.some((r) => r.name === 'C-12-payment-flow'));
  assert.deepEqual(searchNotes(vault, { query: 'zzz-nothing' }).results, []);
});

test('searchNotes on a missing vault returns empty with a note', () => {
  const result = searchNotes(path.join(os.tmpdir(), 'nope-' + Date.now()), { query: 'x' });
  assert.deepEqual(result.results, []);
  assert.match(result.note, /no cadence/);
});

test('readNote resolves names case-insensitively and aliases to item notes', () => {
  const { vault } = makeFixture();
  assert.match(readNote(vault, { name: 'API-Auth' }).content, /# API auth/);
  assert.match(readNote(vault, { name: 'C-12' }).content, /# C-12: Payment flow/);
  assert.throws(() => readNote(vault, { name: 'api' }), /api-auth/);
});

test('listBacklinks finds linking notes across folders, resolving aliases', () => {
  const { vault } = makeFixture();
  assert.deepEqual(listBacklinks(vault, { name: 'jwt-tokens' }).backlinks, ['api-auth', 'adr-001-use-jwt']);
  // [[C-12]] links land on the epic note via its alias.
  assert.deepEqual(listBacklinks(vault, { name: 'C-12' }).backlinks, ['api-auth', 'adr-001-use-jwt']);
  assert.deepEqual(listBacklinks(vault, { name: 'C-12-payment-flow' }).backlinks, ['api-auth', 'adr-001-use-jwt']);
  assert.deepEqual(listBacklinks(vault, { name: 'loose-note' }).backlinks, []);
});

test('getRelated returns outgoing, backlinks, and shared tags', () => {
  const { vault } = makeFixture();
  const related = getRelated(vault, { name: 'api-auth' });
  assert.deepEqual(related.outgoing, ['jwt-tokens', 'C-12']);
  assert.deepEqual(related.backlinks, ['jwt-tokens']);
  assert.deepEqual(related.sharedTags, [{ tag: 'api', notes: ['jwt-tokens', 'adr-001-use-jwt'] }]);
});

test('listOrphans finds notes with no resolved links either way', () => {
  const { vault } = makeFixture();
  assert.deepEqual(listOrphans(vault, {}).orphans, ['loose-note']);
});

test('listUnresolvedLinks treats alias-resolved targets as resolved', () => {
  const { vault } = makeFixture();
  // [[C-12]] resolves via the epic note's alias, so nothing is unresolved.
  assert.deepEqual(listUnresolvedLinks(vault, {}).unresolved, []);
  fs.rmSync(path.join(vault, 'epics', 'C-12-payment-flow.md'));
  assert.deepEqual(listUnresolvedLinks(vault, {}).unresolved, [
    { target: 'C-12', sources: ['api-auth', 'adr-001-use-jwt'] },
  ]);
});

test('listStrayNotes flags vault-root files and alias shadows, and nothing else', () => {
  const { vault } = makeFixture();
  assert.deepEqual(listStrayNotes(vault, {}).strays, []);

  // Obsidian's click-artifact: an empty exact-name note at the vault root
  // that captures every [[C-12]] meant for the epic's alias.
  fs.writeFileSync(path.join(vault, 'C-12.md'), '');
  // A root note with content and no alias collision: still stray (root).
  fs.writeFileSync(path.join(vault, 'scratch.md'), '# Scratch\n');

  const { strays } = listStrayNotes(vault, {});
  assert.deepEqual(strays, [
    {
      name: 'C-12',
      relPath: 'C-12.md',
      empty: true,
      reasons: ['vault-root', 'alias-shadow'],
      shadows: 'C-12-payment-flow',
    },
    { name: 'scratch', relPath: 'scratch.md', empty: false, reasons: ['vault-root'], shadows: null },
  ]);
});

test('listStrayNotes flags an alias shadow inside a folder too', () => {
  const { vault } = makeFixture();
  // e.g. a legacy flat design file named exactly like a ticket id.
  fs.writeFileSync(path.join(vault, 'decisions', 'C-12.md'), '# stale\n');
  const { strays } = listStrayNotes(vault, {});
  assert.deepEqual(strays, [
    { name: 'C-12', relPath: 'decisions/C-12.md', empty: false, reasons: ['alias-shadow'], shadows: 'C-12-payment-flow' },
  ]);
});

test('writeNote creates in brain/ by default, honors folder, overwrites in place', () => {
  const { vault } = makeFixture();
  const created = writeNote(vault, { name: 'new-note', content: '# New\n' });
  assert.equal(created.overwrote, false);
  assert.equal(created.folder, 'brain');
  assert.equal(fs.readFileSync(path.join(vault, 'brain', 'new-note.md'), 'utf8'), '# New\n');

  const adr = writeNote(vault, { name: 'adr-002-folders', content: '# ADR-002\n', folder: 'decisions' });
  assert.equal(adr.folder, 'decisions');
  assert.ok(fs.existsSync(path.join(vault, 'decisions', 'adr-002-folders.md')));

  // Overwriting an existing note stays in its own folder even without the arg.
  const overwritten = writeNote(vault, { name: 'adr-001-use-jwt', content: '# ADR-001 v2\n' });
  assert.equal(overwritten.overwrote, true);
  assert.equal(overwritten.folder, 'decisions');
  assert.equal(fs.readFileSync(path.join(vault, 'decisions', 'adr-001-use-jwt.md'), 'utf8'), '# ADR-001 v2\n');
});

test('writeNote rejects bad names, folders, and collisions with workflow notes', () => {
  const { vault } = makeFixture();
  assert.throws(() => writeNote(vault, { name: '../evil', content: 'x' }), /name/);
  assert.throws(() => writeNote(vault, { name: 'ok' }), /content/);
  assert.throws(() => writeNote(vault, { name: 'x', content: 'x', folder: 'epics' }), /invalid folder/);
  assert.throws(() => writeNote(vault, { name: 'C-12-payment-flow', content: 'x' }), /not curator-owned/);
});

test('writeNote creates the target dir when missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-empty-'));
  const vault = path.join(root, 'cadence');
  fs.mkdirSync(vault, { recursive: true });
  writeNote(vault, { name: 'first', content: 'x' });
  assert.ok(fs.existsSync(path.join(vault, 'brain', 'first.md')));
  writeNote(vault, { name: 'arch-notes', content: 'x', folder: 'architecture' });
  assert.ok(fs.existsSync(path.join(vault, 'architecture', 'arch-notes.md')));
});

function rpc(id, method, params) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
}

function collectResponses(child, count) {
  const responses = [];
  let buffer = '';
  return {
    responses,
    done: new Promise((resolve) => {
      child.stdout.on('data', (chunk) => {
        buffer += chunk;
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          responses.push(JSON.parse(buffer.slice(0, idx)));
          buffer = buffer.slice(idx + 1);
        }
        if (responses.length >= count) resolve();
      });
    }),
  };
}

test('mcp server: initialize, tools/list, tools/call over stdio', async () => {
  const { root } = makeFixture();
  const child = spawn('node', [SCRIPT_PATH], { cwd: root, env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  const { responses, done } = collectResponses(child, 3);
  child.stdin.write(rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } }));
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  child.stdin.write('this is not json\n');
  child.stdin.write(rpc(2, 'tools/list'));
  child.stdin.write(rpc(3, 'tools/call', { name: 'search_notes', arguments: { query: 'jwt' } }));
  await done;
  child.kill();

  assert.equal(responses[0].id, 1);
  assert.equal(responses[0].result.protocolVersion, '2025-06-18');
  assert.equal(responses[0].result.serverInfo.name, 'cadence-brain');
  assert.deepEqual(responses[0].result.capabilities, { tools: {} });

  assert.equal(responses[1].id, 2);
  const toolNames = responses[1].result.tools.map((t) => t.name).sort();
  assert.deepEqual(toolNames, ['get_related', 'list_backlinks', 'list_changed_notes', 'list_orphans', 'list_stray_notes', 'list_tags', 'list_unresolved_links', 'read_note', 'search_notes', 'write_note']);
  assert.ok(responses[1].result.tools.every((t) => t.description && t.inputSchema));

  assert.equal(responses[2].id, 3);
  assert.equal(responses[2].result.isError, undefined);
  const payload = JSON.parse(responses[2].result.content[0].text);
  assert.deepEqual(payload.results.map((r) => r.name).sort(), ['C-12-payment-flow', 'adr-001-use-jwt', 'api-auth', 'jwt-tokens']);
});

test('mcp server: unknown tool is a tool error, unknown method a -32601', async () => {
  const { root } = makeFixture();
  const child = spawn('node', [SCRIPT_PATH], { cwd: root, env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  const { responses, done } = collectResponses(child, 2);
  child.stdin.write(rpc(1, 'tools/call', { name: 'nope', arguments: {} }));
  child.stdin.write(rpc(2, 'no/such/method'));
  await done;
  child.kill();
  assert.equal(responses[0].result.isError, true);
  assert.equal(responses[1].error.code, -32601);
});

test('listTags aggregates frontmatter tags vault-wide sorted by count', () => {
  const { vault } = makeFixture();
  assert.deepEqual(listTags(vault, {}).tags, [
    { tag: 'api', count: 3, notes: ['api-auth', 'jwt-tokens', 'adr-001-use-jwt'] },
    { tag: 'auth', count: 1, notes: ['api-auth'] },
    { tag: 'estimation', count: 1, notes: ['loose-note'] },
    { tag: 'payments', count: 1, notes: ['C-12-payment-flow'] },
  ]);
});

test('listTags on a missing vault returns empty with a note', () => {
  const result = listTags(path.join(os.tmpdir(), 'nope-' + Date.now()), {});
  assert.deepEqual(result.tags, []);
  assert.match(result.note, /no cadence/);
});

test('listChangedNotes lifecycle: baseline, hand-edits, acknowledge', () => {
  const { vault, brain } = makeFixture();

  const untracked = listChangedNotes(vault, {});
  assert.equal(untracked.tracked, false);
  assert.match(untracked.note, /acknowledge/);

  const baseline = listChangedNotes(vault, { acknowledge: true });
  assert.equal(baseline.tracked, true);
  assert.deepEqual(baseline.changed, []);
  assert.ok(fs.existsSync(path.join(vault, '.brain-state.json')));

  const clean = listChangedNotes(vault, {});
  assert.equal(clean.tracked, true);
  assert.deepEqual(clean.changed, []);

  const edited = path.join(brain, 'api-auth.md');
  const future = new Date(Date.now() + 5000);
  fs.utimesSync(edited, future, future);
  fs.writeFileSync(path.join(brain, 'hand-made.md'), '# Hand made\n');
  fs.rmSync(path.join(brain, 'loose-note.md'));
  fs.utimesSync(path.join(vault, 'decisions', 'adr-001-use-jwt.md'), future, future);
  // Workflow notes are not tracked: editing the epic must not show up.
  fs.utimesSync(path.join(vault, 'epics', 'C-12-payment-flow.md'), future, future);

  const dirty = listChangedNotes(vault, {});
  const byName = Object.fromEntries(dirty.changed.map((c) => [c.name, c.status]));
  assert.deepEqual(byName, {
    'brain/api-auth': 'modified',
    'brain/hand-made': 'added',
    'brain/loose-note': 'deleted',
    'decisions/adr-001-use-jwt': 'modified',
  });

  const acked = listChangedNotes(vault, { acknowledge: true });
  assert.equal(acked.changed.length, 4);
  assert.deepEqual(listChangedNotes(vault, {}).changed, []);
});

test('readState migrates pre-0.10 baselines keyed by bare note name', () => {
  const { vault } = makeFixture();
  const old = {
    notes: { 'api-auth': 1, 'jwt-tokens': 2, 'loose-note': 3 },
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
  fs.writeFileSync(path.join(vault, '.brain-state.json'), JSON.stringify(old));
  const changed = listChangedNotes(vault, {}).changed;
  // Bare keys are read as brain/<name>: the three brain notes diff by mtime
  // only (modified), and the untracked decisions note appears as added --
  // no spurious added/deleted pair per brain note.
  const statuses = Object.fromEntries(changed.map((c) => [c.name, c.status]));
  assert.deepEqual(statuses, {
    'brain/api-auth': 'modified',
    'brain/jwt-tokens': 'modified',
    'brain/loose-note': 'modified',
    'decisions/adr-001-use-jwt': 'added',
  });
});

test('write_note keeps the state in sync (no self-inflicted changes)', () => {
  const { vault } = makeFixture();
  listChangedNotes(vault, { acknowledge: true });
  writeNote(vault, { name: 'from-mcp', content: '# From MCP\n' });
  writeNote(vault, { name: 'adr-009-sync', content: '# ADR-009\n', folder: 'decisions' });
  assert.deepEqual(listChangedNotes(vault, {}).changed, []);
});

test('listChangedNotes survives a corrupt state file', () => {
  const { vault } = makeFixture();
  fs.writeFileSync(path.join(vault, '.brain-state.json'), 'not json');
  const result = listChangedNotes(vault, {});
  assert.equal(result.tracked, false);
});
