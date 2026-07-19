#!/usr/bin/env node
'use strict';
// Measures the context-window overhead this plugin injects into a Claude Code
// session, in characters and estimated tokens (chars/4). Run it against two
// checkouts (e.g. a git worktree of the old ref and the working tree) to get
// actual before/after numbers instead of guesses.
//
// Usage: node scripts/token-report.js [pluginRoot] [--turns N] [--json]
//
// The model of a session:
//   fixed    -- loaded once per session: every skill/command/agent frontmatter
//               description (Claude Code lists them all), plus the MCP
//               tools/list JSON from brain-mcp.js.
//   perTurn  -- the UserPromptSubmit reminder emitted before every user
//               prompt. Hook output stays in the conversation, so turn K's
//               reminder is re-sent as context in every turn after K. The
//               cumulative context cost over N turns is therefore
//               sum(k=1..N) of (emitted-by-turn-k totals) -- quadratic in the
//               per-turn size.
//   invoked  -- SKILL.md / agent bodies for one reference workflow (loaded
//               once each when first used): conversate + core + brain
//               auto-loads, work, review, coder + reviewer + curator agents.
//
// This measures plugin-injected overhead only -- user prompts, file reads,
// and model output are out of scope.

const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2] && !process.argv[2].startsWith('--') ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const turnsArg = process.argv.indexOf('--turns');
const TURNS = turnsArg !== -1 ? parseInt(process.argv[turnsArg + 1], 10) : 30;
const asJson = process.argv.includes('--json');

const tokens = (chars) => Math.round(chars / 4);

function frontmatterDescription(file) {
  const content = fs.readFileSync(file, 'utf8');
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return '';
  // disable-model-invocation commands are never advertised to the model, so
  // their descriptions cost the / menu, not the context window.
  if (/^disable-model-invocation:\s*true/m.test(m[1])) return '';
  const dm = m[1].match(/^description:\s*([\s\S]*?)(?=\r?\n\w+:|$)/m);
  return dm ? dm[1].trim() : '';
}

function body(file) {
  const content = fs.readFileSync(file, 'utf8');
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

function listFiles(dir, filter) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const skill = path.join(abs, entry.name, 'SKILL.md');
      if (fs.existsSync(skill)) out.push(skill);
    } else if (filter.test(entry.name)) {
      out.push(path.join(abs, entry.name));
    }
  }
  return out;
}

// --- fixed: descriptions + MCP tool list ---
const skillFiles = listFiles('skills', /SKILL\.md$/);
const commandFiles = listFiles('commands', /\.md$/);
const agentFiles = listFiles('agents', /\.md$/);

const descriptionChars = [...skillFiles, ...commandFiles, ...agentFiles]
  .map((f) => frontmatterDescription(f).length)
  .reduce((a, b) => a + b, 0);

let mcpChars = 0;
try {
  const { handleMessage } = require(path.join(root, 'scripts', 'brain-mcp.js'));
  const res = handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, path.join(root, 'no-vault'));
  mcpChars = JSON.stringify(res.result.tools).length;
} catch {
  // older/newer layout without the server: count 0
}

// --- perTurn: the UserPromptSubmit reminder ---
// Run remind.js against a bare turnstile dir (no alerts) the way the hook does,
// feeding it a fixed session id twice to capture first-turn and repeat sizes.
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'turnstile-token-report-'));
fs.mkdirSync(path.join(tmp, 'turnstile'), { recursive: true });
function remindOutput(sessionId) {
  try {
    return execFileSync('node', [path.join(root, 'hooks', 'remind.js')], {
      cwd: tmp,
      input: JSON.stringify({ session_id: sessionId, hook_event_name: 'UserPromptSubmit', prompt: 'x' }),
      encoding: 'utf8',
    });
  } catch {
    return '';
  }
}
// Simulate the session for real: run the hook once per turn so periodic
// refreshes are counted exactly, not modeled.
const emissions = [];
for (let k = 0; k < TURNS; k++) emissions.push(remindOutput('token-report-session').length);
fs.rmSync(tmp, { recursive: true, force: true });

const firstTurn = emissions[0];
const repeatTurn = emissions[1] !== undefined ? emissions[1] : 0;
const perTurnEmitted = emissions.reduce((a, b) => a + b, 0);
// Cumulative context: reminder emitted at turn k is context for turns k..N.
let perTurnCumulative = 0;
emissions.forEach((chars, i) => {
  perTurnCumulative += chars * (TURNS - i);
});

