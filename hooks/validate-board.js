#!/usr/bin/env node
// PostToolUse validator for cadence board files (backlog.yml, sprint-N.yml).
// Structural checks only -- no YAML dependency. Exit 2 feeds the problems
// back to Claude so the bad write is corrected immediately.

const fs = require('node:fs');
const path = require('node:path');

const ITEM_STATUSES = new Set(['todo', 'in_progress', 'review', 'done']);
const SPRINT_STATUSES = new Set(['active', 'completed']);
const ITEM_TYPES = new Set(['epic', 'story', 'task']);

// Returns { sprintStatus, items: [{id, status, type, parent}], problems: [] }
function scanBoardFile(filePath, kind) {
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
      current = { id: idMatch[1], status: null, type: null, parent: null };
      items.push(current);
      if (!/^C-\d+$/.test(current.id)) {
        problems.push(`${path.basename(filePath)}: id "${current.id}" does not match C-<number>`);
      }
      continue;
    }
    const fieldMatch = line.match(/^\s*(status|type|parent):\s*["']?(\S+?)["']?\s*$/);
    if (!fieldMatch) continue;
    const [, field, value] = fieldMatch;
    if (inItems && current) {
      current[field] = value;
      if (field === 'type' && !ITEM_TYPES.has(value)) {
        problems.push(
          `${path.basename(filePath)}: item ${current.id} has invalid type "${value}" (allowed: ${[...ITEM_TYPES].join(', ')})`
        );
      }
      if (field === 'status' && kind === 'sprint' && !ITEM_STATUSES.has(value)) {
        problems.push(
          `${path.basename(filePath)}: item ${current.id} has invalid status "${value}" (allowed: ${[...ITEM_STATUSES].join(', ')})`
        );
      }
      if (field === 'type' && value === 'epic' && kind === 'sprint') {
        problems.push(`${path.basename(filePath)}: item ${current.id} is an epic; epics never enter a sprint`);
      }
    } else if (!inItems && kind === 'sprint' && field === 'status') {
      sprintStatus = value;
      if (!SPRINT_STATUSES.has(value)) {
        problems.push(`${path.basename(filePath)}: sprint status "${value}" is invalid (allowed: active, completed)`);
      }
    }
  }
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) problems.push(`${path.basename(filePath)}: duplicate id ${item.id}`);
    seen.add(item.id);
  }
  return { sprintStatus, items, problems };
}

function validate(cadenceDir) {
  const problems = [];
  const backlogPath = path.join(cadenceDir, 'backlog.yml');
  const backlogById = new Map(); // id -> item, backlog only (parents live there)
  let backlogItems = [];
  if (fs.existsSync(backlogPath)) {
    const backlog = scanBoardFile(backlogPath, 'backlog');
    problems.push(...backlog.problems);
    backlogItems = backlog.items;
    backlog.items.forEach((i) => backlogById.set(i.id, i));
  }

  const sprintFiles = fs
    .readdirSync(cadenceDir)
    .filter((f) => /^sprint-\d+\.yml$/.test(f))
    .sort();
  const activeSprints = [];
  const liveIds = new Map(); // id -> file it lives in (backlog or an active sprint)
  const allItems = backlogItems.map((i) => ({ item: i, file: 'backlog.yml', live: true }));
  backlogById.forEach((_, id) => liveIds.set(id, 'backlog.yml'));

  for (const file of sprintFiles) {
    const sprint = scanBoardFile(path.join(cadenceDir, file), 'sprint');
    problems.push(...sprint.problems);
    const isActive = sprint.sprintStatus === 'active';
    sprint.items.forEach((i) => allItems.push({ item: i, file, live: isActive }));
    if (!isActive) continue;
    activeSprints.push(file);
    const inProgress = sprint.items.filter((i) => i.status === 'in_progress');
    if (inProgress.length > 1) {
      problems.push(`${file}: ${inProgress.length} items are in_progress (${inProgress.map((i) => i.id).join(', ')}); only one is allowed`);
    }
    for (const item of sprint.items) {
      if (liveIds.has(item.id)) {
        problems.push(`${item.id} exists in both ${liveIds.get(item.id)} and ${file}; an item has exactly one live copy`);
      } else {
        liveIds.set(item.id, file);
      }
    }
  }
  if (activeSprints.length > 1) {
    problems.push(`multiple active sprints (${activeSprints.join(', ')}); complete the old sprint before opening a new one`);
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
  const filePath = (input.tool_input && input.tool_input.file_path) || '';
  if (!/[\\/]cadence[\\/](backlog\.yml|sprint-\d+\.yml)$/.test(filePath)) process.exit(0);
  const cadenceDir = path.dirname(filePath);
  let problems;
  try {
    problems = validate(cadenceDir);
  } catch {
    process.exit(0); // validator error must never break the session
  }
  if (problems.length === 0) process.exit(0);
  process.stderr.write('cadence board validation failed:\n- ' + problems.join('\n- ') + '\n');
  process.exit(2);
});
