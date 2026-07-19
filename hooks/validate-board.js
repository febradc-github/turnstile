#!/usr/bin/env node
// PostToolUse validator for turnstile board files: backlog.yml, sprint.yml (the
// current sprint), sprints/sprint-N.yml (archives), and legacy root
// sprint-N.yml. Structural checks only -- no YAML dependency. Exit 2 feeds
// the problems back to Claude so the bad write is corrected immediately.

const fs = require('node:fs');
const path = require('node:path');

// profile: solo (turnstile/config.yml) changes which artifacts the skills
// write (PL-<n> plans instead of DS/SP), not the board's states -- solo items
// still move idea/ready -> todo -> in_progress -> review -> done, so no
// profile-specific invariants exist here.
const ITEM_STATUSES = new Set(['todo', 'in_progress', 'review', 'done', 'dropped', 'parked']);
const SPRINT_STATUSES = new Set(['active', 'completed']);
// cadence: flow (turnstile/config.yml) reuses sprint.yml with a mode: flow
// header marker, so every sprint invariant (one active board, one
// in_progress, one live copy) applies to the flow queue unchanged. Switching
// cadence requires no active board of the other mode -- the skills enforce
// that by archiving first; here both modes validate identically.
const BOARD_MODES = new Set(['sprint', 'flow']);
const ITEM_TYPES = new Set(['epic', 'story', 'task']);

