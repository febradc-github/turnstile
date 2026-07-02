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
  validName,
  loadBrain,
  searchNotes,
  readNote,
  writeNote,
  listBacklinks,
  getRelated,
  listOrphans,
  listUnresolvedLinks,
} = require('./brain-mcp.js');

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-fixture-'));
  const brain = path.join(root, 'cadence', 'brain');
  fs.mkdirSync(brain, { recursive: true });
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
  return { root, brain };
}

test('parseLinks handles plain, alias, and heading wikilinks, deduped', () => {
  assert.deepEqual(parseLinks('a [[x]] b [[x|alias]] c [[x#h]] d [[Y Z]]'), ['x', 'Y Z']);
});

test('parseTags reads the frontmatter tags line', () => {
  assert.deepEqual(parseTags('---\ntags: [api, auth]\n---\nbody #not-this'), ['api', 'auth']);
  assert.deepEqual(parseTags('no frontmatter'), []);
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

test('loadBrain returns null for a missing dir and parses notes otherwise', () => {
  assert.equal(loadBrain(path.join(os.tmpdir(), 'nope-' + Date.now())), null);
  const { brain } = makeFixture();
  const notes = loadBrain(brain);
  assert.deepEqual(notes.map((n) => n.name).sort(), ['api-auth', 'jwt-tokens', 'loose-note']);
  const auth = notes.find((n) => n.name === 'api-auth');
  assert.deepEqual(auth.links, ['jwt-tokens', 'C-12']);
  assert.deepEqual(auth.tags, ['api', 'auth']);
});

test('searchNotes matches names, tags, and content lines', () => {
  const { brain } = makeFixture();
  const byContent = searchNotes(brain, { query: 'everywhere' });
  assert.deepEqual(byContent.results.map((r) => r.name), ['api-auth']);
  assert.equal(byContent.results[0].matches[0].text, 'Uses [[jwt-tokens]] everywhere. Built for [[C-12]].');
  const byTag = searchNotes(brain, { query: 'estimation' });
  assert.deepEqual(byTag.results.map((r) => r.name), ['loose-note']);
  assert.deepEqual(searchNotes(brain, { query: 'zzz-nothing' }).results, []);
});

test('searchNotes on a missing brain returns empty with a note', () => {
  const result = searchNotes(path.join(os.tmpdir(), 'nope-' + Date.now()), { query: 'x' });
  assert.deepEqual(result.results, []);
  assert.match(result.note, /no cadence\/brain/);
});

test('readNote returns content case-insensitively and errors with candidates', () => {
  const { brain } = makeFixture();
  assert.match(readNote(brain, { name: 'API-Auth' }).content, /# API auth/);
  assert.throws(() => readNote(brain, { name: 'api' }), /api-auth/);
});

test('listBacklinks finds linking notes, including for nonexistent targets', () => {
  const { brain } = makeFixture();
  assert.deepEqual(listBacklinks(brain, { name: 'jwt-tokens' }).backlinks, ['api-auth']);
  assert.deepEqual(listBacklinks(brain, { name: 'C-12' }).backlinks, ['api-auth']);
  assert.deepEqual(listBacklinks(brain, { name: 'loose-note' }).backlinks, []);
});

test('getRelated returns outgoing, backlinks, and shared tags', () => {
  const { brain } = makeFixture();
  const related = getRelated(brain, { name: 'api-auth' });
  assert.deepEqual(related.outgoing, ['jwt-tokens', 'C-12']);
  assert.deepEqual(related.backlinks, ['jwt-tokens']);
  assert.deepEqual(related.sharedTags, [{ tag: 'api', notes: ['jwt-tokens'] }]);
});

test('listOrphans finds notes with no resolved links either way', () => {
  const { brain } = makeFixture();
  assert.deepEqual(listOrphans(brain, {}).orphans, ['loose-note']);
});

test('listUnresolvedLinks reports targets with no note file', () => {
  const { brain } = makeFixture();
  assert.deepEqual(listUnresolvedLinks(brain, {}).unresolved, [{ target: 'C-12', sources: ['api-auth'] }]);
});

test('writeNote creates, overwrites, and reports which it did', () => {
  const { brain } = makeFixture();
  const created = writeNote(brain, { name: 'new-note', content: '# New\n' });
  assert.equal(created.overwrote, false);
  assert.equal(fs.readFileSync(path.join(brain, 'new-note.md'), 'utf8'), '# New\n');
  const overwritten = writeNote(brain, { name: 'new-note', content: '# Newer\n' });
  assert.equal(overwritten.overwrote, true);
  assert.equal(fs.readFileSync(path.join(brain, 'new-note.md'), 'utf8'), '# Newer\n');
});

test('writeNote creates the brain dir when missing and rejects bad names', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-empty-'));
  const brain = path.join(root, 'cadence', 'brain');
  writeNote(brain, { name: 'first', content: 'x' });
  assert.ok(fs.existsSync(path.join(brain, 'first.md')));
  assert.throws(() => writeNote(brain, { name: '../evil', content: 'x' }), /name/);
  assert.throws(() => writeNote(brain, { name: 'ok' }), /content/);
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
  assert.deepEqual(toolNames, ['get_related', 'list_backlinks', 'list_orphans', 'list_unresolved_links', 'read_note', 'search_notes', 'write_note']);
  assert.ok(responses[1].result.tools.every((t) => t.description && t.inputSchema));

  assert.equal(responses[2].id, 3);
  assert.equal(responses[2].result.isError, undefined);
  const payload = JSON.parse(responses[2].result.content[0].text);
  assert.deepEqual(payload.results.map((r) => r.name).sort(), ['api-auth', 'jwt-tokens']);
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
