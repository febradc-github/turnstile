#!/usr/bin/env node
// PreToolUse guard: blocks git commits that violate the turnstile commit
// convention (no Anthropic/Claude attribution, no --no-verify), and blocks
// ANY tool access to env files (.env, .env.*, *.env, .envrc) -- they hold
// secrets and are never read, written, searched, or referenced in commands.
// Exit 2 blocks the tool call and feeds stderr back to Claude.

const ENV_MSG =
  'turnstile forbids touching env files (.env, .env.*, *.env, .envrc): they hold secrets and are never read, written, searched, or referenced in commands. No exceptions -- ask the user for any config value you need.';

const FILE_TOOLS = new Set(['Read', 'Edit', 'Write', 'NotebookEdit', 'Grep', 'Glob']);

// True when a path, filename, or glob targets an env file.
function isEnvTarget(value) {
  if (!value || typeof value !== 'string') return false;
  const base = value.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';
  if (/^\.envrc$/i.test(base)) return true;
  if (/^\.env(\..+)?$/i.test(base)) return true; // .env, .env.local, .env.production
  if (/\.env$/i.test(base)) return true; // prod.env, config.env
  if (/[*?]/.test(base) && /\.env/i.test(base)) return true; // globs like .env* or *.env*
  return false;
}

// True when a shell command references an env file anywhere.
function commandTouchesEnv(command) {
  const tokens = String(command).split(/[\s"'`;|&<>()]+/);
  return tokens.some((t) => isEnvTarget(t.replace(/[,:;)]+$/, '')));
}

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // unparseable input: never block
  }
  const tool = input.tool_name || '';
  const args = input.tool_input || {};
  const violations = [];

  if (FILE_TOOLS.has(tool)) {
    const targets = [args.file_path, args.notebook_path, args.path, args.glob];
    if (tool === 'Glob') targets.push(args.pattern); // Glob's pattern is a file glob
    if (targets.some(isEnvTarget)) violations.push(ENV_MSG);
  }

  if (tool === 'Bash' || tool === 'PowerShell') {
    const command = (args && args.command) || '';
    if (commandTouchesEnv(command)) violations.push(ENV_MSG);
    if (/\bgit\b/.test(command) && /\bcommit\b/.test(command)) {
      if (/--no-verify\b/.test(command)) {
        violations.push('turnstile forbids --no-verify on commits; fix the hook failure instead.');
      }
      if (/co-authored-by:.*\b(claude|anthropic)\b/i.test(command) || /noreply@anthropic\.com/i.test(command)) {
        violations.push('turnstile forbids Anthropic/Claude attribution lines in commit messages; remove the Co-Authored-By trailer.');
      }
    }
  }

  if (violations.length === 0) process.exit(0);
  process.stderr.write(violations.join('\n') + '\n');
  process.exit(2);
});
