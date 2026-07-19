#!/usr/bin/env node
'use strict';
// Loop Watch DevOps Console for turnstile.
//
// Usage: node scripts/loop-watch.js <id> [projectRoot]
//
// Starts a local HTTP server, opens the browser automatically, and serves
// an HTML dashboard that polls GET /state every second.  The server exits
// cleanly when the loop reaches a terminal status or the user kills it.
//
// Exports (pure helpers, testable without a running server):
//   buildHtml(state, nodeLabels) -> string   full HTML page
//   isTerminal(status) -> bool              true for terminal statuses

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { readState } = require('./loop-state.js');

const DEFAULT_LABELS = ['ACT', 'OBSERVE', 'EVALUATE', 'DECIDE'];
const TERMINAL_STATUSES = new Set(['success', 'max_iterations_reached', 'error']);
const DEFAULT_PORT = 3847;

/**
 * Returns true when the loop has reached a terminal status.
 * @param {string|null|undefined} status
 * @returns {boolean}
 */
function isTerminal(status) {
  if (status == null) return false;
  return TERMINAL_STATUSES.has(status);
}

/**
 * Escapes a string for safe inclusion in HTML text content.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Builds the full HTML page string for the given loop state.
 *
 * @param {object}   state       - The loop state object from state.json.
 * @param {string[]} [nodeLabels] - Four node labels; defaults to ACT/OBSERVE/EVALUATE/DECIDE.
 * @returns {string} Complete HTML document.
 */