// --- capture modes: brain-curator dispatch overhead, side by side ---
// The reference session (TURNS turns) is modeled as one ticket per 10 turns
// moving refine -> spec -> sprint -> work (3 coder passes) -> review. Each
// curator dispatch loads plugin text into the curator's context: its agent
// body plus the note-format reference, plus the code-note reference when the
// dispatch writes turnstile/code/ notes. Dispatch prompts are model-generated
// and out of scope, like all non-plugin text.
//   gates (default):  2 dispatches per ticket -- design/plan approved
//                     (body + note-format) and review pass (body +
//                     note-format + code-notes).
//   opportunistic:    5 dispatches per ticket -- refine (body + note-format),
//                     each of the 3 work passes (body + note-format +
//                     code-notes), review estimate-mismatch (body +
//                     note-format).
function fileChars(rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').length : 0;
}
const curatorBody = body(path.join(root, 'agents', 'brain-curator.md')).length;
const noteFormatRef = fileChars('skills/turnstile-brain/references/note-format.md');
const codeNotesRef = fileChars('skills/turnstile-brain/references/curator-code-notes.md');
const plainDispatch = curatorBody + noteFormatRef;
const codeDispatch = curatorBody + noteFormatRef + codeNotesRef;
const tickets = Math.max(1, Math.floor(TURNS / 10));
const captureModes = {
  gates: { dispatches: tickets * 2, chars: tickets * (plainDispatch + codeDispatch) },
  opportunistic: { dispatches: tickets * 5, chars: tickets * (2 * plainDispatch + 3 * codeDispatch) },
};

// --- invoked: reference workflow bodies ---
const pick = (dir, name) => path.join(root, dir, name);
const invokedFiles = [
  pick('skills', 'turnstile-conversate/SKILL.md'),
  pick('skills', 'turnstile-core/SKILL.md'),
  pick('skills', 'turnstile-brain/SKILL.md'),
  pick('skills', 'turnstile-work/SKILL.md'),
  pick('skills', 'turnstile-review/SKILL.md'),
  pick('agents', 'turnstile-coder.md'),
  pick('agents', 'turnstile-reviewer.md'),
  pick('agents', 'brain-curator.md'),
].filter((f) => fs.existsSync(f));
const invokedChars = invokedFiles.map((f) => body(f).length).reduce((a, b) => a + b, 0);

const report = {
  root,
  turns: TURNS,
  fixed: { descriptions: descriptionChars, mcpToolList: mcpChars, total: descriptionChars + mcpChars },
  perTurn: { firstTurn, repeatTurn, emittedOverSession: perTurnEmitted, cumulativeContext: perTurnCumulative },
  invoked: { referenceWorkflow: invokedChars },
  capture: { tickets, modes: captureModes },
  totals: {
    emittedChars: descriptionChars + mcpChars + perTurnEmitted + invokedChars,
    emittedTokens: tokens(descriptionChars + mcpChars + perTurnEmitted + invokedChars),
    cumulativeContextChars: (descriptionChars + mcpChars + invokedChars) * TURNS + perTurnCumulative,
    cumulativeContextTokens: tokens((descriptionChars + mcpChars + invokedChars) * TURNS + perTurnCumulative),
  },
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const t = report.totals;
  console.log(`turnstile token report (${TURNS}-turn reference session) -- ${root}`);
  console.log(`  fixed (descriptions + MCP tool list): ${report.fixed.total} chars (~${tokens(report.fixed.total)} tokens)`);
  console.log(`  reminder: first turn ${firstTurn}, repeats ${repeatTurn} chars; emitted over session ${perTurnEmitted} (~${tokens(perTurnEmitted)} tokens)`);
  console.log(`  invoked bodies (reference workflow): ${invokedChars} chars (~${tokens(invokedChars)} tokens)`);
  const g = captureModes.gates;
  const o = captureModes.opportunistic;
  console.log(`  capture modes (${tickets} ticket(s) over ${TURNS} turns):`);
  console.log(`    gates:         ${g.dispatches} curator dispatches, ${g.chars} chars (~${tokens(g.chars)} tokens)`);
  console.log(`    opportunistic: ${o.dispatches} curator dispatches, ${o.chars} chars (~${tokens(o.chars)} tokens)`);
  console.log(`  TOTAL emitted: ${t.emittedChars} chars (~${t.emittedTokens} tokens)`);
  console.log(`  TOTAL cumulative context over ${TURNS} turns: ${t.cumulativeContextChars} chars (~${t.cumulativeContextTokens} tokens)`);
}