// Returns { sprintStatus, items: [{id, status, type, parent}], problems: [] }
function scanBoardFile(filePath, kind, label) {
  const problems = [];
  const items = [];
  let sprintStatus = null;
  let inItems = false;
  let current = null;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (/^items:/.test(line)) {
      inItems = true;
      continue;
    }
    const idMatch = line.match(/^\s*-\s+id:\s*["']?(\S+?)["']?\s*$/);
    if (idMatch && inItems) {
      current = { id: idMatch[1], status: null, type: null, parent: null, parked_at: null };
      items.push(current);
      if (!/^C-\d+$/.test(current.id)) {
        problems.push(`${label}: id "${current.id}" does not match C-<number>`);
      }
      continue;
    }
    const fieldMatch = line.match(/^\s*(status|type|parent|mode|parked_at):\s*["']?(\S+?)["']?\s*$/);
    if (!fieldMatch) continue;
    const [, field, value] = fieldMatch;
    if (inItems && current) {
      current[field] = value;
      if (field === 'type' && !ITEM_TYPES.has(value)) {
        problems.push(
          `${label}: item ${current.id} has invalid type "${value}" (allowed: ${[...ITEM_TYPES].join(', ')})`
        );
      }
      if (field === 'status' && kind === 'sprint' && !ITEM_STATUSES.has(value)) {
        problems.push(
          `${label}: item ${current.id} has invalid status "${value}" (allowed: ${[...ITEM_STATUSES].join(', ')})`
        );
      }
      if (field === 'type' && value === 'epic' && kind === 'sprint') {
        problems.push(`${label}: item ${current.id} is an epic; epics never enter a sprint`);
      }
    } else if (!inItems && kind === 'sprint' && field === 'status') {
      sprintStatus = value;
      if (!SPRINT_STATUSES.has(value)) {
        problems.push(`${label}: sprint status "${value}" is invalid (allowed: active, completed)`);
      }
    } else if (!inItems && kind === 'sprint' && field === 'mode') {
      if (!BOARD_MODES.has(value)) {
        problems.push(`${label}: board mode "${value}" is invalid (allowed: ${[...BOARD_MODES].join(', ')})`);
      }
    }
  }
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) problems.push(`${label}: duplicate id ${item.id}`);
    seen.add(item.id);
  }
  return { sprintStatus, items, problems };
}

function validate(turnstileDir) {
  const problems = [];
  const backlogPath = path.join(turnstileDir, 'backlog.yml');
  const backlogById = new Map(); // id -> item, backlog only (parents live there)
  let backlogItems = [];
  if (fs.existsSync(backlogPath)) {
    const backlog = scanBoardFile(backlogPath, 'backlog', 'backlog.yml');
    problems.push(...backlog.problems);
    backlogItems = backlog.items;
    backlog.items.forEach((i) => backlogById.set(i.id, i));
  }

  // Sprint boards: sprint.yml (current), legacy root sprint-N.yml, and
  // sprints/ archives (which must be completed).
  const boards = [];
  const sprintPath = path.join(turnstileDir, 'sprint.yml');
  if (fs.existsSync(sprintPath)) boards.push({ file: sprintPath, label: 'sprint.yml', archive: false });
  for (const f of fs.readdirSync(turnstileDir).filter((f) => /^sprint-\d+\.yml$/.test(f)).sort()) {
    boards.push({ file: path.join(turnstileDir, f), label: f, archive: false });
  }
  const archiveDir = path.join(turnstileDir, 'sprints');
  if (fs.existsSync(archiveDir)) {
    for (const f of fs.readdirSync(archiveDir).filter((f) => /^sprint-\d+\.yml$/.test(f)).sort()) {
      boards.push({ file: path.join(archiveDir, f), label: `sprints/${f}`, archive: true });
    }
  }

  const activeBoards = [];
  const liveIds = new Map(); // id -> file it lives in (backlog or an active board)
  const allItems = backlogItems.map((i) => ({ item: i, file: 'backlog.yml', live: true }));
  backlogById.forEach((_, id) => liveIds.set(id, 'backlog.yml'));

  for (const board of boards) {
    const sprint = scanBoardFile(board.file, 'sprint', board.label);
    problems.push(...sprint.problems);
    const isActive = sprint.sprintStatus === 'active';
    if (board.archive && isActive) {
      problems.push(`${board.label}: archived sprints must be completed; only sprint.yml holds the active sprint`);
    }
    sprint.items.forEach((i) => allItems.push({ item: i, file: board.label, live: isActive && !board.archive }));
    if (!isActive || board.archive) continue;
    activeBoards.push(board.label);
    const inProgress = sprint.items.filter((i) => i.status === 'in_progress');
    if (inProgress.length > 1) {
      problems.push(`${board.label}: ${inProgress.length} items are in_progress (${inProgress.map((i) => i.id).join(', ')}); only one is allowed`);
    }
    // Parked items (live boards only -- archives are immutable history) must
    // carry parked_at on the board and a resume note in their item note. The
    // note check is deliberately shallow: file exists, "## Resume" heading
    // present -- this validator never parses note structure beyond that.
    for (const item of sprint.items.filter((i) => i.status === 'parked')) {
      if (!item.parked_at) {
        problems.push(`${board.label}: parked item ${item.id} has no parked_at timestamp`);
      }
      const n = (item.id.match(/^C-(\d+)$/) || [])[1];
      const noteRel = item.type === 'task' ? `tasks/TK-${n}.md` : `user-stories/US-${n}.md`;
      let hasResume = false;
      try {
        hasResume = /^##\s+Resume\b/m.test(fs.readFileSync(path.join(turnstileDir, noteRel), 'utf8'));
      } catch {
        // missing note: hasResume stays false
      }
      if (!hasResume) {
        problems.push(`${board.label}: parked item ${item.id} has no resume note (a "## Resume" section in ${noteRel})`);
      }
    }
    for (const item of sprint.items) {
      if (liveIds.has(item.id)) {
        problems.push(`${item.id} exists in both ${liveIds.get(item.id)} and ${board.label}; an item has exactly one live copy`);
      } else {
        liveIds.set(item.id, board.label);
      }
    }
  }
  if (activeBoards.length > 1) {
    problems.push(`multiple active sprints (${activeBoards.join(', ')}); complete the old sprint before opening a new one`);
  }

  // Hierarchy: containers are ids referenced as parent anywhere (history included).
  const containers = new Set();
  for (const { item } of allItems) {
    if (item.parent) containers.add(item.parent);
  }

  for (const item of backlogItems) {
    if (!item.status) continue;
    const isEpic = item.type === 'epic';
    const isContainer = containers.has(item.id);
    const allowed = new Set(isEpic || isContainer ? ['idea'] : ['idea', 'ready']);
    if (isContainer) allowed.add('done');
    allowed.add('dropped');
    if (!allowed.has(item.status)) {
      const label = isEpic ? 'epic' : isContainer ? 'container (has children)' : 'item';
      problems.push(
        `backlog.yml: ${label} ${item.id} has invalid status "${item.status}" (allowed: ${[...allowed].join(', ')})`
      );
    }
  }

  for (const { item, file, live } of allItems) {
    if (item.type === 'epic' && item.parent) {
      problems.push(`${file}: epic ${item.id} has a parent; epics are top-level`);
      continue;
    }
    if (!item.parent) continue;
    const parent = backlogById.get(item.parent);
    if (!parent) {
      if (live) problems.push(`${file}: item ${item.id} names parent ${item.parent}, which is not in backlog.yml`);
      continue;
    }
    const childType = item.type || 'story';
    const parentType = parent.type || 'story';
    if (childType === 'story' && parentType !== 'epic') {
      problems.push(`${file}: story ${item.id} has parent ${item.parent} of type ${parentType}; a story's parent must be an epic`);
    }
    if (childType === 'task' && parentType !== 'story') {
      problems.push(`${file}: task ${item.id} has parent ${item.parent} of type ${parentType}; a task's parent must be a story`);
    }
  }

  return problems;
}

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  // Claude Code passes file_path; kimi-code's Write/Edit tools pass path.
  const filePath = (input.tool_input && (input.tool_input.file_path || input.tool_input.path)) || '';
  let turnstileDir = null;
  if (/[\\/]turnstile[\\/](backlog\.yml|sprint\.yml|sprint-\d+\.yml)$/.test(filePath)) {
    turnstileDir = path.dirname(filePath);
  } else if (/[\\/]turnstile[\\/]sprints[\\/]sprint-\d+\.yml$/.test(filePath)) {
    turnstileDir = path.dirname(path.dirname(filePath));
  }
  if (!turnstileDir) process.exit(0);
  let problems;
  try {
    problems = validate(turnstileDir);
  } catch {
    process.exit(0); // validator error must never break the session
  }
  if (problems.length === 0) process.exit(0);
  process.stderr.write('turnstile board validation failed:\n- ' + problems.join('\n- ') + '\n');
  process.exit(2);
});