function buildHtml(state, nodeLabels) {
  const labels = Array.isArray(nodeLabels) && nodeLabels.length === 4
    ? nodeLabels
    : DEFAULT_LABELS;

  const activePhase = state.phase || null;

  // Corner positions: top-left, top-right, bottom-right, bottom-left
  const positions = [
    { label: labels[0], x: '18%', y: '18%' },
    { label: labels[1], x: '82%', y: '18%' },
    { label: labels[2], x: '82%', y: '82%' },
    { label: labels[3], x: '18%', y: '82%' },
  ];

  // Build node cards HTML
  const nodesHtml = positions.map(({ label, x, y }, i) => {
    const isActive = label === activePhase;
    const cardStyle = isActive
      ? `left: ${x}; top: ${y}; border: 2px solid #00ffff; box-shadow: 0 0 12px #00ffff44; position: relative;`
      : `left: ${x}; top: ${y}; border: 1px solid #1e2a3a; position: relative;`;
    const dotHtml = isActive
      ? '<span class="status-dot" aria-label="active"></span>'
      : '';
    const subtitle = state.config && state.config.nodeSubtitles && state.config.nodeSubtitles[i]
      ? `<span class="node-subtitle">${escapeHtml(state.config.nodeSubtitles[i])}</span>`
      : '';
    return `
      <div class="node${isActive ? ' node--active' : ''}" data-label="${escapeHtml(label)}"
           style="${cardStyle}">
        ${dotHtml}
        <span class="node-label">${escapeHtml(label)}</span>${subtitle}
      </div>`;
  }).join('\n');

  // Four trace lines connecting adjacent corner nodes
  const tracesHtml = `
  <div class="trace" style="top: 18%; left: 18%; width: 64%; height: 1px;"></div>
  <div class="trace" style="left: 82%; top: 18%; width: 1px; height: 64%;"></div>
  <div class="trace" style="top: 82%; left: 18%; width: 64%; height: 1px;"></div>
  <div class="trace" style="left: 18%; top: 18%; width: 1px; height: 64%;"></div>`;

  // Demo log lines (shown when no DECIDE history)
  const demoLogHtml = `<div class="log-wrap"><div class="log-scroll">
  <div class="log-entry">&gt; planning next action... <span class="log-highlight">done</span></div>
  <div class="log-entry">&gt; running tool call... <span class="log-highlight">200 OK</span></div>
  <div class="log-entry">&gt; evaluating result... <span class="log-highlight">continue</span></div>
  <div class="log-entry">&gt; deciding next phase... <span class="log-highlight">ACT</span></div>
  <div class="log-entry">&gt; planning next action... <span class="log-highlight">done</span></div>
  <div class="log-entry">&gt; running tool call... <span class="log-highlight">200 OK</span></div>
  <div class="log-entry">&gt; evaluating result... <span class="log-highlight">continue</span></div>
  <div class="log-entry">&gt; deciding next phase... <span class="log-highlight">ACT</span></div>
</div></div>`;

  // Build terminal log entries HTML (DECIDE phase only, per spec)
  const decides = (state.history || []).filter((e) => e.phase === 'DECIDE');
  const logEntries = decides.length > 0
    ? decides.map((e) => {
        const obs = escapeHtml(e.observation || '—');
        const dec = escapeHtml(e.decision || '—');
        return `<div class="log-entry">[iter ${e.iteration} · DECIDE] <span class="log-highlight">${dec}</span>: ${obs}</div>`;
      }).join('\n')
    : null;

  const statusText = escapeHtml(state.status || 'unknown');
  const idText = escapeHtml(state.id || '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Loop Watch · ${idText}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0a0e1a;
    color: #c0c8d8;
    font-family: monospace;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px;
    gap: 24px;
  }

  h1 {
    font-size: 1rem;
    color: #c0c8d8;
    letter-spacing: 0.08em;
  }

  .status-bar {
    font-size: 0.8rem;
    color: #4a5568;
  }

  /* --- Circuit container --- */
  .circuit {
    position: relative;
    width: min(500px, 90vw);
    height: min(320px, 60vw);
    border: 2px solid #1e2a3a;
    border-radius: 32px;
    background: #0a0e1a;
  }

  /* --- Node cards --- */
  .node {
    position: absolute;
    width: min(120px, 24vw);
    height: min(60px, 12vw);
    background: #0d1321;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 2px;
    transform: translate(-50%, -50%);
  }

  .node-label {
    font-size: 0.85rem;
    letter-spacing: 0.06em;
    color: #c0c8d8;
  }

  .node-subtitle {
    font-size: 0.7rem;
    color: #4a5568;
  }

  /* --- Circuit trace lines --- */
  .trace {
    position: absolute;
    background: #1e2a3a;
  }

  /* Status dot (top-right corner of active node) */
  .status-dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #00ffff;
  }

  /* --- Amber feedback label (always visible) --- */
  .feedback-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #ffb300;
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    white-space: nowrap;
    pointer-events: none;
  }

  /* --- Cyan pulse dot --- */
  .pulse {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #00ffff;
    top: 0;
    left: 0;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  /* --- Terminal log --- */
  .terminal-log {
    width: min(500px, 90vw);
    background: #050810;
    border: 1px solid #1e2a3a;
    border-radius: 4px;
    height: 64px;
    overflow: hidden;
    padding: 8px 12px;
  }

  .log-entry {
    color: #4caf50;
    font-size: 0.78rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .log-empty {
    color: #2a3a4a;
    font-size: 0.78rem;
    font-style: italic;
  }

  .log-highlight {
    color: #00ffff;
  }

  .log-wrap {
    overflow: hidden;
    height: 64px;
  }

  @keyframes scroll-up {
    0%   { transform: translateY(0); }
    100% { transform: translateY(-50%); }
  }

  .log-scroll {
    animation: scroll-up 8s linear infinite;
  }

  /* --- Reduced-motion: no animation, no glow --- */
  @media (prefers-reduced-motion: no-preference) {
    /* Pulse travels clockwise: top-left → top-right → bottom-right → bottom-left → top-left */
    @keyframes circuit-pulse {
      0%   { top: 18%; left: 18%; }
      25%  { top: 18%; left: 82%; }
      50%  { top: 82%; left: 82%; }
      75%  { top: 82%; left: 18%; }
      100% { top: 18%; left: 18%; }
    }

    .pulse {
      animation: circuit-pulse 6s linear infinite;
    }

    .node--active {
      box-shadow: 0 0 12px #00ffff44;
    }

    .status-dot {
      box-shadow: 0 0 8px #00ffff;
    }
  }

  /* When reduced-motion IS preferred, remove animation and glow.
     Active node shows with static cyan border only (set via inline style). */
  @media (prefers-reduced-motion: reduce) {
    .pulse {
      display: none;
    }
    .node--active {
      box-shadow: none;
    }
    .status-dot {
      box-shadow: none;
    }
  }
</style>
</head>
<body>

<h1>LOOP WATCH · ${idText}</h1>
<p class="status-bar">status: <span id="status">${statusText}</span> &nbsp;|&nbsp; phase: <span id="phase">${escapeHtml(activePhase || '—')}</span></p>

<div class="circuit" id="circuit">
  ${nodesHtml}
  ${tracesHtml}

  <div class="feedback-label">feedback → next cycle</div>

  <div class="pulse" id="pulse"></div>
</div>

<div class="terminal-log" id="log">
  ${logEntries
    ? logEntries
    : demoLogHtml}
</div>

<script>
  // Poll GET /state every 1000ms and update the display without a full reload.
  (function () {
    var labels = ${JSON.stringify(labels)};

    function applyState(state) {
      // Clear demo cycle if it was running and a real phase has arrived
      if (demoCycle && state.phase) { clearInterval(demoCycle); demoCycle = null; }

      // Update status / phase text
      document.getElementById('status').textContent = state.status || 'unknown';
      document.getElementById('phase').textContent = state.phase || '—';

      // Update node highlighting
      var nodes = document.querySelectorAll('.node');
      nodes.forEach(function (node) {
        var lbl = node.getAttribute('data-label');
        var isActive = lbl === state.phase;
        node.classList.toggle('node--active', isActive);
        if (isActive) {
          node.style.border = '2px solid #00ffff';
          // glow applied via CSS class (reduced-motion aware)
        } else {
          node.style.border = '1px solid #1e2a3a';
        }

        // Status dot
        var dot = node.querySelector('.status-dot');
        if (isActive && !dot) {
          dot = document.createElement('span');
          dot.className = 'status-dot';
          dot.setAttribute('aria-label', 'active');
          node.appendChild(dot);
        } else if (!isActive && dot) {
          dot.remove();
        }
      });

      // Rebuild terminal log with DECIDE entries only
      var log = document.getElementById('log');
      var decides = (state.history || []).filter(function (e) { return e.phase === 'DECIDE'; });
      if (decides.length === 0) {
        log.innerHTML = '<div class="log-wrap"><div class="log-scroll">' +
          '<div class="log-entry">&gt; planning next action... <span class="log-highlight">done</span></div>' +
          '<div class="log-entry">&gt; running tool call... <span class="log-highlight">200 OK</span></div>' +
          '<div class="log-entry">&gt; evaluating result... <span class="log-highlight">continue</span></div>' +
          '<div class="log-entry">&gt; deciding next phase... <span class="log-highlight">ACT</span></div>' +
          '<div class="log-entry">&gt; planning next action... <span class="log-highlight">done</span></div>' +
          '<div class="log-entry">&gt; running tool call... <span class="log-highlight">200 OK</span></div>' +
          '<div class="log-entry">&gt; evaluating result... <span class="log-highlight">continue</span></div>' +
          '<div class="log-entry">&gt; deciding next phase... <span class="log-highlight">ACT</span></div>' +
          '</div></div>';
      } else {
        log.innerHTML = decides.map(function (e) {
          var obs = (e.observation || '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          var dec = (e.decision || '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          return '<div class="log-entry">[iter ' + e.iteration + ' \xB7 DECIDE] <span class="log-highlight">' + dec + '</span>: ' + obs + '</div>';
        }).join('\n');
        // Auto-scroll to bottom
        log.scrollTop = log.scrollHeight;
      }

      // Signal terminal status to stop polling
      return state.status === 'success' ||
             state.status === 'max_iterations_reached' ||
             state.status === 'error';
    }

    var demoCycle = null;
    if (!${JSON.stringify(activePhase)}) {
      var demoIdx = 0;
      demoCycle = setInterval(function () {
        var nodes = document.querySelectorAll('.node');
        nodes.forEach(function (n, i) {
          var active = i === demoIdx;
          n.classList.toggle('node--active', active);
          n.style.border = active ? '2px solid #00ffff' : '1px solid #1e2a3a';
        });
        document.getElementById('phase').textContent = labels[demoIdx];
        demoIdx = (demoIdx + 1) % labels.length;
      }, 1500);
    }

    var pollTimer;

    function poll() {
      fetch('/state')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var done = applyState(data);
          if (done) {
            clearInterval(pollTimer);
            document.getElementById('status').style.color = '#ffb300';
          }
        })
        .catch(function () {
          // Server may have exited; stop polling.
          clearInterval(pollTimer);
        });
    }

    pollTimer = setInterval(poll, 1000);
    // Initial poll immediately
    poll();
  })();
</script>

</body>
</html>`;
}

// --- Port selection ---

/**
 * Attempts to bind a TCP server to the given port.  Resolves with the port if
 * successful, rejects otherwise.  Uses a throwaway server that is immediately
 * closed after the port check.
 * @param {number} port
 * @returns {Promise<number>}
 */
function tryPort(port) {
  return new Promise((resolve, reject) => {
    const probe = http.createServer();
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => {
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Finds a free port starting from DEFAULT_PORT, trying up to 5 times.
 * @returns {Promise<number>}
 */
async function findPort() {
  for (let i = 0; i < 5; i++) {
    const p = DEFAULT_PORT + i;
    try {
      return await tryPort(p);
    } catch (_) {
      // port in use, try next
    }
  }
  throw new Error(`No free port found in range ${DEFAULT_PORT}–${DEFAULT_PORT + 4}`);
}

/**
 * Opens the given URL in the system's default browser.
 * @param {string} url
 */
function openBrowser(url) {
  try {
    let cmd;
    if (process.platform === 'darwin') {
      cmd = `open ${url}`;
    } else if (process.platform === 'win32') {
      cmd = `start ${url}`;
    } else {
      cmd = `xdg-open ${url}`;
    }
    execSync(cmd, { stdio: 'ignore' });
  } catch (_) {
    // Non-fatal: user can open the URL manually.
  }
}

// --- Main entry point ---

if (require.main === module) {
  const [, , id, projectRoot] = process.argv;

  if (!id) {
    process.stderr.write('Usage: node scripts/loop-watch.js <id> [projectRoot]\n');
    process.exit(1);
  }

  const root = projectRoot || process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // Validate state.json exists before starting the server.
  const stateFilePath = path.join(root, 'turnstile', 'loops', id, 'state.json');
  if (!fs.existsSync(stateFilePath)) {
    process.stderr.write(`Loop state not found: ${stateFilePath}\n`);
    process.exit(1);
  }

  let server;
  let pollInterval;

  function shutdown(code) {
    clearInterval(pollInterval);
    if (server) {
      server.close(() => process.exit(code || 0));
    } else {
      process.exit(code || 0);
    }
  }

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  (async () => {
    const port = await findPort();
    const url = `http://127.0.0.1:${port}`;

    server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/state') {
        let state;
        try {
          state = readState(id, root);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify(state));
        return;
      }

      if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
        let state;
        try {
          state = readState(id, root);
        } catch (err) {
          state = { status: 'error', phase: null, history: [], id };
        }
        const nodeLabels = Array.isArray(state.config && state.config.nodeLabels)
          ? state.config.nodeLabels
          : DEFAULT_LABELS;
        const html = buildHtml(state, nodeLabels);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(port, '127.0.0.1', () => {
      process.stdout.write(`Loop Watch running at ${url}\n`);
      process.stdout.write('Press Ctrl+C to stop.\n');
      openBrowser(url);
    });

    // Server-side poll: check for terminal status every 2s and exit when done.
    pollInterval = setInterval(() => {
      try {
        const state = readState(id, root);
        if (isTerminal(state.status)) {
          process.stdout.write(`\nLoop ${id} completed with status: ${state.status}\n`);
          process.stdout.write('Server will exit in 5 seconds (browser still open).\n');
          clearInterval(pollInterval);
          setTimeout(() => shutdown(0), 5000);
        }
      } catch (_) {
        // state.json may be temporarily unavailable; keep polling
      }
    }, 2000);
  })();
}

module.exports = { isTerminal, buildHtml };
