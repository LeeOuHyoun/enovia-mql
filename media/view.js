const vscode = acquireVsCodeApi();
const history = document.getElementById('history');
const statusNode = document.getElementById('status');
const statusText = document.getElementById('status-text');
const txNode = document.getElementById('tx');
const txCommit = document.getElementById('tx-commit');
const txAbort = document.getElementById('tx-abort');
const clearButton = document.getElementById('clear');
const restartButton = document.getElementById('restart');
const clearBar = document.querySelector('.bar');
const split = document.getElementById('split');
const runButton = document.getElementById('run');
const commandClear = document.getElementById('commandClear');
const composerGear = document.getElementById('composerGear');
const composerMenu = document.getElementById('composer-menu');
const lineNumbersItem = document.getElementById('line-numbers');
const composerToggle = document.getElementById('composerToggle');
const snippetButtons = document.querySelectorAll('#snippets button');
const jpo = document.getElementById('jpo');
const jpoToggle = document.getElementById('jpoToggle');
const jpoPath = document.getElementById('jpoPath');
const jpoBrowse = document.getElementById('jpoBrowse');
const jpoRun = document.getElementById('jpoRun');
const composer = document.getElementById('composer');
const gutter = document.getElementById('gutter');
const command = document.getElementById('command');
const recall = document.getElementById('recall');
const recallSplit = document.getElementById('recall-split');
const recallFilter = document.getElementById('recall-filter');
const recallClear = document.getElementById('recall-clear');
const recallList = document.getElementById('recall-list');
const dismissedRecall = new Set();
const assist = document.getElementById('assist');
const pick = document.getElementById('pick');
const findInput = document.getElementById('find-input');
const findCase = document.getElementById('find-case');
const findWord = document.getElementById('find-word');
const findRegex = document.getElementById('find-regex');
const findCount = document.getElementById('find-count');
const findPrev = document.getElementById('find-prev');
const findNext = document.getElementById('find-next');
const stage = document.getElementById('stage');
const rail = document.getElementById('rail');
const railHelp = document.getElementById('rail-help');
const railList = document.getElementById('rail-list');
const drawer = document.getElementById('drawer');
const drawerSplit = document.getElementById('drawer-split');
const helpTopic = document.getElementById('help-topic');
const helpFind = document.getElementById('help-find');
const helpView = document.getElementById('help-view');
const listKind = document.getElementById('list-kind');
const listFilter = document.getElementById('list-filter');
const listView = document.getElementById('list-view');
const drawerNote = document.getElementById('drawer-note');
const drawerRefresh = document.getElementById('drawer-refresh');
const drawerClose = document.getElementById('drawer-close');
const drawerWide = document.getElementById('drawer-wide');
const rowMenu = document.getElementById('row-menu');
const railCreate = document.getElementById('rail-create');
const createView = document.getElementById('create-view');
const cfType = document.getElementById('cf-type');
const cfPolicy = document.getElementById('cf-policy');
const cfVault = document.getElementById('cf-vault');
const cfAttrs = document.getElementById('cf-attrs');
const cfNote = document.getElementById('cf-note');
const cfPreview = document.getElementById('cf-preview');
const cfInsert = document.getElementById('cf-insert');
const cfRun = document.getElementById('cf-run');
const cfTypes = document.getElementById('cf-types');
const cfPolicies = document.getElementById('cf-policies');
const cfVaults = document.getElementById('cf-vaults');
const cfStates = document.getElementById('cf-states');
const cfModeOne = document.getElementById('cf-mode-one');
const cfModeGrid = document.getElementById('cf-mode-grid');
const cfRows = document.getElementById('cf-rows');
const cfRowsBody = cfRows.tBodies[0];
const cfAddRow = document.getElementById('cf-add-row');
const railEdit = document.getElementById('rail-edit');
const editView = document.getElementById('edit-view');
const efOid = document.getElementById('ef-oid');
const efType = document.getElementById('ef-type');
const efPolicy = document.getElementById('ef-policy');
const efVault = document.getElementById('ef-vault');
const efState = document.getElementById('ef-state');
const efAttrs = document.getElementById('ef-attrs');
const efNote = document.getElementById('ef-note');
const efPreview = document.getElementById('ef-preview');
const efDelete = document.getElementById('ef-delete');
const efInsert = document.getElementById('ef-insert');
const efRun = document.getElementById('ef-run');
const efPromote = document.getElementById('ef-promote');
const efDemote = document.getElementById('ef-demote');
const efWarn = document.getElementById('ef-warn');
const efUndo = document.getElementById('ef-undo');
const efUndoHead = document.getElementById('ef-undo-head');
const efUndoCopy = document.getElementById('ef-undo-copy');
const cfWarn = document.getElementById('cf-warn');
const ctxNode = document.getElementById('ctx');
const contextSnippet = document.querySelector('#snippets [data-insert="context"]');
const collapsed = new Set();
const gridOn = new Set();
const blockText = new Map();
const undoHints = new Map();
const FIND_WORD_SEPARATORS = "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?";
let findQuery = '';
let findIndex = 0;
let findMatchCase = false;
let findWholeWord = false;
let findUseRegex = false;
let findBad = false;
const phrases = [
  'temp query bus * * *',
  'temp query bus * * * select name id description',
  'temp query bus * * * where "attribute[???] == \'???\'"',
  'temp query bus * * * limit 0 orderby id select name id description',
  'query bus * * *',
  'print bus * * *',
  'print bus * * * select name id description',
  'print type',
  'print policy',
  'print attribute',
  'print relationship',
  'print person',
  'print program',
  'print command',
  'print menu',
  'print form',
  'print table system',
  'print channel',
  'print portal',
  'print page',
  'print context;',
  'list type',
  'list person',
  'list policy',
  'list attribute',
  'list relationship',
  'list program',
  'list vault',
  'list role',
  'list group',
  'list association',
  'list command',
  'list menu',
  'list form',
  'list table',
  'list channel',
  'list portal',
  'list page',
  'add bus',
  'add attribute',
  'add type',
  'add policy',
  'add relationship',
  'add command',
  'add menu',
  'add form',
  'add table',
  'add channel',
  'add portal',
  'add connection',
  'modify bus',
  'delete bus',
  'expand bus * * *',
  'expand bus * * * recurse to all select bus id current',
  'connect bus',
  'disconnect bus',
  'promote bus',
  'demote bus',
  'add property on program eServiceSchemaVariableMapping.tcl to',
  'set context user creator;',
  'verb on;',
  'verb off;',
  'insert prog',
  'compile prog',
  'start transaction;',
  'commit transaction;',
  'abort transaction;',
  'help;',
  'version;',
  'quit;',
  'exit;',
];
const DDL_TEMPLATES = new Map([
  ['add attribute', "add attribute '<attribute_name>' type <string|integer|real|date|boolean> description '<description>' default '<default_value>' notmultiline nothidden;"],
  ['add type', "add type '<type_name>' description '<description>' abstract <true|false> derived '<parent_type_name>' attribute '<attribute_name>';"],
  ['add policy', "add policy '<policy_name>' description '<description>' type '<type_name>' sequence '<sequence>' store '<store_name>' format generic state '<state_name>' revision <true|false> version <true|false> promote <true|false> public <access>;"],
  ['add relationship', "add relationship '<relationship_name>' description '<description>' nothidden from type '<from_type>' cardinality <one|many> revision <none|float|replicate> clone <none|float|replicate> to type '<to_type>' cardinality <one|many> revision <none|float|replicate> clone <none|float|replicate>;"],
  ['add command', "add command '<command_name>' description '<description>' label '<label_key>' href '<url_path>' setting 'Registered Suite' '<suite_name>' setting 'Target Location' '<content|popup|slidein>';"],
  ['add menu', "add menu '<menu_name>' description '<description>' label '<label_key>' setting 'Registered Suite' '<suite_name>' command '<command_name>';"],
  ['add form', "add form '<form_name>' web field name '<field_name>' label '<label_key>' businessobject '<expression>' setting 'Registered Suite' '<suite_name>' setting 'Field Type' '<basic|attribute>' setting 'Editable' '<true|false>';"],
  ['add table', "add table '<table_name>' system column name '<column_name>' label '<label_key>' businessobject '<expression>' sorttype '<none|alphanumeric|other>' setting 'Registered Suite' '<suite_name>';"],
  ['add channel', "add channel '<channel_name>' description '<description>' height '<height>' setting 'Registered Suite' '<suite_name>' command '<command_name>';"],
  ['add portal', "add portal '<portal_name>' description '<description>' setting 'Registered Suite' '<suite_name>' channel '<channel_name>';"],
  ['add bus', "add bus '<type>' '<name>' '<revision>' policy '<policy>' vault '<vault>';"],
  ['add connection', "add connection '<relationship>' from <from_id> to <to_id>;"],
  ['connect bus', "connect bus <from_id> relationship '<relationship>' to <to_id>;"],
]);
const PLACEHOLDER = /<[A-Za-z_][\w|,.]*>/g;
const OID = /\b\d+\.\d+\.\d+\.\d+\b/g;
const SECRET = /'[^']*'|"[^"]*"|(\bpassword\s+)('[^']*'|"[^"]*"|[^\s;'"]+)/gi;
const DEFAULT_CONTEXT = 'set context user creator;';
const SYMBOLIC_ADMINS = new Set([
  'attribute',
  'type',
  'policy',
  'relationship',
  'interface',
  'format',
  'store',
  'vault',
  'role',
  'group',
  'association',
  'program',
  'command',
  'menu',
  'form',
  'table',
  'channel',
  'portal',
  'page',
  'inquiry',
]);
const schemaCache = new Map();
let txActive = false;
let assistIndex = 0;
let assistMatches = [];
let pickText = '';
let drawerLane = '';
let helpRaw = '';
let helpQuery = '';
let helpFetchedTopic = null;
let sentHelpTopic = '';
let listRaw = '';
let listCut = 0;
let listFetchedKind = '';
let sentKind = 'type';
let sideBusy = false;
let sideHold = false;
let sideStarted = false;
let queuedSide = null;
let activeToken = 0;
let sideToken = 0;
let pendingLane = '';
let runningId = null;
let rowMenuText = '';
let hydrated = false;
let splitRatio = 0.6;
let recallWidth = 200;
let drawerWidth = 300;
let graphAvailable = false;
let contextCommand = DEFAULT_CONTEXT;
let stick = true;

function follow(force = false) {
  if (force) stick = true;
  if (stick) history.scrollTop = history.scrollHeight;
}

function maskSecret(text) {
  return text.replace(SECRET, (match, head) => (head ? `${head}****` : match));
}

function hasSecret(text) {
  return maskSecret(text) !== text;
}

function setContext(text) {
  const user = /\buser\s+(.+?)(?=\s+(?:role|vault)\b|$)/i.exec(text)?.[1] ?? '';
  const vault = /\bvault\s+(.+?)(?=\s+(?:user|role)\b|$)/i.exec(text)?.[1] ?? '';
  ctxNode.textContent = user ? [user, vault].filter(Boolean).join(' · ') : text;
  ctxNode.title = text ? `print context: ${text}` : '';
  ctxNode.hidden = !text;
}

function setContextCommand(text) {
  contextCommand = typeof text === 'string' && text.trim() ? text.trim() : DEFAULT_CONTEXT;
  contextSnippet.title = maskSecret(contextCommand);
}

function placeCommandClear() {
  const bar = Math.max(0, command.offsetWidth - command.clientWidth);
  commandClear.style.right = (bar + 6) + 'px';
}

function syncCommandClear() {
  commandClear.disabled = command.disabled || command.value === '';
  placeCommandClear();
  syncGutter();
}

const commandUndo = [];
const commandRedo = [];
let commandEditKind = '';
let commandEditAt = 0;

function commandState() {
  return { value: command.value, start: command.selectionStart ?? 0, end: command.selectionEnd ?? 0 };
}

function recordCommand(kind = '') {
  const now = Date.now();
  const merge = kind !== '' && kind === commandEditKind && now - commandEditAt < 1000;
  commandEditKind = kind;
  commandEditAt = now;
  commandRedo.length = 0;
  if (merge) return;
  const top = commandUndo[commandUndo.length - 1];
  if (top && top.value === command.value) return;
  commandUndo.push(commandState());
  if (commandUndo.length > 200) commandUndo.shift();
}

function resetCommandHistory() {
  commandUndo.length = 0;
  commandRedo.length = 0;
  commandEditKind = '';
}

function stepCommandHistory(redo) {
  const state = (redo ? commandRedo : commandUndo).pop();
  if (!state || command.disabled) return;
  (redo ? commandUndo : commandRedo).push(commandState());
  commandEditKind = '';
  closeAssist();
  command.value = state.value;
  command.setSelectionRange(state.start, state.end);
  syncCommandClear();
  savePrefs();
}

function editKind(event) {
  const type = event.inputType;
  if (type === 'insertText' || type === 'insertCompositionText') return /\s/.test(event.data ?? '') ? '' : 'insert';
  if (type === 'deleteContentBackward' || type === 'deleteContentForward') return type;
  return '';
}

function clearCommand() {
  if (command.disabled || command.value === '') return;
  closeAssist();
  recordCommand();
  command.value = '';
  syncCommandClear();
  command.focus();
  savePrefs();
}

function syncTx() {
  const busy = sideBusy || history.querySelector('.block.pending') !== null;
  txNode.hidden = !txActive;
  txCommit.disabled = command.disabled || busy;
  txAbort.disabled = command.disabled || busy;
}

function updateTxFromCommand(cmd, hasErr = false) {
  if (hasErr) return;
  const norm = cmd.trim().replace(/\s+/g, ' ').toLowerCase();
  if (/^start transaction(\s+(read|write))?\s*;$/.test(norm)) {
    txActive = true;
    syncTx();
  } else if (/^(commit|abort) transaction\s*;$/.test(norm)) {
    txActive = false;
    syncTx();
  }
}

function recomputeTx(blocks) {
  txActive = false;
  for (const block of blocks) {
    updateTxFromCommand(block.command, hasErrorLine(cleanResult(block.result || '')));
    if (block.reset) txActive = false;
  }
  syncTx();
}

function isBusy() {
  return sideBusy || history.querySelector('.block.pending') !== null;
}

function syncStatus() {
  const hasNotices = history.querySelector('.notice') !== null;
  const busy = isBusy();
  runButton.disabled = command.disabled || busy;
  for (const button of history.querySelectorAll('.block-rerun, .block-hint:not(.block-undo) button')) {
    button.disabled = command.disabled || busy;
  }
  syncTx();
  if (busy) {
    statusNode.dataset.state = 'running';
    statusText.textContent = '실행 중';
    return;
  }
  if (!command.disabled) {
    statusNode.dataset.state = 'ready';
    statusText.textContent = '준비됨';
    return;
  }
  if (hasNotices) {
    statusNode.dataset.state = 'error';
    statusText.textContent = '세션 확인';
    return;
  }
  statusNode.dataset.state = 'connecting';
  statusText.textContent = '연결 중';
}

function setInputEnabled(enabled) {
  const wasEnabled = !command.disabled;
  command.disabled = !enabled;
  runButton.disabled = !enabled;
  for (const button of snippetButtons) button.disabled = !enabled;
  jpoToggle.disabled = !enabled;
  jpoPath.disabled = !enabled;
  jpoBrowse.disabled = !enabled;
  if (enabled || !sideBusy) sideHold = false;
  syncCommandClear();
  syncJpoPath();
  syncDrawerControls();
  syncStatus();
  if (!enabled) closeAssist();
  if (enabled && !wasEnabled && document.hasFocus()) {
    const active = document.activeElement;
    if (!drawer.contains(active)) command.focus();
  }
  syncCreate();
  syncEdit();
  if (!enabled) return;
  flushQueuedSide();
  pumpMeta();
}

function setClearEnabled(enabled) {
  clearButton.disabled = !enabled;
  syncStatus();
}

function noticeNode(text) {
  const node = document.createElement('p');
  node.className = 'notice';
  node.textContent = text;
  return node;
}

function foldIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '3.8 4.7 8.4 5.6');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M4.2 6.2 8 9.8 11.8 6.2 10.7 5.1 8 7.8 5.3 5.1z');
  svg.append(path);
  return svg;
}

function paintMarked(node, text, query, className) {
  if (!query) {
    node.textContent = text;
    return;
  }
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const frag = document.createDocumentFragment();
  let from = 0;
  let at = lower.indexOf(q, from);
  while (at !== -1) {
    if (at > from) frag.append(document.createTextNode(text.slice(from, at)));
    const mark = document.createElement('mark');
    mark.className = className;
    mark.textContent = text.slice(at, at + q.length);
    frag.append(mark);
    from = at + q.length;
    at = lower.indexOf(q, from);
  }
  frag.append(document.createTextNode(text.slice(from)));
  node.replaceChildren(frag);
}

function isFindWordChar(code) {
  if (code <= 32) return false;
  return FIND_WORD_SEPARATORS.indexOf(String.fromCharCode(code)) === -1;
}

function findWordBounded(text, start, length) {
  if (start > 0) {
    const before = text.charCodeAt(start - 1);
    if (isFindWordChar(before) && (length === 0 || isFindWordChar(text.charCodeAt(start)))) return false;
  }
  const end = start + length;
  if (end < text.length) {
    const after = text.charCodeAt(end);
    if (isFindWordChar(after) && (length === 0 || isFindWordChar(text.charCodeAt(end - 1)))) return false;
  }
  return true;
}

function literalFindSpans(text, query, matchCase, wholeWord) {
  const spans = [];
  const hay = matchCase ? text : text.toLowerCase();
  const needle = matchCase ? query : query.toLowerCase();
  let from = 0;
  let at = hay.indexOf(needle, from);
  while (at !== -1) {
    if (!wholeWord || findWordBounded(text, at, needle.length)) spans.push([at, at + needle.length]);
    from = at + needle.length;
    at = hay.indexOf(needle, from);
  }
  return spans;
}

function regexFindSpans(text, query, matchCase, wholeWord) {
  const flags = matchCase ? 'gum' : 'gium';
  let pattern;
  try {
    pattern = new RegExp(query, flags);
  } catch {
    return null;
  }
  const spans = [];
  const limit = text.length + 1;
  let steps = 0;
  let match = pattern.exec(text);
  while (match) {
    const start = match.index;
    const length = match[0].length;
    if (length === 0) {
      pattern.lastIndex = start + 1;
    } else {
      if (!wholeWord || findWordBounded(text, start, length)) spans.push([start, start + length]);
      if (pattern.lastIndex <= start) pattern.lastIndex = start + length;
    }
    steps += 1;
    if (steps > limit) break;
    match = pattern.exec(text);
  }
  return spans;
}

function findSpans(text, query, matchCase, wholeWord, useRegex) {
  if (!query) return [];
  if (useRegex) return regexFindSpans(text, query, matchCase, wholeWord);
  return literalFindSpans(text, query, matchCase, wholeWord);
}

function appendLinked(parent, text) {
  let from = 0;
  for (const match of text.matchAll(OID)) {
    if (match.index > from) parent.append(text.slice(from, match.index));
    const link = document.createElement('span');
    link.className = 'oid';
    link.textContent = match[0];
    parent.append(link);
    from = match.index + match[0].length;
  }
  if (from < text.length) parent.append(text.slice(from));
}

function paintRange(parent, text, from, to, marks) {
  let at = from;
  for (const [start, end] of marks) {
    if (start < at || end > to) continue;
    if (start > at) parent.append(text.slice(at, start));
    const mark = document.createElement('mark');
    mark.className = 'hit';
    mark.textContent = text.slice(start, end);
    parent.append(mark);
    at = end;
  }
  if (at < to) parent.append(text.slice(at, to));
}

function paintSpans(node, text, spans, linked = false) {
  if (!linked && (!spans || spans.length === 0)) {
    node.textContent = text;
    return;
  }
  const marks = [];
  for (const [start, end] of spans || []) {
    if (start >= (marks.at(-1)?.[1] ?? 0)) marks.push([start, end]);
  }
  const frag = document.createDocumentFragment();
  let from = 0;
  for (const match of linked ? text.matchAll(OID) : []) {
    const start = match.index;
    const end = start + match[0].length;
    if (marks.some(([s, e]) => s < end && e > start && (s < start || e > end))) continue;
    paintRange(frag, text, from, start, marks);
    const link = document.createElement('span');
    link.className = 'oid';
    paintRange(link, text, start, end, marks);
    frag.append(link);
    from = end;
  }
  paintRange(frag, text, from, text.length, marks);
  node.replaceChildren(frag);
}

function paintText(node, text) {
  if (!findQuery || findBad) {
    node.textContent = text;
    return;
  }
  paintSpans(node, text, findSpans(text, findQuery, findMatchCase, findWholeWord, findUseRegex));
}

function cleanResult(raw) {
  if (!raw) return '';
  const lines = raw.split(/\r\n|\n|\r/);
  while (lines.length > 0 && (lines[lines.length - 1].trim() === '' || isPromptTail(lines[lines.length - 1]))) {
    lines.pop();
  }
  const kept = [];
  for (const line of lines) {
    if (isPromptLine(line)) continue;
    kept.push(line);
  }
  while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop();
  return kept.join('\n');
}

const PASSWORD_PROMPT = /(?:Enter\s+)?Password\s*:\s*$/i;
const ERROR_LINE =/^\s*(?:(?:System\s+|MQL\s+|Connect\s+|Syntax\s+|Parse\s+|Database\s+|Severe\s+|Fatal\s+)?Error(?:\s*:|\s+#\d+)|#\d{4,}\s*:)/im;

function hasErrorLine(text) {
  return ERROR_LINE.test(text);
}

function paintResult(node, raw) {
  const text = cleanResult(raw);
  const block = node.closest('.block');
  if (block) block.classList.toggle('error', hasErrorLine(text));
  if (findQuery && !findBad) {
    paintSpans(node, text, findSpans(text, findQuery, findMatchCase, findWholeWord, findUseRegex), true);
    return;
  }
  if (!text) {
    node.textContent = '';
    return;
  }
  const lines = text.split('\n');
  const frag = document.createDocumentFragment();
  for (let i = 0; i < lines.length; i += 1) {
    if (i > 0) frag.append(document.createTextNode('\n'));
    const line = lines[i];
    if (ERROR_LINE.test(line)) {
      const span = document.createElement('span');
      span.className = 'res-err';
      appendLinked(span, line);
      frag.append(span);
      continue;
    }
    if (/^\s*(?:Warning\s*:|#\d+\s*:\s*Warning\b)/i.test(line)) {
      const span = document.createElement('span');
      span.className = 'res-warn';
      appendLinked(span, line);
      frag.append(span);
      continue;
    }
    const kv = line.match(/^(\s*[A-Za-z0-9_.\-[\]]+\s*=\s*)(.+)$/);
    if (kv) {
      const keySpan = document.createElement('span');
      keySpan.className = 'res-key';
      keySpan.textContent = kv[1];
      frag.append(keySpan);
      appendLinked(frag, kv[2]);
      continue;
    }
    appendLinked(frag, line);
  }
  node.replaceChildren(frag);
}

function paintBlock(item) {
  const text = blockText.get(item.dataset.id);
  if (!text) return;
  paintText(item.querySelector('.command'), text.command);
  paintResult(item.querySelector('.result'), text.result);
}

function repaintBlocks() {
  for (const item of history.querySelectorAll('.block')) paintBlock(item);
}

function pruneBlockState() {
  const ids = new Set();
  for (const item of history.querySelectorAll('.block')) ids.add(item.dataset.id);
  for (const id of blockText.keys()) if (!ids.has(id)) blockText.delete(id);
  for (const id of collapsed) if (!ids.has(id)) collapsed.delete(id);
  for (const id of gridOn) if (!ids.has(id)) gridOn.delete(id);
  for (const id of undoHints.keys()) if (!ids.has(id)) undoHints.delete(id);
}

function setFolded(block, folded) {
  const id = block.dataset.id;
  if (folded) collapsed.add(id);
  else collapsed.delete(id);
  block.classList.toggle('collapsed', folded);
  const fold = block.querySelector('.fold');
  const label = folded ? '펼치기' : '접기';
  fold.title = label;
  fold.setAttribute('aria-label', label);
  fold.setAttribute('aria-expanded', folded ? 'false' : 'true');
}

function revealHit(mark) {
  const block = mark.closest('.block');
  if (block && mark.closest('.result') && block.classList.contains('collapsed')) setFolded(block, false);
  if (block && mark.closest('.result') && block.classList.contains('grid')) setGrid(block, false);
  scrollToNode(mark);
}

function compileFind() {
  findBad = findQuery !== '' && findUseRegex && regexFindSpans('', findQuery, findMatchCase, false) === null;
}

function syncFind(scroll) {
  findInput.classList.toggle('invalid', findBad);
  const hits = history.querySelectorAll('.hit');
  const total = hits.length;
  if (total === 0) findIndex = 0;
  else if (findIndex >= total) findIndex = total - 1;
  else if (findIndex < 0) findIndex = 0;
  for (let index = 0; index < total; index += 1) hits[index].classList.toggle('on', index === findIndex);
  if (scroll && total > 0) revealHit(hits[findIndex]);
  findCount.textContent = findQuery === '' ? '' : total === 0 ? '0/0' : `${findIndex + 1}/${total}`;
  findPrev.disabled = total === 0;
  findNext.disabled = total === 0;
}

function applyFind(scroll) {
  compileFind();
  repaintBlocks();
  syncFind(scroll);
}

function setFindQuery(value) {
  const next = value.trim();
  if (next === findQuery) return;
  findQuery = next;
  findIndex = 0;
  applyFind(next !== '');
}

function setFindOption(name, on) {
  if (name === 'case') findMatchCase = on;
  else if (name === 'word') findWholeWord = on;
  else findUseRegex = on;
  const button = name === 'case' ? findCase : name === 'word' ? findWord : findRegex;
  button.setAttribute('aria-pressed', on ? 'true' : 'false');
  findIndex = 0;
  applyFind(findQuery !== '');
}

function moveFind(step) {
  const total = history.querySelectorAll('.hit').length;
  if (total === 0) return;
  findIndex = (findIndex + step + total) % total;
  syncFind(true);
}

const paintQueue = new Set();
let paintFrame = 0;
let paintTimer = 0;
let paintCost = 0;

function queuePaint(id) {
  paintQueue.add(String(id));
  if (paintFrame || paintTimer) return;
  const wait = Math.min(1000, paintCost * 4);
  if (wait > 16) paintTimer = setTimeout(() => {
    paintTimer = 0;
    paintFrame = requestAnimationFrame(flushPaint);
  }, wait);
  else paintFrame = requestAnimationFrame(flushPaint);
}

function cancelPaint() {
  if (paintFrame) cancelAnimationFrame(paintFrame);
  if (paintTimer) clearTimeout(paintTimer);
  paintFrame = 0;
  paintTimer = 0;
  paintQueue.clear();
}

function flushPaint() {
  if (paintFrame) cancelAnimationFrame(paintFrame);
  if (paintTimer) clearTimeout(paintTimer);
  paintFrame = 0;
  paintTimer = 0;
  if (paintQueue.size === 0) return;
  const started = performance.now();
  for (const id of paintQueue) {
    const stored = blockText.get(id);
    const result = findResult(id);
    if (stored && result) paintResult(result, stored.result);
  }
  paintQueue.clear();
  if (findQuery) syncFind(false);
  follow();
  paintCost = performance.now() - started;
}

function recomputeAllTx() {
  const blocks = [];
  for (const item of history.querySelectorAll('.block')) {
    const b = blockText.get(item.dataset.id);
    if (b) blocks.push(b);
  }
  recomputeTx(blocks);
}

function settleBlock(id) {
  if (String(runningId) === String(id)) runningId = null;
  const item = blockById(String(id));
  if (!item) {
    syncStatus();
    return;
  }
  item.classList.remove('pending');
  item.removeAttribute('aria-busy');
  syncStatus();
}

function waitNode() {
  const wait = document.createElement('div');
  wait.className = 'block-wait';
  const spin = document.createElement('span');
  spin.className = 'spinner';
  spin.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = '응답 대기';
  wait.append(spin, label);
  return wait;
}

function formatElapsed(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;
}

function blockNode(block) {
  const id = String(block.id);
  const commandText = block.command;
  const resultRaw = block.result || '';
  blockText.set(id, { command: commandText, result: resultRaw, reset: block.reset === true, secret: block.secret === true, elapsed: block.elapsed });
  const item = document.createElement('div');
  item.className = 'block';
  item.dataset.id = id;
  if (runningId != null && String(runningId) === id) {
    item.classList.add('pending');
    item.setAttribute('aria-busy', 'true');
  }
  const folded = collapsed.has(id);
  if (folded) item.classList.add('collapsed');
  const head = document.createElement('div');
  head.className = 'block-head';
  const fold = document.createElement('button');
  fold.type = 'button';
  fold.className = 'fold';
  const label = folded ? '펼치기' : '접기';
  fold.title = label;
  fold.setAttribute('aria-label', label);
  fold.setAttribute('aria-expanded', folded ? 'false' : 'true');
  fold.append(foldIcon());
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'command';
  paintText(button, commandText);
  const time = document.createElement('span');
  time.className = 'block-time';
  time.textContent = block.elapsed == null ? '' : formatElapsed(block.elapsed);
  const actions = document.createElement('div');
  actions.className = 'block-actions';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'block-copy';
  copyBtn.title = '결과 복사';
  copyBtn.setAttribute('aria-label', '결과 복사');
  copyBtn.append(recallIcon('M4 4v9h8V4H4zm1 1h6v7H5V5zm2-3h7v9h-1V3H7V2z'));
  const rerunBtn = document.createElement('button');
  rerunBtn.type = 'button';
  rerunBtn.className = 'block-rerun';
  rerunBtn.title = '다시 실행';
  rerunBtn.setAttribute('aria-label', '다시 실행');
  rerunBtn.disabled = command.disabled || sideBusy;
  rerunBtn.append(recallIcon('M4.5 2.5v11l9-5.5z'));
  const stopBtn = document.createElement('button');
  stopBtn.type = 'button';
  stopBtn.className = 'block-stop';
  stopBtn.title = '실행 중단';
  stopBtn.setAttribute('aria-label', '실행 중단');
  stopBtn.append(recallIcon('M4 4h8v8H4z'));
  const gridBtn = document.createElement('button');
  gridBtn.type = 'button';
  gridBtn.className = 'block-grid';
  gridBtn.hidden = true;
  gridBtn.append(recallIcon('M2 3h12v10H2V3zm1 1v2h4V4H3zm5 0v2h5V4H8zM3 7v2h4V7H3zm5 0v2h5V7H8zm-5 3v2h4v-2H3zm5 0v2h5v-2H8z'));
  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'block-open';
  openBtn.title = '편집기로 열기';
  openBtn.setAttribute('aria-label', '편집기로 열기');
  openBtn.append(recallIcon('M3 2h6.5L13 5.5V14H3V2zm1 1v10h8V6H9V3H4z'));
  actions.append(gridBtn, openBtn, copyBtn);
  if (!block.secret) actions.append(rerunBtn);
  actions.append(stopBtn);
  const result = document.createElement('pre');
  result.className = 'result';
  head.append(fold, button, time, actions);
  item.append(head, result, waitNode());
  if (block.reset) item.append(resetNode());
  paintResult(result, resultRaw);
  setGrid(item, gridOn.has(id));
  syncGridButton(item);
  return item;
}

function resetNode() {
  const node = document.createElement('p');
  node.className = 'block-reset';
  node.textContent = '세션을 다시 연결했습니다';
  return node;
}

const BUS_HEAD = ['type', 'name', 'revision'];

function dumpSeparator(cmd) {
  const m = cmd.match(/\bdump\b(?:\s+(?:'([^']*)'|"([^"]*)"|([^\s;'"]+)))?/i);
  if (!m) return '';
  const sep = m[1] ?? m[2] ?? m[3];
  return sep && !/^[a-z]+$/i.test(sep) ? sep : ',';
}

function selectNames(cmd) {
  const m = cmd.match(/\bselect\s+([\s\S]*?)(?=\s+(?:dump|recordsep|tcl|output|where|orderby|limit)\b|\s*;|$)/i);
  return m ? m[1].match(/(?:[^\s[\]'"]+|\[[^\]]*\]|'[^']*'|"[^"]*")+/g) || [] : [];
}

function dumpGrid(cmd, lines, sep) {
  const rows = lines.map((line) => line.split(sep));
  const width = Math.max(...rows.map((row) => row.length));
  if (width < 2) return null;
  const names = selectNames(cmd);
  const lead = width - names.length;
  const head = [];
  for (let i = 0; i < width; i += 1) {
    if (lead >= 0 && i >= lead) head.push(names[i - lead]);
    else if (lead === BUS_HEAD.length) head.push(BUS_HEAD[i]);
    else head.push(`#${i + 1}`);
  }
  return { head, rows };
}

function selectGrid(lines) {
  const head = ['object'];
  const index = new Map();
  const rows = [];
  let row = null;
  let key = '';
  for (const line of lines) {
    if (!/^\s/.test(line)) {
      row = [line.trim()];
      rows.push(row);
      key = '';
      continue;
    }
    const kv = line.match(/^\s+([^\s=](?:[^=]*?[^\s=])?)\s*=\s?(.*)$/);
    if (!kv) {
      if (row && key) row[index.get(key)] += `\n${line.trim()}`;
      continue;
    }
    if (!row) {
      row = [''];
      rows.push(row);
    }
    key = kv[1];
    if (!index.has(key)) {
      index.set(key, head.length);
      head.push(key);
    }
    const at = index.get(key);
    row[at] = row[at] == null ? kv[2] : `${row[at]}\n${kv[2]}`;
  }
  if (head.length < 2) return null;
  if (rows.length !== 1) return { head, rows };
  return { head: ['key', 'value'], rows: head.map((name, i) => [name, rows[0][i] ?? '']) };
}

function gridOf(stored) {
  const text = cleanResult(stored.result);
  if (!text || hasErrorLine(text)) return null;
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  const sep = dumpSeparator(stored.command);
  return sep ? dumpGrid(stored.command, lines, sep) : selectGrid(lines);
}

function gridTsv(grid) {
  const cell = (value) => (/[\t\n"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [grid.head, ...grid.rows].map((row) => grid.head.map((_, i) => cell(row[i] ?? '')).join('\t')).join('\n');
}

function gridNode(grid) {
  const wrap = document.createElement('div');
  wrap.className = 'result-grid';
  const table = document.createElement('table');
  const headRow = table.createTHead().insertRow();
  for (const name of grid.head) {
    const cell = document.createElement('th');
    cell.textContent = name;
    headRow.append(cell);
  }
  const body = table.createTBody();
  for (const row of grid.rows) {
    const line = body.insertRow();
    for (let i = 0; i < grid.head.length; i += 1) appendLinked(line.insertCell(), row[i] ?? '');
  }
  wrap.append(table);
  return wrap;
}

function blockContent(block) {
  const stored = block ? blockText.get(block.dataset.id) : null;
  if (!stored) return '';
  const grid = block.classList.contains('grid') ? gridOf(stored) : null;
  return grid ? gridTsv(grid) : cleanResult(stored.result) || stored.command;
}

function setGrid(block, on) {
  const id = block.dataset.id;
  const stored = blockText.get(id);
  const grid = on && stored && !block.classList.contains('pending') ? gridOf(stored) : null;
  block.querySelector('.result-grid')?.remove();
  if (grid) {
    gridOn.add(id);
    block.querySelector('.result').after(gridNode(grid));
  } else gridOn.delete(id);
  block.classList.toggle('grid', grid != null);
  const gridBtn = block.querySelector('.block-grid');
  const label = grid ? '텍스트로 보기' : '표로 보기';
  gridBtn.title = label;
  gridBtn.setAttribute('aria-label', label);
  gridBtn.setAttribute('aria-pressed', grid ? 'true' : 'false');
  const copyLabel = grid ? '표 복사 (TSV)' : '결과 복사';
  const copyBtn = block.querySelector('.block-copy');
  copyBtn.title = copyLabel;
  copyBtn.setAttribute('aria-label', copyLabel);
}

function syncGridButton(item) {
  const stored = blockText.get(item.dataset.id);
  item.querySelector('.block-grid').hidden = !stored || item.classList.contains('pending') || gridOf(stored) == null;
}

function sameCommand(a, b) {
  const norm = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase();
  return norm(a) === norm(b);
}

function symbolicTarget(cmd) {
  const m = cmd.trim().match(/^add\s+([a-z]+)\s+(?:'([^']+)'|"([^"]+)"|([^\s;'"]+))/i);
  if (!m) return null;
  const admin = m[1].toLowerCase();
  if (!SYMBOLIC_ADMINS.has(admin)) return null;
  const name = m[2] ?? m[3] ?? m[4];
  const target = formatSchemaName(name);
  if (!target) return null;
  const suffix = admin === 'table' ? ' system' : '';
  return { admin, name, cmd: `add property ${admin}_${name.replace(/\s+/g, '')} on program eServiceSchemaVariableMapping.tcl to ${admin} ${target}${suffix};` };
}

let symbolics = null;
let symbolicsFailed = false;
let symbolicsLoad = null;
let symbolicsGen = 0;

function parseSymbolics(raw) {
  const map = new Map();
  for (const line of cleanResult(raw).split('\n')) {
    const m = line.trim().match(/^(\S+)\s+on\s+program\s+\S+\s+to\s+(\w+)\s+(.+?)\s*$/);
    if (!m) continue;
    const name = m[3].replace(/\s+system$/i, '').replace(/^(['"])(.*)\1$/, '$2');
    map.set(`${m[2].toLowerCase()} ${name}`, m[1]);
  }
  return map;
}

function loadSymbolics() {
  const gen = symbolicsGen;
  symbolicsLoad ??= requestMeta('list property on program eServiceSchemaVariableMapping.tcl').then((raw) => {
    if (gen !== symbolicsGen) return null;
    if (raw == null || hasErrorLine(cleanResult(raw))) symbolicsFailed = true;
    else symbolics = parseSymbolics(raw);
    return symbolics;
  });
  return symbolicsLoad;
}

function forgetSymbolics() {
  symbolicsGen += 1;
  symbolics = null;
  symbolicsFailed = false;
  symbolicsLoad = null;
}

function symbolicHint(item) {
  const stored = blockText.get(item.dataset.id);
  if (!stored || item.querySelector('.block-hint:not(.block-undo)')) return;
  const target = symbolicTarget(stored.command);
  if (!target || hasErrorLine(cleanResult(stored.result))) return;
  if ([...blockText.values()].some((b) => sameCommand(b.command, target.cmd))) return;
  if (!symbolics && !symbolicsFailed) {
    void loadSymbolics().then(() => {
      if (item.isConnected && (symbolics || symbolicsFailed)) symbolicHint(item);
    });
    return;
  }
  if (symbolics?.has(`${target.admin} ${target.name}`)) return;
  const cmd = target.cmd;
  const hint = document.createElement('div');
  hint.className = 'block-hint';
  hint.dataset.cmd = cmd;
  const label = document.createElement('span');
  label.textContent = cmd;
  const run = document.createElement('button');
  run.type = 'button';
  run.textContent = '심볼릭 등록';
  run.title = '심볼릭 이름을 eServiceSchemaVariableMapping.tcl 에 등록합니다';
  run.disabled = command.disabled || sideBusy;
  hint.append(label, run);
  item.append(hint);
}

function undoHint(item) {
  const undo = undoHints.get(item.dataset.id);
  if (!undo || item.querySelector('.block-undo')) return;
  const hint = document.createElement('div');
  hint.className = 'block-hint block-undo';
  hint.dataset.undo = undo.text;
  const label = document.createElement('span');
  label.textContent = `${undo.label}: ${undo.text}`;
  const insert = document.createElement('button');
  insert.type = 'button';
  insert.textContent = '입력창에 넣기';
  hint.append(label, insert);
  item.append(hint);
}

function render(state) {
  if ('runningId' in state) runningId = state.runningId == null ? null : state.runningId;
  if (!hydrated && state.prefs) hydratePrefs(state.prefs);
  graphAvailable = state.graph === true;
  setContext(typeof state.context === 'string' ? state.context : '');
  setContextCommand(state.contextCommand);
  const nodes = [];
  for (const notice of state.notices) nodes.push(noticeNode(notice));
  for (const block of state.blocks) nodes.push(blockNode(block));
  history.replaceChildren(...nodes);
  pruneBlockState();
  for (const item of history.querySelectorAll('.block:not(.pending)')) {
    symbolicHint(item);
    undoHint(item);
  }
  ensureRecall(state.blocks);
  markRecall();
  recomputeTx(state.blocks);
  setInputEnabled(state.inputEnabled);
  setClearEnabled(state.clearEnabled);
  follow(true);
  syncFind(false);
}

function collectRecalls() {
  const items = [];
  for (const row of recallList.children) {
    const text = (row.dataset.text || '').trim();
    if (!text) continue;
    const pinned = row.classList.contains('pinned');
    items.push(pinned ? { text, pinned: true } : { text });
  }
  return items;
}

function savePrefs() {
  if (!hydrated) return;
  const open = document.body.classList.contains('drawer-open');
  vscode.postMessage({
    type: 'prefs',
    prefs: {
      recalls: collectRecalls(),
      jpoOpen: jpo.classList.contains('on'),
      jpoPath: jpoPath.value,
      commandText: hasSecret(command.value) ? '' : command.value,
      splitRatio,
      recallWidth,
      drawerWidth,
      composerHidden: document.body.classList.contains('composer-hidden'),
      historyHidden: document.body.classList.contains('history-hidden'),
      lineNumbers: document.body.classList.contains('line-numbers'),
      drawerLane: open ? drawerLane : '',
      helpTopic: helpTopic.value,
      listKind: listKind.value,
    },
  });
}

function hydratePrefs(prefs) {
  if (!prefs || hydrated) return;
  if (typeof prefs.jpoPath === 'string') jpoPath.value = prefs.jpoPath;
  syncJpoPath();
  setJpoOpen(Boolean(prefs.jpoOpen));
  if (typeof prefs.commandText === 'string' && command.value === '') command.value = prefs.commandText;
  syncCommandClear();
  if (typeof prefs.recallWidth === 'number') setRecallWidth(prefs.recallWidth);
  if (typeof prefs.drawerWidth === 'number') setDrawerWidth(prefs.drawerWidth);
  if (typeof prefs.splitRatio === 'number') applySplit(prefs.splitRatio);
  if (prefs.composerHidden) setComposerHidden(true);
  if (prefs.lineNumbers) setLineNumbers(true);
  if (prefs.historyHidden) {
    document.body.classList.add('history-hidden');
    syncHistory();
  }
  if (typeof prefs.helpTopic === 'string') {
    for (const option of helpTopic.options) {
      if (option.value === prefs.helpTopic) {
        helpTopic.value = prefs.helpTopic;
        break;
      }
    }
  }
  if (typeof prefs.listKind === 'string' && prefs.listKind) {
    listKind.value = prefs.listKind;
    sentKind = listKind.value;
  }
  if (prefs.drawerLane === 'help' || prefs.drawerLane === 'list' || prefs.drawerLane === 'create' || prefs.drawerLane === 'edit') {
    drawerLane = prefs.drawerLane;
    setDrawerOpen(true);
  }
  if (Array.isArray(prefs.recalls)) {
    const rows = [];
    for (const item of prefs.recalls) {
      if (!item || typeof item.text !== 'string' || !item.text.trim()) continue;
      const row = recallNode('', item.text.trim(), Boolean(item.pinned));
      row.hidden = !matchRecall(row);
      rows.push(row);
    }
    recallList.replaceChildren(...rows);
    syncRecallClear();
  }
  hydrated = true;
  syncFieldClears();
}

function recallIcon(d) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

function syncPinButton(button, pinned) {
  const label = pinned ? '고정 해제' : '고정';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', pinned ? 'true' : 'false');
}

function recallNode(id, text, pinned = false) {
  const row = document.createElement('div');
  row.className = pinned ? 'recall-row pinned' : 'recall-row';
  row.dataset.id = id == null ? '' : String(id);
  row.dataset.text = text;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'recall';
  button.textContent = text;
  button.title = text;
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'recall-pin';
  syncPinButton(pin, pinned);
  pin.append(recallIcon('M9.8 1.5 14.5 6.2 13.4 7.3 12.1 6 9.3 8.8 10.2 11.7 9.1 12.8 6.2 9.9 2.6 13.5 1.8 12.7 5.4 9.1 2.5 6.2 3.6 5.1 6.5 6 9.3 3.2 8 1.9z'));
  const insert = document.createElement('button');
  insert.type = 'button';
  insert.className = 'recall-insert';
  insert.title = '입력';
  insert.setAttribute('aria-label', '입력');
  insert.append(recallIcon('M9 2.8 3.6 8 9 13.2V9.6h5.2V6.4H9V2.8z'));
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'recall-delete';
  remove.title = '삭제';
  remove.setAttribute('aria-label', '삭제');
  remove.append(recallIcon('M6 1.6h4l.8 1.5H14v1.3H2V3.1h3.2L6 1.6zM3.3 5.6h9.4l-.7 8.6H4l-.7-8.6z'));
  row.append(button, pin, insert, remove);
  return row;
}

function placeUnpinnedRow(row) {
  const pinnedRows = recallList.querySelectorAll('.recall-row.pinned');
  if (pinnedRows.length > 0) pinnedRows[pinnedRows.length - 1].after(row);
  else recallList.prepend(row);
}

function toggleRecallPin(row) {
  const pinned = !row.classList.contains('pinned');
  row.classList.toggle('pinned', pinned);
  const pin = row.querySelector('.recall-pin');
  if (pin) syncPinButton(pin, pinned);
  if (pinned) recallList.prepend(row);
  else placeUnpinnedRow(row);
  syncRecallClear();
  savePrefs();
}

function recallQuery() {
  return recallFilter.value.trim().toLowerCase();
}

function matchRecall(row) {
  const query = recallQuery();
  if (!query) return true;
  return (row.dataset.text || '').toLowerCase().includes(query);
}

function applyRecallFilter() {
  for (const row of recallList.children) row.hidden = !matchRecall(row);
}

function syncRecallClear() {
  recallClear.disabled = recallList.querySelector('.recall-row:not(.pinned)') === null;
}

function addRecall(id, text, persist = true) {
  const key = String(id);
  for (const item of recallList.children) {
    if (item.dataset.text !== text) continue;
    item.dataset.id = key;
    item.classList.remove('missing');
    if (!item.classList.contains('pinned')) placeUnpinnedRow(item);
    if (persist) savePrefs();
    return;
  }
  if (dismissedRecall.has(key)) return;
  const row = recallNode(id, text, false);
  placeUnpinnedRow(row);
  row.hidden = !matchRecall(row);
  if (!row.hidden && !row.classList.contains('pinned')) recallList.scrollTop = 0;
  syncRecallClear();
  if (persist) savePrefs();
}

function dropRecall(row) {
  if (row.dataset.id) dismissedRecall.add(row.dataset.id);
  row.remove();
  syncRecallClear();
  savePrefs();
}

function clearRecall() {
  for (const item of [...recallList.querySelectorAll('.recall-row:not(.pinned)')]) {
    if (item.dataset.id) dismissedRecall.add(item.dataset.id);
    item.remove();
  }
  syncRecallClear();
  savePrefs();
}

function setRecallWidth(width) {
  const minRecall = 112;
  if (composer.clientWidth <= 0) {
    recallWidth = Math.max(minRecall, Math.round(width));
    recall.style.width = recallWidth + 'px';
    return;
  }
  const available = composer.clientWidth - recallSplit.offsetWidth;
  const maxRecall = Math.max(minRecall, available - 96);
  recallWidth = Math.round(Math.min(maxRecall, Math.max(minRecall, width)));
  recall.style.width = recallWidth + 'px';
}

function ensureRecall(blocks) {
  let changed = false;
  for (const block of blocks) {
    if (block.secret) continue;
    addRecall(block.id, block.command, false);
    changed = true;
  }
  if (changed) savePrefs();
}

function markRecall() {
  const ids = new Set();
  for (const item of history.querySelectorAll('.block')) ids.add(item.dataset.id);
  for (const item of recallList.children) item.classList.toggle('missing', !ids.has(item.dataset.id));
}

let historyAt = -1;
let historyDraft = '';
let historyItems = [];

function historyList() {
  const rows = [...recallList.children].filter((row) => row.dataset.text);
  const recent = rows.filter((row) => row.dataset.id).sort((a, b) => Number(b.dataset.id) - Number(a.dataset.id));
  return [...recent, ...rows.filter((row) => !row.dataset.id)].map((row) => row.dataset.text);
}

function isHistoryKey(event) {
  return event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey && !event.isComposing && (event.key === 'ArrowUp' || event.key === 'ArrowDown');
}

function stepHistory(step) {
  if (command.disabled) return;
  if (historyAt === -1) {
    historyItems = historyList();
    historyDraft = command.value;
  }
  const next = Math.min(historyItems.length - 1, Math.max(-1, historyAt + step));
  if (next === historyAt) return;
  historyAt = next;
  recordCommand();
  command.value = historyAt === -1 ? historyDraft : historyItems[historyAt];
  command.setSelectionRange(command.value.length, command.value.length);
  syncCommandClear();
  savePrefs();
}

function blockById(id) {
  for (const item of history.querySelectorAll('.block')) {
    if (item.dataset.id === id) return item;
  }
  return null;
}

function scrollToNode(node) {
  const deltaOf = () => {
    const parentRect = history.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const target = parentRect.top + Math.max(0, (parentRect.height - nodeRect.height) / 2);
    return nodeRect.top - target;
  };
  const delta = deltaOf();
  if (Math.abs(delta) < 1) return;
  const before = history.scrollTop;
  history.scrollTop = before + delta;
  if (Math.abs(deltaOf()) < Math.abs(delta)) return;
  history.scrollTop = before - delta;
  if (Math.abs(deltaOf()) < Math.abs(delta)) return;
  history.scrollTop = before;
}

function showCommand(block) {
  const link = block.querySelector('.command');
  const previous = history.querySelector('.command.current');
  if (previous && previous !== link) previous.classList.remove('current');
  const node = link ?? block;
  if (link) link.classList.add('current');
  scrollToNode(node);
}

function findResult(id) {
  const items = history.querySelectorAll('.block');
  for (const item of items) {
    if (item.dataset.id === String(id)) return item.querySelector('.result');
  }
  return null;
}

function caretOffset() {
  if (command.selectionDirection === 'backward') return command.selectionStart ?? 0;
  return command.selectionEnd ?? command.value.length;
}

const MQL_STARTERS = new Set([
  'temp',
  'query',
  'print',
  'expand',
  'list',
  'add',
  'modify',
  'delete',
  'connect',
  'disconnect',
  'promote',
  'demote',
  'set',
  'insert',
  'start',
  'commit',
  'abort',
  'help',
  'version',
  'quit',
  'exit',
  'exec',
  'execute',
  'eval',
  'evaluate',
  'run',
  'compile',
  'approve',
  'reject',
  'ignore',
  'enable',
  'disable',
  'override',
  'trigger',
  'push',
  'pop',
  'history',
  'clear',
  'copy',
  'move',
  'transfer',
  'lock',
  'unlock',
  'checkin',
  'checkout',
  'verb',
  'verbose',
  'mod',
  'del',
]);

const MQL_HEADER_TARGETS = new Set([
  'bus',
  'businessobject',
  'connection',
  'type',
  'policy',
  'attribute',
  'relationship',
  'person',
  'program',
  'prog',
  'command',
  'menu',
  'form',
  'vault',
  'role',
  'group',
  'association',
  'context',
  'transaction',
  'channel',
  'portal',
  'table',
  'system',
  'page',
  'index',
  'store',
  'site',
  'dimension',
  'expression',
  'rule',
]);

function tokenizeMql(text) {
  const tokens = [];
  let i = 0;
  const len = text.length;
  while (i < len) {
    const ch = text[i];
    if (ch === '\r' || ch === '\n') {
      let j = i + 1;
      while (j < len && (text[j] === '\r' || text[j] === '\n')) j += 1;
      tokens.push({ type: 'newline', value: '\n', start: i, end: j });
      i = j;
      continue;
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === ';') {
      tokens.push({ type: 'semi', value: ';', start: i, end: i + 1 });
      i += 1;
      continue;
    }
    let j = i;
    let quote = '';
    let bracketDepth = 0;
    while (j < len) {
      const c = text[j];
      if (quote) {
        if (c === '\\' && j + 1 < len) {
          j += 2;
          continue;
        }
        if (c === quote) quote = '';
        j += 1;
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        j += 1;
        continue;
      }
      if (c === '[') {
        bracketDepth += 1;
        j += 1;
        continue;
      }
      if (c === ']') {
        if (bracketDepth > 0) bracketDepth -= 1;
        j += 1;
        continue;
      }
      if (bracketDepth === 0 && (/\s/.test(c) || c === ';')) break;
      j += 1;
    }
    tokens.push({ type: 'word', value: text.slice(i, j), start: i, end: j });
    i = j;
  }
  return tokens;
}

function isStarterSequence(words, index) {
  const w0 = words[index]?.value.toLowerCase();
  if (!w0 || !MQL_STARTERS.has(w0)) return false;
  if (w0 === 'temp') return words[index + 1]?.value.toLowerCase() === 'query';
  return true;
}

function isSchemaDdl(words) {
  const w0 = words[0]?.value.toLowerCase() || '';
  const w1 = words[1]?.value.toLowerCase() || '';
  return (w0 === 'add' || w0 === 'modify' || w0 === 'mod') && MQL_HEADER_TARGETS.has(w1) && w1 !== 'bus' && w1 !== 'businessobject';
}

function continuesDdl(words, next) {
  if (!isSchemaDdl(words)) return false;
  if (next === 'add') return words[0].value.toLowerCase() !== 'add';
  return DDL_WORDS.has(next);
}

function splitMqlStatements(text) {
  const tokens = tokenizeMql(text);
  const statements = [];
  let current = [];
  let startOffset = -1;
  let endOffset = -1;
  let afterNewline = false;

  const flush = () => {
    if (current.length > 0) {
      statements.push({ words: current, start: startOffset, end: endOffset });
      current = [];
      startOffset = -1;
      endOffset = -1;
    }
    afterNewline = false;
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok.type === 'semi') {
      if (current.length > 0) {
        endOffset = tok.end;
        flush();
      }
      continue;
    }
    if (tok.type === 'newline') {
      if (current.length > 0) afterNewline = true;
      continue;
    }
    if (afterNewline && current.length > 0) {
      const restWords = [];
      for (let k = i; k < tokens.length && restWords.length < 2; k += 1) {
        if (tokens[k].type === 'semi' || tokens[k].type === 'newline') break;
        if (tokens[k].type === 'word') restWords.push(tokens[k]);
      }
      if (isStarterSequence(restWords, 0) && !continuesDdl(current, restWords[0].value.toLowerCase())) {
        flush();
      } else {
        afterNewline = false;
      }
    }
    if (current.length === 0) startOffset = tok.start;
    endOffset = tok.end;
    current.push(tok);
  }
  flush();
  return statements;
}

function minHeaderLength(words) {
  if (words.length === 0) return 0;
  const w0 = words[0].value.toLowerCase();
  const w1 = words[1]?.value.toLowerCase() || '';
  const w2 = words[2]?.value.toLowerCase() || '';
  if (w0 === 'temp' && w1 === 'query' && (w2 === 'bus' || w2 === 'businessobject')) return Math.min(words.length, 6);
  if (w0 === 'query' && (w1 === 'bus' || w1 === 'businessobject')) return Math.min(words.length, 5);
  if ((w0 === 'print' || w0 === 'expand' || w0 === 'modify' || w0 === 'mod' || w0 === 'add' || w0 === 'delete' || w0 === 'del' || w0 === 'promote' || w0 === 'demote' || w0 === 'connect' || w0 === 'disconnect') && (w1 === 'bus' || w1 === 'businessobject')) {
    if (words[2] && /^[0-9]+(\.[0-9]+)+$/.test(words[2].value)) return 3;
    return Math.min(words.length, 5);
  }
  if ((w0 === 'print' || w0 === 'list' || w0 === 'modify' || w0 === 'mod' || w0 === 'add' || w0 === 'delete' || w0 === 'del') && MQL_HEADER_TARGETS.has(w1)) {
    if ((w1 === 'form' || w1 === 'table') && words[3] && /^(web|system)$/i.test(words[3].value)) {
      return Math.min(words.length, 4);
    }
    return Math.min(words.length, w1 === 'context' ? 2 : 3);
  }
  return 1;
}

const DDL_L1_BREAKS = new Set([
  'description',
  'type',
  'sequence',
  'store',
  'format',
  'defaultformat',
  'state',
  'allstate',
  'from',
  'to',
  'field',
  'column',
  'abstract',
  'derived',
  'attribute',
  'default',
  'multiline',
  'notmultiline',
  'hidden',
  'nothidden',
  'range',
  'trigger',
  'property',
  'setting',
  'command',
  'menu',
  'channel',
  'href',
  'alt',
  'height',
]);

const DDL_STATE_SUBS = new Set([
  'revision',
  'version',
  'promote',
  'checkouthistory',
  'public',
  'owner',
  'user',
  'filter',
  'action',
  'check',
  'trigger',
  'signature',
  'route',
]);

const DDL_REL_SUBS = new Set([
  'cardinality',
  'revision',
  'clone',
  'propagate',
  'meaning',
]);

const DDL_FIELD_SUBS = new Set([
  'name',
  'label',
  'businessobject',
  'relationship',
  'range',
  'href',
  'alt',
  'sorttype',
  'update',
]);

const DDL_WORDS = new Set([...DDL_L1_BREAKS, ...DDL_STATE_SUBS, ...DDL_REL_SUBS, ...DDL_FIELD_SUBS, 'add', 'remove']);

function isClauseBreak(words, idx, headerEnd) {
  if (idx < headerEnd) return false;
  const lower = words[idx].value.toLowerCase();
  const prev = words[idx - 1]?.value.toLowerCase() || '';
  if (prev === 'orderby' || prev === 'limit' || prev === 'dump' || prev === 'recordsep' || prev === 'recurse') return false;
  if (lower === 'where' || lower === 'select' || lower === 'orderby' || lower === 'limit' || lower === 'dump' || lower === 'recordsep' || lower === 'tcl' || lower === 'output') {
    return true;
  }
  const w0 = words[0].value.toLowerCase();
  const w1 = words[1]?.value.toLowerCase() || '';
  if (w0 === 'expand' && (lower === 'from' || lower === 'to' || lower === 'relationship' || lower === 'rel' || lower === 'type' || lower === 'recurse' || lower === 'terse')) {
    if ((lower === 'relationship' || lower === 'rel') && (prev === 'from' || prev === 'to')) return false;
    return true;
  }
  if ((w0 === 'temp' || w0 === 'query') && (lower === 'vault' || lower === 'owner')) {
    return true;
  }
  if ((w0 === 'modify' || w0 === 'mod' || w0 === 'add') && (w1 === 'bus' || w1 === 'businessobject') && (lower === 'description' || lower === 'policy' || lower === 'vault' || lower === 'owner' || lower === 'current' || lower === 'state')) {
    return true;
  }
  if (isSchemaDdl(words)) {
    if (prev === 'add' || prev === 'remove' || prev === 'modify' || prev === 'mod') return false;
    if (lower === 'add' || lower === 'remove') return true;
    if (DDL_L1_BREAKS.has(lower) || DDL_STATE_SUBS.has(lower) || DDL_REL_SUBS.has(lower) || DDL_FIELD_SUBS.has(lower)) return true;
  }
  return false;
}

function formatSingleStatement(words) {
  if (words.length === 0) return '';
  const headerEnd = minHeaderLength(words);
  const isDdl = isSchemaDdl(words);
  const lines = [];
  let currentLine = [];
  let currentIndent = '';
  let section = '';
  let inSelect = false;

  const indentFor = (lower) => {
    if (!isDdl) return '  ';
    if (lower === 'state' || lower === 'allstate' || lower === 'from' || lower === 'to' || lower === 'field' || lower === 'column') {
      section = lower;
      return '  ';
    }
    if ((section === 'state' || section === 'allstate') && (DDL_STATE_SUBS.has(lower) || lower === 'property')) return '    ';
    if ((section === 'from' || section === 'to') && (DDL_REL_SUBS.has(lower) || lower === 'type' || lower === 'relationship')) return '    ';
    if ((section === 'field' || section === 'column') && (DDL_FIELD_SUBS.has(lower) || lower === 'setting' || lower === 'user')) return '    ';
    if (DDL_L1_BREAKS.has(lower)) {
      section = '';
      return '  ';
    }
    return section ? '    ' : '  ';
  };

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i].value;
    const lower = word.toLowerCase();
    const shouldBreak = isClauseBreak(words, i, headerEnd) && !(inSelect && lower !== 'where' && lower !== 'dump' && lower !== 'recordsep' && lower !== 'tcl' && lower !== 'output' && lower !== 'orderby' && lower !== 'limit');

    if (shouldBreak && currentLine.length > 0) {
      lines.push(lines.length === 0 ? currentLine.join(' ') : currentIndent + currentLine.join(' '));
      currentLine = [];
      currentIndent = indentFor(lower);
      inSelect = lower === 'select';
    } else if (i >= headerEnd && lower === 'select') {
      inSelect = true;
    }

    currentLine.push(word);
  }

  if (currentLine.length > 0) {
    lines.push(lines.length === 0 ? currentLine.join(' ') : currentIndent + currentLine.join(' '));
  }

  const joined = lines.join('\n');
  return joined.endsWith(';') ? joined : `${joined};`;
}

function formatMqlText(text) {
  const statements = splitMqlStatements(text);
  if (statements.length === 0) return '';
  return statements.map((stmt) => formatSingleStatement(stmt.words)).join('\n\n');
}

function flattenStatement(words) {
  if (words.length === 0) return '';
  const line = words.map((w) => w.value).join(' ');
  return line.endsWith(';') ? line : `${line};`;
}

function formatCommand() {
  if (command.disabled) return;
  closeAssist();
  const value = command.value;
  if (!value.trim()) return;
  const start = command.selectionStart ?? 0;
  const end = command.selectionEnd ?? start;
  if (start !== end) {
    const selected = value.slice(start, end);
    if (!selected.trim()) return;
    const formatted = formatMqlText(selected);
    if (!formatted) return;
    recordCommand();
    command.value = value.slice(0, start) + formatted + value.slice(end);
    command.selectionStart = start;
    command.selectionEnd = start + formatted.length;
  } else {
    const formatted = formatMqlText(value);
    if (!formatted) return;
    recordCommand();
    command.value = formatted;
    const caret = formatted.length;
    command.selectionStart = caret;
    command.selectionEnd = caret;
  }
  syncCommandClear();
  command.focus();
  savePrefs();
}

function applyJoin(text, selStart, selEnd) {
  const lines = text.split('\n');
  const lineStarts = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }
  const posAt = (index) => {
    let line = 0;
    for (let i = 1; i < lineStarts.length; i += 1) {
      if (lineStarts[i] <= index) line = i;
      else break;
    }
    return { line: line + 1, column: index - lineStarts[line] + 1 };
  };
  const startPos = posAt(selStart);
  const endPos = posAt(selEnd);
  const isEmpty = selStart === selEnd;
  const startLineNumber = startPos.line;
  let endLineNumber;
  if (isEmpty || startPos.line === endPos.line) {
    endLineNumber = startLineNumber < lines.length ? startLineNumber + 1 : startLineNumber;
  } else {
    endLineNumber = endPos.line;
  }
  const selectionEndOffset = lines[endPos.line - 1].length - endPos.column;
  let trimmed = lines[startLineNumber - 1];
  let columnDeltaOffset = 0;
  for (let i = startLineNumber + 1; i <= endLineNumber; i += 1) {
    const lineText = lines[i - 1];
    const contentAt = lineText.search(/\S/);
    if (contentAt >= 0) {
      let insertSpace = trimmed !== '';
      if (insertSpace && (trimmed.charAt(trimmed.length - 1) === ' ' || trimmed.charAt(trimmed.length - 1) === '\t')) {
        insertSpace = false;
        trimmed = trimmed.replace(/[\s\uFEFF\xA0]+$/g, ' ');
      }
      const lineTextWithoutIndent = lineText.substring(contentAt);
      trimmed += (insertSpace ? ' ' : '') + lineTextWithoutIndent;
      columnDeltaOffset = lineTextWithoutIndent.length + (insertSpace ? 1 : 0);
    } else {
      columnDeltaOffset = 0;
    }
  }
  const replaceFrom = lineStarts[startLineNumber - 1];
  const replaceTo = lineStarts[endLineNumber - 1] + lines[endLineNumber - 1].length;
  if (replaceFrom === replaceTo) return null;
  const next = text.slice(0, replaceFrom) + trimmed + text.slice(replaceTo);
  let newStart;
  let newEnd;
  if (isEmpty) {
    newStart = replaceFrom + trimmed.length - columnDeltaOffset;
    newEnd = newStart;
  } else if (startPos.line === endPos.line) {
    newStart = replaceFrom + startPos.column - 1;
    newEnd = replaceFrom + endPos.column - 1;
  } else {
    newStart = replaceFrom + startPos.column - 1;
    newEnd = replaceFrom + trimmed.length - selectionEndOffset - 1;
  }
  const clamp = (index) => Math.min(Math.max(0, index), next.length);
  newStart = clamp(newStart);
  newEnd = clamp(newEnd);
  if (newStart > newEnd) {
    const swap = newStart;
    newStart = newEnd;
    newEnd = swap;
  }
  if (next === text && newStart === selStart && newEnd === selEnd) return null;
  return { text: next, start: newStart, end: newEnd, from: replaceFrom, to: replaceTo, insert: trimmed };
}

function joinLines() {
  if (command.disabled || isOtherInput(document.activeElement)) return;
  const value = command.value;
  const start = command.selectionStart ?? 0;
  const end = command.selectionEnd ?? start;
  const joined = applyJoin(value, start, end);
  if (!joined) return;
  closeAssist();
  if (joined.text !== value) {
    recordCommand();
    command.focus();
    command.setSelectionRange(joined.from, joined.to);
    const inserted = document.execCommand('insertText', false, joined.insert);
    const at = command.value.slice(joined.from, joined.from + joined.insert.length);
    if (!inserted || at !== joined.insert) command.value = joined.text;
  }
  command.setSelectionRange(joined.start, joined.end);
  syncCommandClear();
  command.focus();
  savePrefs();
}

function statementSpanAt(text, cursor) {
  const statements = splitMqlStatements(text);
  if (statements.length === 0) return null;
  for (const stmt of statements) {
    if (cursor >= stmt.start && cursor <= stmt.end) return stmt;
  }
  let chosen = statements[0];
  for (const stmt of statements) {
    if (stmt.start <= cursor) chosen = stmt;
    else break;
  }
  return chosen;
}

function statementAt(text, cursor) {
  const stmt = statementSpanAt(text, cursor);
  if (!stmt) return '';
  return flattenStatement(stmt.words);
}

function ensureStatementSemicolon() {
  const text = command.value;
  const stmt = statementSpanAt(text, caretOffset());
  if (!stmt || text[stmt.end - 1] === ';') return;
  const index = stmt.end;
  const start = command.selectionStart ?? 0;
  const end = command.selectionEnd ?? start;
  const shift = (pos) => (pos >= index ? pos + 1 : pos);
  recordCommand();
  command.focus();
  command.setSelectionRange(index, index);
  const inserted = document.execCommand('insertText', false, ';');
  if (inserted && command.value[index] === ';') {
    command.setSelectionRange(shift(start), shift(end));
    return;
  }
  command.value = text.slice(0, index) + ';' + text.slice(index);
  command.setSelectionRange(shift(start), shift(end));
  syncCommandClear();
  savePrefs();
}

function statementAtCursor() {
  return statementAt(command.value, caretOffset());
}

function placeholderSpans(text) {
  return [...text.matchAll(PLACEHOLDER)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
}

function selectSpan(span) {
  command.focus();
  command.setSelectionRange(span.start, span.end);
}

function jumpPlaceholder(back) {
  const spans = placeholderSpans(command.value);
  if (spans.length === 0) return false;
  const start = command.selectionStart ?? 0;
  const end = command.selectionEnd ?? start;
  const span = back
    ? spans.findLast((s) => s.end <= start) ?? spans[spans.length - 1]
    : spans.find((s) => s.start >= end) ?? spans[0];
  selectSpan(span);
  return true;
}

function runStatement() {
  closeAssist();
  if (command.disabled || isBusy()) return;
  const stmt = statementSpanAt(command.value, caretOffset());
  const hole = stmt && placeholderSpans(command.value).find((s) => s.start >= stmt.start && s.end <= stmt.end);
  if (hole) {
    selectSpan(hole);
    return;
  }
  ensureStatementSemicolon();
  const text = statementAtCursor();
  if (!text) return;
  vscode.postMessage({ type: 'send', text });
}

function jpoCommand() {
  const path = jpoPath.value.trim();
  if (!path) return '';
  const quoted = /\s/.test(path) && !/^".*"$/.test(path) ? `"${path}"` : path;
  return `insert prog ${quoted};`;
}

function syncJpoPath() {
  const hasPath = jpoPath.value.trim() !== '';
  jpo.classList.toggle('has-path', hasPath);
  jpoRun.disabled = command.disabled || !hasPath;
}

function setJpoOpen(open) {
  jpo.classList.toggle('on', open);
  jpoToggle.setAttribute('aria-pressed', open ? 'true' : 'false');
  jpoToggle.title = open ? 'JPO 경로 닫기' : 'JPO 경로';
  if (open && !jpoPath.disabled) jpoPath.focus();
  savePrefs();
}

function runJpo() {
  if (command.disabled || isBusy()) return;
  const text = jpoCommand();
  if (!text) {
    jpoPath.focus();
    return;
  }
  vscode.postMessage({ type: 'send', text });
}

function lineAt(value, caret) {
  const lineStart = caret === 0 ? 0 : value.lastIndexOf('\n', caret - 1) + 1;
  const lineEndIdx = value.indexOf('\n', caret);
  return { lineStart, lineEnd: lineEndIdx === -1 ? value.length : lineEndIdx };
}

function insertStatement(text) {
  if (command.disabled) return;
  recordCommand();
  const value = command.value;
  if (value.trim() === '') {
    command.value = text;
    command.selectionStart = text.length;
    command.selectionEnd = text.length;
    syncCommandClear();
    command.focus();
    savePrefs();
    return;
  }
  const caret = caretOffset();
  const { lineStart, lineEnd } = lineAt(value, caret);
  const prefix = value.slice(lineStart, caret).trim() !== '' ? '\n' : '';
  const suffix = value.slice(caret, lineEnd).trim() !== '' ? '\n' : '';
  command.value = value.slice(0, caret) + prefix + text + suffix + value.slice(caret);
  const next = caret + prefix.length + text.length;
  command.selectionStart = next;
  command.selectionEnd = next;
  syncCommandClear();
  command.focus();
  savePrefs();
}

function clauseInsertAt(value, caret) {
  const { lineStart, lineEnd } = lineAt(value, caret);
  const line = value.slice(lineStart, lineEnd);
  const trimmedRight = line.replace(/\s+$/, '');
  if (!trimmedRight.endsWith(';')) return caret;
  const semi = lineStart + trimmedRight.length - 1;
  if (caret >= semi && caret <= lineEnd) return semi;
  if (/^\s*$/.test(line.slice(caret - lineStart, trimmedRight.length - 1))) return semi;
  return caret;
}

function appendClause(text, pick) {
  if (command.disabled) return;
  const value = command.value;
  const at = clauseInsertAt(value, caretOffset());
  const head = value.slice(0, at);
  const tail = value.slice(at);
  const gap = head.length > 0 && !/\s$/.test(head) ? ' ' : '';
  const insertedAt = head.length + gap.length;
  recordCommand();
  command.value = head + gap + text + tail;
  const mark = pick ? text.indexOf(pick) : -1;
  const start = insertedAt + (mark === -1 ? text.length : mark);
  const end = mark === -1 ? start : start + pick.length;
  command.selectionStart = start;
  command.selectionEnd = end;
  syncCommandClear();
  command.focus();
  savePrefs();
}

function insertAtCursor(text) {
  const start = command.selectionStart ?? command.value.length;
  const end = command.selectionEnd ?? start;
  const value = command.value;
  recordCommand();
  command.value = value.slice(0, start) + text + value.slice(end);
  const caret = start + text.length;
  command.selectionStart = caret;
  command.selectionEnd = caret;
  syncCommandClear();
  command.focus();
  savePrefs();
}

function insertAtCaret(text) {
  const caret = caretOffset();
  const value = command.value;
  recordCommand();
  command.value = value.slice(0, caret) + text + value.slice(caret);
  const next = caret + text.length;
  command.selectionStart = next;
  command.selectionEnd = next;
  syncCommandClear();
  command.focus();
  savePrefs();
}

function resultSelection() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return '';
  const text = selection.toString();
  if (text.trim() === '') return '';
  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  const anchor = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
  const focus = focusNode instanceof Element ? focusNode : focusNode?.parentElement;
  if (!anchor || !focus) return '';
  const anchorResult = anchor.closest('.result, .result-grid');
  const focusResult = focus.closest('.result, .result-grid');
  if (!anchorResult || anchorResult !== focusResult || !history.contains(anchorResult)) return '';
  return text;
}

function selectedText() {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? start;
    const sub = active.value.slice(start, end);
    if (sub.trim() !== '') return sub;
  }
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return '';
  const text = selection.toString();
  return text.trim() === '' ? '' : text;
}

function closePick() {
  pick.hidden = true;
  pickText = '';
}

function placeFixed(node, x, y) {
  node.hidden = false;
  node.style.left = '0px';
  node.style.top = '0px';
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const maxLeft = Math.max(8, window.innerWidth - width - 8);
  const maxTop = Math.max(8, window.innerHeight - height - 8);
  node.style.left = Math.min(Math.max(8, x), maxLeft) + 'px';
  node.style.top = Math.min(Math.max(8, y), maxTop) + 'px';
}

function isObjectId(text) {
  return /^\d+(\.\d+){3}$/.test(text.trim());
}

function graphSearchTerms(text) {
  const terms = text
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/;+$/, '').replace(/^['"]+|['"]+$/g, ''))
    .filter(Boolean);
  return terms.length >= 1 && terms.length <= 3 ? terms : null;
}

function formatSchemaName(name) {
  const trimmed = name.trim();
  return trimmed ? mqlQuote(trimmed) ?? '' : '';
}

function buildPrintSchemaCommand(kind, name) {
  const quoted = formatSchemaName(name);
  if (!quoted) return '';
  if (kind === 'table') return `print table ${quoted} system;`;
  return `print ${kind} ${quoted};`;
}

function openPick(x, y, inResult = true) {
  closeAssist();
  closeRowMenu();
  closeComposerMenu();
  const oid = inResult && isObjectId(pickText);
  const pasteBtn = pick.querySelector('[data-act="paste"]');
  const printBtn = pick.querySelector('[data-act="printBus"]');
  const expandBtn = pick.querySelector('[data-act="expandBus"]');
  if (pasteBtn) {
    pasteBtn.hidden = !inResult;
    pasteBtn.disabled = command.disabled;
  }
  if (printBtn) {
    printBtn.hidden = !oid;
    printBtn.disabled = command.disabled || sideBusy;
  }
  if (expandBtn) {
    expandBtn.hidden = !oid;
    expandBtn.disabled = command.disabled;
  }
  const editBtn = pick.querySelector('[data-act="editBus"]');
  editBtn.hidden = !oid;
  editBtn.disabled = command.disabled;
  const terms = graphSearchTerms(pickText);
  const graphBtn = pick.querySelector('[data-act="graphSearch"]');
  graphBtn.hidden = !terms || !graphAvailable;
  graphBtn.textContent = terms ? `3D MQL에서 검색 (${terms.join(' · ')})` : '3D MQL에서 검색';
  placeFixed(pick, x, y);
}

function closeRowMenu() {
  rowMenu.hidden = true;
  rowMenuText = '';
}

function openRowMenu(x, y) {
  closeAssist();
  closePick();
  closeComposerMenu();
  const printBtn = rowMenu.querySelector('[data-act="print"]');
  if (printBtn) printBtn.disabled = command.disabled || sideBusy;
  placeFixed(rowMenu, x, y);
}

function isPromptLine(line) {
  return /^MQL<\d*>$/.test(line.trim());
}

function isPromptTail(line) {
  const text = line.trim();
  return text === 'MQL' || /^MQL<\d*>?$/.test(text);
}

function syncDrawerControls() {
  document.body.classList.toggle('side-busy', sideBusy);
  drawerRefresh.disabled = command.disabled || sideBusy;
  const pickLocked = command.disabled && !sideHold;
  helpTopic.disabled = pickLocked;
  listKind.disabled = pickLocked;
  syncStatus();
}

function syncHistory() {
  const wide = document.body.classList.contains('history-hidden');
  const hidden = wide && document.body.classList.contains('drawer-open');
  const label = wide ? '원래 너비' : '전체 너비';
  drawerWide.title = label;
  drawerWide.setAttribute('aria-label', label);
  drawerWide.setAttribute('aria-pressed', wide ? 'true' : 'false');
  history.inert = hidden;
  history.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

function toggleHistory() {
  document.body.classList.toggle('history-hidden');
  syncHistory();
  savePrefs();
}

function syncRail() {
  const open = document.body.classList.contains('drawer-open');
  railHelp.setAttribute('aria-pressed', open && drawerLane === 'help' ? 'true' : 'false');
  railList.setAttribute('aria-pressed', open && drawerLane === 'list' ? 'true' : 'false');
  railCreate.setAttribute('aria-pressed', open && drawerLane === 'create' ? 'true' : 'false');
  railEdit.setAttribute('aria-pressed', open && drawerLane === 'edit' ? 'true' : 'false');
  drawer.inert = !open;
  drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function paintHelp(flush, scroll) {
  const parts = helpRaw.split(/\r\n|\n|\r/);
  const partial = !flush && parts.length > 0 && !helpRaw.endsWith('\n') && !helpRaw.endsWith('\r');
  if (partial && isPromptTail(parts[parts.length - 1])) parts.pop();
  const kept = [];
  for (const line of parts) {
    if (isPromptLine(line)) continue;
    kept.push(line);
  }
  paintMarked(helpView, kept.join('\n'), helpQuery, 'hit');
  const hits = helpView.querySelectorAll('mark.hit');
  if (hits.length > 0) hits[0].classList.add('on');
  if (!scroll || !helpQuery || hits.length === 0) return;
  const view = helpView.getBoundingClientRect();
  const rect = hits[0].getBoundingClientRect();
  if (rect.top < view.top) helpView.scrollTop -= view.top - rect.top;
  else if (rect.bottom > view.bottom) helpView.scrollTop += rect.bottom - view.bottom;
}

function resetList() {
  listRaw = '';
  listCut = 0;
  listView.replaceChildren();
}

function appendList(flush) {
  let end = listRaw.length;
  if (!flush) {
    const rest = listRaw.slice(listCut);
    const br = Math.max(rest.lastIndexOf('\n'), rest.lastIndexOf('\r'));
    if (br === -1) return;
    end = listCut + br + 1;
  }
  const slice = listRaw.slice(listCut, end);
  listCut = end;
  const parts = slice.split(/\r\n|\n|\r/);
  if (slice.endsWith('\n') || slice.endsWith('\r')) parts.pop();
  const query = listFilter.value.trim().toLowerCase();
  const frag = document.createDocumentFragment();
  for (const part of parts) {
    const line = part.trim();
    if (!line || isPromptLine(line)) continue;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'list-row';
    row.dataset.name = line;
    row.textContent = line;
    row.title = line;
    row.hidden = query !== '' && !line.toLowerCase().includes(query);
    frag.append(row);
  }
  listView.append(frag);
}

function annotateList(kind) {
  if (!symbolics) return;
  for (const row of listView.children) {
    const symbolic = symbolics.get(`${kind} ${row.dataset.name}`);
    if (!symbolic || row.querySelector('.list-sym')) continue;
    const span = document.createElement('span');
    span.className = 'list-sym';
    span.textContent = symbolic;
    row.append(span);
    row.title = `${row.dataset.name} (${symbolic})`;
  }
}

function applyListFilter() {
  const query = listFilter.value.trim().toLowerCase();
  for (const row of listView.children) {
    const name = row.dataset.name || '';
    row.hidden = query !== '' && !name.toLowerCase().includes(query);
  }
}

function requestSide(lane, text) {
  if (sideBusy || sideHold) {
    queuedSide = { lane, text };
    return true;
  }
  if (command.disabled) return false;
  sideToken += 1;
  activeToken = sideToken;
  pendingLane = lane;
  sideBusy = true;
  sideHold = true;
  sideStarted = false;
  queuedSide = null;
  if (lane === 'help') sentHelpTopic = helpTopic.value;
  if (lane === 'list') sentKind = listKind.value;
  syncDrawerControls();
  if (lane !== 'meta') setDrawerNote('조회 중');
  vscode.postMessage({ type: 'side', lane, text, token: activeToken });
  return true;
}

function flushQueuedSide() {
  const next = queuedSide;
  if (!next || sideBusy || sideHold || command.disabled) return;
  if (!document.body.classList.contains('drawer-open') || next.lane !== drawerLane) {
    queuedSide = null;
    return;
  }
  queuedSide = null;
  requestSide(next.lane, next.text);
}

function setDrawerWidth(width) {
  const minDrawer = 180;
  if (stage.clientWidth <= 0) {
    drawerWidth = Math.max(minDrawer, Math.round(width));
    document.body.style.setProperty('--drawer-width', drawerWidth + 'px');
    return;
  }
  const available = stage.clientWidth - rail.offsetWidth;
  const maxDrawer = Math.max(minDrawer, available - 96);
  drawerWidth = Math.round(Math.min(maxDrawer, Math.max(minDrawer, width)));
  document.body.style.setProperty('--drawer-width', drawerWidth + 'px');
}

function setDrawerOpen(open) {
  document.body.classList.toggle('drawer-open', open);
  if (open) document.body.dataset.drawer = drawerLane;
  if (!open) closeRowMenu();
  syncRail();
  syncHistory();
  if (open && drawerLane === 'create') {
    void loadCreateLists(false);
  } else if (open && drawerLane === 'edit') {
    if (efOrigin.size === 0) setEditNote('결과의 객체 ID를 우클릭하거나 ID를 입력하고 조회를 누르세요.');
  } else if (open && !sideBusy) {
    const fetched = drawerLane === 'help'
      ? helpFetchedTopic === helpTopic.value
      : listFetchedKind === listKind.value;
    if (!fetched) setDrawerNote('조회를 누르세요.');
  }
  savePrefs();
}

function toggleDrawer(lane) {
  const open = document.body.classList.contains('drawer-open');
  if (open && drawerLane === lane) {
    setDrawerOpen(false);
    return;
  }
  drawerLane = lane;
  setDrawerOpen(true);
}

function refreshDrawer() {
  if (drawerRefresh.disabled) return;
  if (drawerLane === 'help') requestSide('help', helpText());
  else if (drawerLane === 'create') void loadCreateLists(true);
  else if (drawerLane === 'edit') void loadEdit();
  else requestSide('list', `list ${listKind.value}`);
}

const HELP_ADMIN = [
  'application', 'association', 'attribute', 'bus', 'businessobject', 'channel', 'command', 'connection', 'context', 'dataobject',
  'dimension', 'expression', 'filter', 'form', 'format', 'group', 'index', 'inheritancerule', 'inquiry', 'interface',
  'location', 'menu', 'package', 'page', 'path', 'pathtype', 'person', 'policy', 'portal', 'product',
  'program', 'property', 'relationship', 'resource', 'role', 'rule', 'searchindex', 'site', 'store', 'system',
  'table', 'transaction', 'type', 'uniquekey', 'user', 'vault', 'webreport',
];

const HELP_COMMANDS = [
  'abort', 'add', 'approve', 'checkin', 'checkout', 'checkshowaccess', 'clear', 'commit', 'compare', 'compile',
  'config', 'connect', 'copy', 'del', 'delete', 'demote', 'disable', 'disconnect', 'enable', 'env',
  'escape', 'eval', 'evaluate', 'eventmonitor', 'exec', 'execute', 'expand', 'export', 'extract', 'history',
  'ignore', 'import', 'insert', 'list', 'lock', 'mail', 'mod', 'modify', 'monitor', 'move',
  'mql', 'override', 'password', 'pop', 'print', 'promote', 'push', 'query', 'reject', 'run',
  'server', 'sessions', 'set', 'start', 'temp', 'thread', 'toolset', 'trace', 'transfer', 'transition',
  'trigger', 'unlock', 'validate', 'verb', 'verbose', 'version',
];

function helpOption(name) {
  const option = document.createElement('option');
  option.value = name;
  option.textContent = name;
  return option;
}

function fillHelpTopics() {
  const admin = document.createElement('optgroup');
  admin.label = '대상';
  for (const name of HELP_ADMIN) admin.append(helpOption(name));
  const commands = document.createElement('optgroup');
  commands.label = '명령';
  for (const name of HELP_COMMANDS) commands.append(helpOption(name));
  helpTopic.append(admin, commands);
}

function helpText() {
  const topic = helpTopic.value;
  if (!topic) return 'help';
  return `help ${topic}`;
}

function setDrawerNote(text) {
  drawerNote.hidden = text === '';
  drawerNote.textContent = text;
  drawerNote.classList.toggle('loading', text === '조회 중');
}

fillHelpTopics();

function onSideStart(message) {
  if (message.token !== activeToken || message.lane !== pendingLane) return;
  sideBusy = true;
  sideStarted = true;
  syncDrawerControls();
  if (message.lane === 'meta') {
    metaRaw = '';
    return;
  }
  if (message.lane === 'help') {
    helpRaw = '';
    helpView.textContent = '';
    helpView.scrollTop = 0;
  } else resetList();
  setDrawerNote('조회 중');
}

function onSideChunk(message) {
  if (message.token !== activeToken || message.lane !== pendingLane) return;
  if (message.lane === 'meta') metaRaw += message.text;
  else if (message.lane === 'help') helpRaw += message.text;
  else listRaw += message.text;
}

function onSideEnd(message) {
  if (message.token !== activeToken) return;
  const started = sideStarted;
  const lane = pendingLane;
  const superseded = queuedSide !== null;
  sideBusy = false;
  sideStarted = false;
  if (!command.disabled) sideHold = false;
  if (lane === 'meta') {
    const done = metaActive;
    metaActive = null;
    done?.resolve(started ? metaRaw : null);
  } else if (!superseded && started && lane === 'help') {
    paintHelp(true, false);
    helpFetchedTopic = sentHelpTopic;
    setDrawerNote(helpRaw.trim() ? '' : '결과가 없습니다.');
  } else if (!superseded && started && lane === 'list') {
    appendList(true);
    listFetchedKind = sentKind;
    const names = [];
    for (const row of listView.children) {
      if (row.dataset.name) names.push(row.dataset.name);
    }
    schemaCache.set(sentKind, names);
    setDrawerNote(listView.children.length === 0 ? '결과가 없습니다.' : '');
    const kind = sentKind;
    if (SYMBOLIC_ADMINS.has(kind) && names.length > 0) {
      void loadSymbolics().then(() => {
        if (listFetchedKind === kind) annotateList(kind);
      });
    }
  } else if (!superseded) setDrawerNote('조회하지 못했습니다.');
  syncDrawerControls();
  flushQueuedSide();
  pumpMeta();
}

const metaWaiters = [];
const attrMeta = new Map();
let metaActive = null;
let metaRaw = '';
let cfTypeLoaded = '';
let cfTypeInfo = null;
let cfPolicyLoaded = '';
let cfPolicyAuto = false;

function requestMeta(text) {
  return new Promise((resolve) => {
    metaWaiters.push({ text, resolve });
    pumpMeta();
  });
}

function pumpMeta() {
  if (metaActive || sideBusy || sideHold || command.disabled || metaWaiters.length === 0) return;
  metaActive = metaWaiters.shift();
  if (!requestSide('meta', metaActive.text)) {
    metaActive.resolve(null);
    metaActive = null;
  }
}

function dropMeta() {
  for (const waiter of metaWaiters.splice(0)) waiter.resolve(null);
  metaActive?.resolve(null);
  metaActive = null;
}

function keyValues(raw, key) {
  const values = [];
  for (const line of cleanResult(raw ?? '').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s=\s?(.*)$/);
    if (m && m[1] === key) values.push(m[2].trim());
  }
  return values;
}

function selectValues(raw, key) {
  if (raw == null || hasErrorLine(cleanResult(raw))) return null;
  return keyValues(raw, key);
}

function rangeValue(value) {
  const m = value.match(/^=\s*(.*)$/);
  if (m) return [m[1]];
  if (/^(?:!=|<|>|~|!~|match|nmatch|smatch|nsmatch|program|between)/i.test(value)) return [];
  return value ? [value] : [];
}

function mqlQuote(value) {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  return null;
}

function fillDatalist(list, names) {
  list.replaceChildren(...names.map((name) => new Option(name, name)));
}

function setCreateNote(text) {
  cfNote.hidden = text === '';
  cfNote.textContent = text;
}

async function loadCreateLists(force) {
  for (const [kind, list] of [['type', cfTypes], ['vault', cfVaults]]) {
    if (!force && list.children.length > 0) continue;
    let names = force ? null : schemaCache.get(kind);
    if (!names) {
      setCreateNote(`${kind} 목록 조회 중`);
      const raw = await requestMeta(`list ${kind}`);
      names = raw == null ? null : cleanResult(raw).split('\n').map((line) => line.trim()).filter((line) => line && !hasErrorLine(line));
      if (names) schemaCache.set(kind, names);
    }
    fillDatalist(list, names || []);
  }
  if (force) {
    attrMeta.clear();
    cfTypeLoaded = '';
    cfPolicyLoaded = '';
    await loadType();
    return;
  }
  setCreateNote('');
}

async function loadType() {
  const type = cfType.value.trim();
  if (!type || type === cfTypeLoaded) return;
  cfTypeLoaded = type;
  cfTypeInfo = null;
  const quoted = mqlQuote(type);
  if (!quoted) {
    renderAttrs([]);
    setCreateNote('작은따옴표와 큰따옴표가 함께 든 type 이름은 조회할 수 없습니다.');
    syncCreate();
    return;
  }
  setCreateNote('type 정보 조회 중');
  const raw = await requestMeta(`print type ${quoted} select policy attribute`);
  if (cfTypeLoaded !== type) return;
  const policies = selectValues(raw, 'policy');
  const attrs = selectValues(raw, 'attribute');
  if (!policies || !attrs) {
    renderAttrs([]);
    setCreateNote('type 정보를 조회하지 못했습니다. 값을 직접 입력하세요.');
    syncCreate();
    return;
  }
  fillDatalist(cfPolicies, policies);
  if (policies.length > 0 && !policies.includes(cfPolicy.value.trim()) && (cfPolicyAuto || !cfPolicy.value.trim())) {
    cfPolicy.value = policies[0];
    cfPolicyAuto = true;
    void loadPolicy();
  }
  if (!(await loadAttrMeta(attrs, () => cfTypeLoaded === type, setCreateNote))) return;
  renderAttrs(attrs);
  setCreateNote(attrs.length === 0 ? '속성이 없습니다.' : '');
  syncCreate();
  const info = await loadTypeInfo(type, quoted, () => cfTypeLoaded === type);
  if (cfTypeLoaded !== type) return;
  cfTypeInfo = info && { ...info, type, policies };
  syncCreate();
}

async function loadTypeInfo(type, quoted, alive) {
  const raw = await requestMeta(`print type ${quoted} select abstract\nprint type ${quoted} select derived`);
  if (!alive() || raw == null) return null;
  const chain = [type];
  let parent = keyValues(raw, 'derived')[0] || '';
  while (parent && !chain.includes(parent) && chain.length < 20) {
    chain.push(parent);
    const next = mqlQuote(parent);
    const more = next ? await requestMeta(`print type ${next} select derived`) : null;
    if (!alive()) return null;
    parent = keyValues(more, 'derived')[0] || '';
  }
  return { abstract: /^true$/i.test(keyValues(raw, 'abstract')[0] || ''), chain };
}

function attrMetaBlocks(raw) {
  const metas = new Map();
  let current = null;
  for (const line of cleanResult(raw).split('\n')) {
    const m = line.match(/^\s*(name|type|default|range)\s=\s?(.*)$/);
    if (!m) continue;
    const value = m[2].trim();
    if (m[1] === 'name') {
      current = { type: '', def: '', ranges: [] };
      metas.set(value, current);
    } else if (!current) continue;
    else if (m[1] === 'type') current.type = value;
    else if (m[1] === 'default') current.def = value;
    else current.ranges.push(...rangeValue(value));
  }
  return metas;
}

async function loadAttrMeta(names, alive, note) {
  const missing = names.filter((name) => !attrMeta.has(name));
  const quoted = missing.filter((name) => !name.includes(';')).map(mqlQuote).filter(Boolean);
  if (quoted.length === 0) return true;
  note(`속성 정보 조회 중 (${quoted.length}건)`);
  const raw = await requestMeta(quoted.map((name) => `print attribute ${name} select name type default range`).join('\n'));
  if (!alive()) return false;
  if (raw == null) return true;
  const metas = attrMetaBlocks(raw);
  for (const name of missing) attrMeta.set(name, metas.get(name) || { type: '', def: '', ranges: [] });
  return true;
}

async function loadPolicy() {
  const policy = cfPolicy.value.trim();
  if (!policy || policy === cfPolicyLoaded) return;
  cfPolicyLoaded = policy;
  const quoted = mqlQuote(policy);
  const raw = quoted ? await requestMeta(`print policy ${quoted} select state`) : null;
  if (cfPolicyLoaded !== policy) return;
  fillDatalist(cfStates, selectValues(raw, 'state') || []);
}

function attrControl(name, meta) {
  const choices = meta.ranges.length > 0 ? meta.ranges : /^boolean$/i.test(meta.type) ? ['TRUE', 'FALSE'] : null;
  let control;
  if (choices) {
    control = document.createElement('select');
    control.append(new Option(meta.def ? `(기본: ${meta.def})` : '', ''), ...choices.map((v) => new Option(v, v)));
  } else {
    control = document.createElement('input');
    control.spellcheck = false;
    control.autocomplete = 'off';
    control.placeholder = /^date$/i.test(meta.type) ? 'MM/DD/YYYY' : meta.def;
    if (/^(?:integer|real)$/i.test(meta.type)) control.inputMode = 'decimal';
  }
  control.className = 'cf-input';
  control.dataset.attr = name;
  return control;
}

const CF_ROW_FIELDS = [['name', 'Name'], ['rev', 'Revision'], ['current', 'State'], ['owner', 'Owner'], ['description', 'Description']];
let cfAttrNames = [];

function attrMetaOf(name) {
  return attrMeta.get(name) || { type: '', def: '', ranges: [] };
}

function cfControls(root) {
  return root.querySelectorAll('[data-key], [data-attr]');
}

function controlKey(control) {
  return control.dataset.attr ? `@${control.dataset.attr}` : control.dataset.key;
}

function readControls(root) {
  return new Map([...cfControls(root)].map((control) => [controlKey(control), control.value]));
}

function fillControls(root, values) {
  for (const control of cfControls(root)) {
    const value = values.get(controlKey(control));
    if (value !== undefined) control.value = value;
  }
}

function fieldControl(key) {
  const control = document.createElement('input');
  control.className = 'cf-input';
  control.spellcheck = false;
  control.autocomplete = 'off';
  control.dataset.key = key;
  if (key === 'current') {
    control.setAttribute('list', 'cf-states');
    control.placeholder = '(기본)';
  }
  return control;
}

function gridRowNode(values) {
  const row = document.createElement('tr');
  row.insertCell().className = 'cf-num';
  for (const [key] of CF_ROW_FIELDS) row.insertCell().append(fieldControl(key));
  for (const name of cfAttrNames) row.insertCell().append(attrControl(name, attrMetaOf(name)));
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'cf-del';
  remove.title = '행 삭제';
  remove.setAttribute('aria-label', '행 삭제');
  remove.textContent = '×';
  row.insertCell().append(remove);
  if (values) fillControls(row, values);
  return row;
}

function renderGridHead() {
  const cells = ['#', ...CF_ROW_FIELDS.map(([, label]) => label), ...cfAttrNames, ''].map((text) => {
    const cell = document.createElement('th');
    cell.textContent = text;
    cell.title = text;
    return cell;
  });
  cfRows.tHead.rows[0].replaceChildren(...cells);
}

function attrField(name, id) {
  const meta = attrMetaOf(name);
  const control = attrControl(name, meta);
  control.id = id;
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = name;
  label.title = meta.type ? `${name} (${meta.type})` : name;
  return [label, control];
}

function renderAttrs(names) {
  const active = document.activeElement;
  const focusKey = active instanceof HTMLElement && createView.contains(active) && active.matches('[data-key], [data-attr]') ? controlKey(active) : '';
  const focusRow = active instanceof HTMLElement ? active.closest('#cf-rows tbody tr') : null;
  const focusIndex = focusRow ? focusRow.sectionRowIndex : -1;
  cfAttrNames = names;
  const kept = readControls(cfAttrs);
  const nodes = [];
  for (const name of names) nodes.push(...attrField(name, `cf-attr-${nodes.length}`));
  cfAttrs.replaceChildren(...nodes);
  fillControls(cfAttrs, kept);
  renderGridHead();
  for (const row of [...cfRowsBody.rows]) {
    const next = gridRowNode(readControls(row));
    if (row.dataset.status) next.dataset.status = row.dataset.status;
    swapRow(row, next);
    row.replaceWith(next);
  }
  if (!focusKey || active.isConnected) return;
  const root = focusIndex >= 0 ? cfRowsBody.rows[focusIndex] : cfAttrs;
  const target = root && [...cfControls(root)].find((control) => controlKey(control) === focusKey);
  target?.focus();
}

function createLines(values) {
  const bad = [];
  const quote = (value, label) => {
    const text = mqlQuote(value);
    if (text == null) bad.push(label);
    return text ?? `'${value}'`;
  };
  const field = (value, hole, label) => quote(value || hole, label);
  const lines = [
    `add bus ${field(cfType.value.trim(), '<type>', 'Type')} ${field(values.get('name'), '<name>', 'Name')} ${quote(values.get('rev') || '', 'Revision')}`,
    `policy ${field(cfPolicy.value.trim(), '<policy>', 'Policy')}`,
    `vault ${field(cfVault.value.trim(), '<vault>', 'Vault')}`,
  ];
  for (const [key, raw] of values) {
    const value = raw.trim();
    if (!value || key === 'name' || key === 'rev') continue;
    const label = key.startsWith('@') ? key.slice(1) : key;
    lines.push(key.startsWith('@') ? `${quote(label, label)} ${quote(value, label)}` : `${key} ${quote(value, label)}`);
  }
  lines.push('select id dump;');
  return { lines, bad };
}

function isGridMode() {
  return createView.classList.contains('grid');
}

function isFilled(row) {
  return [...cfControls(row)].some((control) => control.value.trim());
}

function isWaiting(row) {
  return row.dataset.status !== 'done' && row.dataset.status !== 'run';
}

function createStatements() {
  if (!isGridMode()) {
    const single = new Map([...readControls(createView.querySelector('.cf-grid')), ...readControls(cfAttrs)]);
    return [createLines(single)];
  }
  const rows = [...cfRowsBody.rows];
  const filled = rows.filter(isFilled);
  if (filled.length === 0) return rows.slice(0, 1).map((row) => createLines(readControls(row)));
  return filled.filter(isWaiting).map((row) => createLines(readControls(row)));
}

function createText(statements) {
  return statements.map(({ lines }) => lines.join('\n  ')).join('\n');
}

function renderWarnings(list, items) {
  list.replaceChildren(...items.map((text) => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
  list.hidden = items.length === 0;
}

function quoteWarning(labels) {
  return labels.length > 0 && `작은따옴표와 큰따옴표가 함께 들어 있어 MQL 문장으로 만들 수 없습니다: ${[...new Set(labels)].join(', ')}`;
}

function syncCreateWarnings(bad) {
  const type = cfType.value.trim();
  const info = cfTypeInfo?.type === type ? cfTypeInfo : null;
  renderWarnings(cfWarn, [
    type && cfTypes.options.length > 0 && !isListed(cfTypes, type) && 'type 목록에 없는 이름입니다. 정확한 type 이름인지 확인하세요.',
    info?.abstract && 'abstract type이라 객체를 만들 수 없습니다.',
    info?.chain.some((name) => /^PLM(?:Core|Entity)/.test(name)) && 'VPM/PLM 계열 type입니다. CATIA 설계 데이터는 MQL로 만들면 구조가 어긋날 수 있습니다.',
    info && info.policies.length === 0 && '이 type에 쓸 수 있는 policy를 찾지 못했습니다.',
    !isGridMode() && cfDuplicate && `같은 Type · Name · Revision 객체가 이미 있습니다. (${cfDuplicate})`,
    quoteWarning(bad),
  ].filter(Boolean));
}

function syncCreate() {
  const statements = createStatements();
  const bad = statements.flatMap((statement) => statement.bad);
  const done = statements.length === 0;
  cfPreview.textContent = done ? '모든 행을 실행했습니다.' : createText(statements);
  cfInsert.disabled = command.disabled || done;
  cfRun.disabled = command.disabled || sideBusy || done || bad.length > 0 || cfRowsBody.querySelector('tr[data-status="run"]') !== null || statements.some(({ lines }) => placeholderSpans(lines.join(' ')).length > 0);
  syncCreateWarnings(bad);
}

function setCreateMode(grid) {
  createView.classList.toggle('grid', grid);
  cfModeOne.setAttribute('aria-pressed', grid ? 'false' : 'true');
  cfModeGrid.setAttribute('aria-pressed', grid ? 'true' : 'false');
  dupKey = '';
  scheduleDuplicate();
  syncCreate();
}

let cfDuplicate = '';
let dupKey = '';
let dupTimer = 0;

function scheduleDuplicate() {
  clearTimeout(dupTimer);
  dupTimer = setTimeout(() => {
    void checkDuplicate();
  }, 500);
}

async function checkDuplicate() {
  const type = cfType.value.trim();
  const name = document.getElementById('cf-name').value.trim();
  const rev = document.getElementById('cf-rev').value.trim();
  const key = isGridMode() ? '' : JSON.stringify([type, name, rev]);
  if (key === dupKey) return;
  dupKey = key;
  cfDuplicate = '';
  syncCreate();
  if (!key || !type || !name || /[*?]/.test(`${type}${name}${rev}`) || !isListed(cfTypes, type)) return;
  const parts = [type, name, rev || '*'].map(mqlQuote);
  if (parts.some((part) => !part)) return;
  const raw = await requestMeta(`temp query bus ${parts.join(' ')} select id dump '|~|'`);
  if (dupKey !== key || raw == null) return;
  const found = cleanResult(raw).split('\n').map((line) => line.trim().split('|~|')).find((fields) => fields.length >= 4 && fields[0] === type && fields[1] === name && fields[2] === rev);
  cfDuplicate = found ? found[3] : '';
  syncCreate();
}

let batchToken = 0;
const batchRows = new Map();
const rowOfBlock = new Map();

function runBatch() {
  const rows = [...cfRowsBody.rows].filter((row) => isWaiting(row) && isFilled(row));
  if (rows.length === 0) return;
  batchToken += 1;
  for (const row of rows) row.dataset.status = 'run';
  batchRows.set(batchToken, { rows, queue: [...rows] });
  setCreateNote('');
  vscode.postMessage({ type: 'batch', batch: batchToken, texts: rows.map((row) => createLines(readControls(row)).lines.join(' ')) });
  syncCreate();
}

function swapRow(row, next) {
  for (const entry of batchRows.values()) {
    entry.rows = entry.rows.map((item) => (item === row ? next : item));
    entry.queue = entry.queue.map((item) => (item === row ? next : item));
  }
  for (const entry of rowOfBlock.values()) if (entry.row === row) entry.row = next;
}

function mapRow(message) {
  const row = batchRows.get(message.batch)?.queue.shift();
  if (row) rowOfBlock.set(String(message.id), { row, batch: message.batch });
}

function settleRow(id, stored) {
  const entry = rowOfBlock.get(id);
  if (!entry) return;
  entry.row.dataset.status = hasErrorLine(cleanResult(stored.result)) ? 'fail' : 'done';
  syncCreate();
}

function failRow(id) {
  const entry = rowOfBlock.get(id);
  if (!entry) return;
  entry.row.dataset.status = 'fail';
  syncCreate();
}

function endBatch(batch) {
  const entry = batchRows.get(batch);
  if (!entry) return;
  batchRows.delete(batch);
  for (const [id, item] of rowOfBlock) if (item.batch === batch) rowOfBlock.delete(id);
  for (const row of entry.rows) if (row.dataset.status === 'run') delete row.dataset.status;
  const failed = entry.rows.find((row) => row.dataset.status === 'fail' && row.isConnected);
  setCreateNote(failed ? `${failed.sectionRowIndex + 1}번째 행에서 오류가 나 멈췄습니다. 고친 뒤 실행하면 실패한 행부터 다시 실행합니다.` : '');
  syncCreate();
}

function resetBatches() {
  batchRows.clear();
  rowOfBlock.clear();
  for (const row of cfRowsBody.rows) delete row.dataset.status;
}

function addGridRow() {
  const row = gridRowNode();
  cfRowsBody.append(row);
  cfControls(row)[0].focus();
  syncCreate();
}

function removeGridRow(row) {
  if (cfRowsBody.rows.length <= 1) {
    for (const control of cfControls(row)) control.value = '';
    cfControls(row)[0].focus();
    syncCreate();
    return;
  }
  const next = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  cfControls(next)[0].focus();
  syncCreate();
}

const EF_SELECT = 'type name revision policy vault current owner description attribute attribute.value';
const EF_KEY = /^\s*(type|name|revision|policy|vault|current|owner|description|attribute|attribute\.value|attribute\[[^\]]+\]\.value)\s=\s?(.*)$/;
const UNDO_LABEL = '되돌리는 문장';
const RECREATE_LABEL = '다시 만드는 문장 (ID·이력·연결은 복원되지 않음)';
let efLoaded = '';
let efOrigin = new Map();
let efReload = null;
let efStates = [];

function setEditNote(text) {
  efNote.hidden = text === '';
  efNote.textContent = text;
}

function busValues(raw) {
  if (raw == null) return null;
  const text = cleanResult(raw);
  if (hasErrorLine(text)) return null;
  const basics = new Map();
  const attrs = new Map();
  const names = [];
  const values = [];
  let append = null;
  let blanks = 0;
  for (const line of text.split('\n')) {
    const m = line.match(EF_KEY);
    if (!m) {
      if (!append) continue;
      if (line.trim()) {
        append(`${'\n'.repeat(blanks + 1)}${line.trim()}`);
        blanks = 0;
      } else blanks += 1;
      continue;
    }
    blanks = 0;
    const [, key, value] = m;
    const named = key.match(/^attribute\[(.+)\]\.value$/);
    if (named) {
      attrs.set(named[1], value);
      append = (more) => attrs.set(named[1], attrs.get(named[1]) + more);
    } else if (key === 'attribute') {
      names.push(value.trim());
      append = null;
    } else if (key === 'attribute.value') {
      const at = values.push(value) - 1;
      append = (more) => {
        values[at] += more;
      };
    } else if (!basics.has(key)) {
      basics.set(key, value);
      append = (more) => basics.set(key, basics.get(key) + more);
    } else append = null;
  }
  if (attrs.size === 0) names.forEach((name, i) => attrs.set(name, values[i] ?? ''));
  return basics.size > 0 ? { basics, attrs } : null;
}

function fitText(control, value) {
  if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) return control;
  const multi = value.includes('\n');
  if (multi === (control instanceof HTMLTextAreaElement)) return control;
  const next = document.createElement(multi ? 'textarea' : 'input');
  next.id = control.id;
  next.className = control.className;
  Object.assign(next.dataset, control.dataset);
  next.spellcheck = false;
  next.autocomplete = 'off';
  if (multi) next.rows = Math.min(8, value.split('\n').length);
  return next;
}

function renderEdit(data) {
  const basics = data?.basics ?? new Map();
  efType.value = basics.get('type') ?? '';
  efPolicy.value = basics.get('policy') ?? '';
  efVault.value = basics.get('vault') ?? '';
  efState.value = basics.get('current') ?? '';
  efOrigin = new Map(['name', 'revision', 'owner', 'description'].map((key) => [key, basics.get(key) ?? '']));
  const desc = editView.querySelector('[data-key="description"]');
  const fitted = fitText(desc, efOrigin.get('description'));
  if (fitted !== desc) desc.replaceWith(fitted);
  const nodes = [];
  for (const [name, value] of data?.attrs ?? []) {
    efOrigin.set(`@${name}`, value);
    const [label, made] = attrField(name, `ef-attr-${nodes.length}`);
    const control = fitText(made, value);
    if (control instanceof HTMLSelectElement && ![...control.options].some((option) => option.value === value)) control.append(new Option(value, value));
    nodes.push(label, control);
  }
  efAttrs.replaceChildren(...nodes);
  fillControls(editView, efOrigin);
  if (!data) efOrigin = new Map();
  syncEdit();
}

async function loadEdit(oid = efOid.value.trim()) {
  efOid.value = oid;
  if (!isObjectId(oid)) {
    setEditNote('객체 ID 형식이 아닙니다. (예: 1234.5678.9012.3456)');
    return;
  }
  efLoaded = oid;
  efStates = [];
  renderEdit(null);
  setEditNote('객체 조회 중');
  const data = busValues(await requestMeta(`print bus ${oid} select ${EF_SELECT}`));
  if (efLoaded !== oid) return;
  if (!data) {
    setEditNote('객체를 조회하지 못했습니다.');
    return;
  }
  const names = [...data.attrs.keys()];
  if (!(await loadAttrMeta(names, () => efLoaded === oid, setEditNote))) return;
  renderEdit(data);
  setEditNote(names.length === 0 ? '속성이 없습니다.' : '');
  await loadEditStates(data.basics.get('policy') ?? '', oid);
}

async function loadEditStates(policy, oid) {
  const quoted = policy ? mqlQuote(policy) : null;
  if (!quoted) return;
  const raw = await requestMeta(`print policy ${quoted} select state`);
  if (efLoaded !== oid) return;
  efStates = selectValues(raw, 'state') || [];
  syncEdit();
}

function openEdit(oid) {
  drawerLane = 'edit';
  setDrawerOpen(true);
  void loadEdit(oid);
}

function quoteInto(labels) {
  return (value, label) => {
    const text = mqlQuote(value);
    if (text == null) labels.push(label);
    return text;
  };
}

function modParts(values, pick, quote) {
  const changed = (key) => values.get(key) !== efOrigin.get(key);
  const parts = [];
  if (changed('name') || changed('revision')) {
    const name = quote(pick('name') ?? '', 'Name');
    const revision = quote(pick('revision') ?? '', 'Revision');
    if (name && revision) parts.push(`name ${name} revision ${revision}`);
  }
  for (const key of values.keys()) {
    if (key === 'name' || key === 'revision' || !changed(key)) continue;
    const label = key.startsWith('@') ? key.slice(1) : key;
    const head = key.startsWith('@') ? quote(label, label) : key;
    const value = quote(pick(key) ?? '', label);
    if (head && value) parts.push(`${head} ${value}`);
  }
  return parts;
}

function editLines() {
  const bad = [];
  const skipped = [];
  if (efOrigin.size === 0) return { lines: [], undo: [], bad, skipped };
  const values = readControls(editView);
  const statement = (parts) => (parts.length > 0 ? [`mod bus ${efLoaded}`, ...parts.slice(0, -1), `${parts[parts.length - 1]};`] : []);
  return {
    lines: statement(modParts(values, (key) => values.get(key), quoteInto(bad))),
    undo: statement(modParts(values, (key) => efOrigin.get(key), quoteInto(skipped))),
    bad,
    skipped,
  };
}

function recreateText() {
  const skipped = [];
  const quote = quoteInto(skipped);
  const head = [['Type', efType.value], ['Name', efOrigin.get('name') ?? ''], ['Revision', efOrigin.get('revision') ?? ''], ['Policy', efPolicy.value], ['Vault', efVault.value]].map(([label, value]) => quote(value, label));
  if (head.some((part) => part == null)) return { text: '', skipped };
  const parts = [`add bus ${head[0]} ${head[1]} ${head[2]}`, `policy ${head[3]}`, `vault ${head[4]}`];
  for (const key of ['owner', 'description']) {
    const value = efOrigin.get(key) ?? '';
    const text = value ? quote(value, key) : null;
    if (text) parts.push(`${key} ${text}`);
  }
  for (const [key, value] of efOrigin) {
    if (!key.startsWith('@')) continue;
    const name = key.slice(1);
    if (!value && !attrMetaOf(name).def) continue;
    const attr = quote(name, name);
    const text = quote(value, name);
    if (attr && text) parts.push(`${attr} ${text}`);
  }
  return { text: `${parts.join(' ')};`, skipped };
}

function syncEdit() {
  const { lines, undo, bad, skipped } = editLines();
  const loaded = efOrigin.size > 0;
  efPreview.textContent = lines.length > 0 ? lines.join('\n  ') : loaded ? '변경 사항이 없습니다.' : '';
  efUndo.textContent = undo.join('\n  ');
  efUndo.hidden = undo.length === 0;
  efUndoHead.hidden = undo.length === 0;
  efInsert.disabled = command.disabled || lines.length === 0 || bad.length > 0;
  efRun.disabled = command.disabled || sideBusy || lines.length === 0 || bad.length > 0;
  efDelete.disabled = command.disabled || sideBusy || !loaded;
  const at = efStates.indexOf(efState.value);
  const next = at >= 0 ? efStates[at + 1] : undefined;
  const prev = at > 0 ? efStates[at - 1] : undefined;
  efPromote.disabled = command.disabled || sideBusy || !loaded || (at >= 0 && !next);
  efDemote.disabled = command.disabled || sideBusy || !loaded || (at >= 0 && !prev);
  efPromote.title = next ? `promote bus → ${next}` : 'promote bus';
  efDemote.title = prev ? `demote bus → ${prev}` : 'demote bus';
  for (const control of cfControls(editView)) {
    const key = controlKey(control);
    const changed = loaded && efOrigin.has(key) && control.value !== efOrigin.get(key);
    control.classList.toggle('changed', changed);
    for (const label of control.labels ?? []) label.classList.toggle('changed', changed);
  }
  renderWarnings(efWarn, [
    quoteWarning(bad),
    skipped.length > 0 && `따옴표 때문에 되돌리는 문장에서 뺀 항목: ${[...new Set(skipped)].join(', ')}`,
  ].filter(Boolean));
}

function sendEdit(text, confirm, undo = '', label = UNDO_LABEL) {
  efReload = { text, undo, label };
  vscode.postMessage({ type: 'send', text, confirm });
}

function reloadEditAfter(stored, id) {
  if (!efReload || !sameCommand(stored.command, efReload.text)) return;
  const { text, undo, label } = efReload;
  efReload = null;
  if (hasErrorLine(cleanResult(stored.result))) return;
  if (undo) {
    undoHints.set(id, { text: undo, label });
    const item = blockById(id);
    if (item) undoHint(item);
  }
  if (/^delete\b/i.test(text)) {
    renderEdit(null);
    setEditNote('객체를 삭제했습니다.');
    return;
  }
  void loadEdit(efLoaded);
}

let stageGrow = '';

function setComposerHidden(hidden) {
  const wasHidden = document.body.classList.contains('composer-hidden');
  document.body.classList.toggle('composer-hidden', hidden);
  if (hidden && !wasHidden) {
    stageGrow = stage.style.flexGrow;
    stage.style.flexGrow = '1';
  } else if (!hidden && wasHidden) {
    stage.style.flexGrow = stageGrow;
  }
  const label = hidden ? '입력 표시' : '입력 숨기기';
  composerToggle.title = label;
  composerToggle.setAttribute('aria-label', label);
  composerToggle.setAttribute('aria-pressed', hidden ? 'true' : 'false');
  if (hidden) {
    closeAssist();
    closeComposerMenu();
  } else if (!command.disabled) command.focus();
  savePrefs();
}

function applySplit(ratio) {
  const top = clearBar.getBoundingClientRect().bottom;
  const available = document.body.clientHeight - (top - document.body.getBoundingClientRect().top) - split.offsetHeight;
  const min = 72;
  const minRatio = available > min * 2 ? min / available : 0.4;
  const maxRatio = available > min * 2 ? (available - min) / available : 0.6;
  const next = available > min * 2 ? Math.min(maxRatio, Math.max(minRatio, ratio)) : Math.min(0.85, Math.max(0.15, ratio));
  splitRatio = next;
  stage.style.flexGrow = String(next);
  composer.style.flexGrow = String(1 - next);
}

window.addEventListener('message', (event) => {
  const message = event.data;
  if (!message || typeof message.type !== 'string') return;
  if (message.type === 'state') {
    cancelPaint();
    render(message);
    return;
  }
  if (message.type === 'block') {
    runningId = message.id;
    for (const hint of history.querySelectorAll('.block-hint:not(.block-undo)')) {
      if (sameCommand(hint.dataset.cmd, message.command)) hint.remove();
    }
    if (/\bproperty\b/i.test(message.command)) forgetSymbolics();
    if (message.folded) collapsed.add(String(message.id));
    history.append(blockNode(message));
    if (!message.secret) addRecall(message.id, message.command);
    mapRow(message);
    updateTxFromCommand(message.command, false);
    syncStatus();
    if (findQuery) syncFind(false);
    follow(true);
    return;
  }
  if (message.type === 'chunk') {
    const stored = blockText.get(String(message.id));
    if (!stored) return;
    stored.result += message.text;
    queuePaint(message.id);
    const item = blockById(String(message.id));
    if (item?.classList.contains('collapsed') && PASSWORD_PROMPT.test(stored.result)) setFolded(item, false);
    return;
  }
  if (message.type === 'blockDone') {
    flushPaint();
    settleBlock(message.id);
    const id = String(message.id);
    const stored = blockText.get(id);
    if (stored) stored.elapsed = message.elapsed;
    const failed = stored && hasErrorLine(cleanResult(stored.result));
    if (failed) recomputeAllTx();
    const item = blockById(id);
    if (item && failed && item.classList.contains('collapsed')) setFolded(item, false);
    if (item) {
      item.querySelector('.block-time').textContent = formatElapsed(message.elapsed);
      symbolicHint(item);
      syncGridButton(item);
    }
    if (stored) {
      settleRow(id, stored);
      reloadEditAfter(stored, id);
    }
    return;
  }
  if (message.type === 'reset') {
    const stored = blockText.get(String(message.id));
    if (stored) stored.reset = true;
    const item = blockById(String(message.id));
    if (item && !item.querySelector('.block-reset')) item.querySelector('.block-wait').after(resetNode());
    failRow(String(message.id));
    recomputeAllTx();
    return;
  }
  if (message.type === 'batchEnd') {
    endBatch(message.batch);
    return;
  }
  if (message.type === 'cleared') {
    cancelPaint();
    runningId = null;
    for (const item of history.querySelectorAll('.block')) item.remove();
    pruneBlockState();
    markRecall();
    setClearEnabled(false);
    syncFind(false);
    return;
  }
  if (message.type === 'input') {
    setInputEnabled(message.enabled);
    return;
  }
  if (message.type === 'context') {
    setContext(message.text);
    return;
  }
  if (message.type === 'graph') {
    graphAvailable = message.available === true;
    return;
  }
  if (message.type === 'config') {
    setContextCommand(message.contextCommand);
    return;
  }
  if (message.type === 'resetView') {
    resetView();
    return;
  }
  if (message.type === 'clearEnabled') setClearEnabled(message.enabled);
  if (message.type === 'suggest') openAssist(true);
  if (message.type === 'format') formatCommand();
  if (message.type === 'joinLines') joinLines();
  if (message.type === 'sideStart') onSideStart(message);
  if (message.type === 'sideChunk') onSideChunk(message);
  if (message.type === 'sideEnd') onSideEnd(message);
  if (message.type === 'jpoPicked' && typeof message.path === 'string') {
    jpoPath.value = message.path;
    syncJpoPath();
    syncFieldClears();
    if (!jpoPath.disabled) jpoPath.focus();
    savePrefs();
  }
});

document.addEventListener('contextmenu', (event) => {
  if (event.defaultPrevented) return;
  event.preventDefault();
  const resText = resultSelection();
  if (resText) {
    pickText = resText;
    openPick(event.clientX, event.clientY, true);
    return;
  }
  const oid = event.target instanceof Element ? event.target.closest('.oid') : null;
  if (oid && history.contains(oid)) {
    pickText = oid.textContent ?? '';
    openPick(event.clientX, event.clientY, true);
    return;
  }
  const anyText = selectedText();
  if (anyText) {
    pickText = anyText;
    openPick(event.clientX, event.clientY, false);
    return;
  }
  closePick();
  closeRowMenu();
  closeComposerMenu();
});

history.addEventListener('wheel', () => {
  closePick();
});

history.addEventListener('scroll', () => {
  stick = history.scrollHeight - history.scrollTop - history.clientHeight < 24;
});

history.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const fold = target.closest('.fold');
  if (fold) {
    const block = fold.closest('.block');
    if (!block) return;
    setFolded(block, !block.classList.contains('collapsed'));
    return;
  }
  const gridBtn = target.closest('.block-grid');
  if (gridBtn) {
    const block = gridBtn.closest('.block');
    if (block) setGrid(block, !block.classList.contains('grid'));
    return;
  }
  const copyBtn = target.closest('.block-copy');
  if (copyBtn) {
    const text = blockContent(copyBtn.closest('.block'));
    if (text) vscode.postMessage({ type: 'copy', text });
    return;
  }
  const openBtn = target.closest('.block-open');
  if (openBtn) {
    const text = blockContent(openBtn.closest('.block'));
    if (text) vscode.postMessage({ type: 'openDocument', content: text });
    return;
  }
  if (target.closest('.block-stop')) {
    vscode.postMessage({ type: 'stop' });
    return;
  }
  const rerunBtn = target.closest('.block-rerun');
  if (rerunBtn) {
    if (rerunBtn.disabled || command.disabled) return;
    const block = rerunBtn.closest('.block');
    const stored = block ? blockText.get(block.dataset.id) : null;
    if (stored?.command) vscode.postMessage({ type: 'send', text: stored.command });
    return;
  }
  const undoBtn = target.closest('.block-undo button');
  if (undoBtn) {
    if (!command.disabled) insertStatement(undoBtn.closest('.block-undo').dataset.undo);
    return;
  }
  const hintBtn = target.closest('.block-hint button');
  if (hintBtn) {
    if (hintBtn.disabled || command.disabled) return;
    vscode.postMessage({ type: 'send', text: hintBtn.closest('.block-hint').dataset.cmd });
    return;
  }
  const button = target.closest('.command');
  if (!button) return;
  insertAtCursor(button.textContent ?? '');
});

findInput.addEventListener('input', () => {
  setFindQuery(findInput.value);
});

findInput.addEventListener('keydown', (event) => {
  if (!event.isComposing && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    const key = event.key.toLowerCase();
    if (key === 'c') {
      event.preventDefault();
      setFindOption('case', !findMatchCase);
      return;
    }
    if (key === 'w') {
      event.preventDefault();
      setFindOption('word', !findWholeWord);
      return;
    }
    if (key === 'r') {
      event.preventDefault();
      setFindOption('regex', !findUseRegex);
      return;
    }
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    moveFind(event.shiftKey ? -1 : 1);
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveFind(-1);
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveFind(1);
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    findInput.value = '';
    findInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
});

findCase.addEventListener('click', () => {
  setFindOption('case', !findMatchCase);
});

findWord.addEventListener('click', () => {
  setFindOption('word', !findWholeWord);
});

findRegex.addEventListener('click', () => {
  setFindOption('regex', !findUseRegex);
});

findPrev.addEventListener('click', () => {
  moveFind(-1);
});

findNext.addEventListener('click', () => {
  moveFind(1);
});

function isCtrlSpace(event) {
  if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return false;
  return event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar' || event.keyCode === 32;
}

function isTextField(node) {
  if (node instanceof HTMLTextAreaElement) return !node.disabled && !node.readOnly;
  if (!(node instanceof HTMLInputElement) || node.disabled || node.readOnly) return false;
  return node.type === 'text' || node.type === 'search' || node.type === '';
}

function editHistoryCommand(event) {
  if (event.isComposing || event.altKey) return '';
  if (!event.ctrlKey && !event.metaKey) return '';
  if (event.code === 'KeyY' && !event.shiftKey) return 'redo';
  if (event.code !== 'KeyZ') return '';
  return event.shiftKey ? 'redo' : 'undo';
}

function applyEditHistory(event) {
  const commandName = editHistoryCommand(event);
  const field = document.activeElement;
  if (!commandName || !isTextField(field)) return false;
  event.preventDefault();
  event.stopPropagation();
  if (field === command) {
    stepCommandHistory(commandName === 'redo');
    return true;
  }
  setTimeout(() => {
    if (document.activeElement !== field) return;
    document.execCommand(commandName);
  }, 0);
  return true;
}

function isOtherInput(node) {
  return node === findInput || node === jpoPath || node === recallFilter || drawer.contains(node);
}

window.addEventListener('keydown', (event) => {
  if (applyEditHistory(event)) return;
  if (isCtrlSpace(event)) {
    if (isOtherInput(document.activeElement)) return;
    event.preventDefault();
    event.stopPropagation();
    openAssist(true);
    return;
  }
  if (event.key === 'Escape' && (!pick.hidden || !rowMenu.hidden || !composerMenu.hidden)) {
    event.preventDefault();
    closePick();
    closeRowMenu();
    closeComposerMenu();
    return;
  }
  if (event.key !== 'f' && event.key !== 'F') return;
  if (!event.ctrlKey && !event.metaKey) return;
  if (event.altKey) return;
  if (event.shiftKey) {
    event.preventDefault();
    formatCommand();
    return;
  }
  event.preventDefault();
  closeAssist();
  findInput.focus();
  findInput.select();
}, true);

recallList.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const row = target.closest('.recall-row');
  if (!row) return;
  if (target.closest('.recall-pin')) {
    toggleRecallPin(row);
    return;
  }
  if (target.closest('.recall-delete')) {
    dropRecall(row);
    return;
  }
  if (target.closest('.recall-insert')) {
    insertAtCursor(row.dataset.text ?? '');
    return;
  }
  const block = blockById(row.dataset.id ?? '');
  if (!block) {
    insertAtCursor(row.dataset.text ?? '');
    return;
  }
  showCommand(block);
});

recallFilter.addEventListener('input', () => {
  applyRecallFilter();
});

const fieldClears = [];

function watchFieldClear(input) {
  const button = input.parentElement ? input.parentElement.querySelector('.field-x') : null;
  if (!button) return;
  const sync = () => {
    button.hidden = input.value === '';
  };
  input.addEventListener('input', sync);
  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });
  button.addEventListener('click', () => {
    if (input.value === '') return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (!input.disabled) input.focus();
  });
  fieldClears.push(sync);
  sync();
}

function syncFieldClears() {
  for (const sync of fieldClears) sync();
}

watchFieldClear(findInput);
watchFieldClear(helpFind);
watchFieldClear(listFilter);
watchFieldClear(jpoPath);
watchFieldClear(recallFilter);

recallClear.addEventListener('click', () => {
  if (recallClear.disabled) return;
  clearRecall();
});

recallSplit.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  const previous = document.body.style.userSelect;
  const startX = event.clientX;
  const startWidth = recall.getBoundingClientRect().width;
  document.body.style.userSelect = 'none';
  const move = (ev) => {
    setRecallWidth(startWidth + (startX - ev.clientX));
  };
  const up = () => {
    document.body.style.userSelect = previous;
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    savePrefs();
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
});

const CLAUSE_HEADS = new Set([
  'where',
  'select',
  'orderby',
  'limit',
  'dump',
  'recordsep',
  'tcl',
  'output',
  'from',
  'to',
  'relationship',
  'rel',
  'recurse',
  'terse',
  'vault',
  'owner',
  'policy',
  'description',
  'state',
  'current',
]);

function isLineStarter(lineText) {
  const parts = lineText.trim().toLowerCase().split(/\s+/);
  const w0 = parts[0];
  if (!w0 || CLAUSE_HEADS.has(w0)) return false;
  for (const starter of MQL_STARTERS) {
    if (starter.startsWith(w0)) {
      if (w0 === 'temp' && parts[1] && !'query'.startsWith(parts[1])) return false;
      return true;
    }
  }
  return false;
}

function statementPrefix() {
  const cursor = caretOffset();
  const text = command.value;
  let from = text.slice(0, cursor).lastIndexOf(';');
  from = from === -1 ? 0 : from + 1;
  const lineBreak = Math.max(text.lastIndexOf('\n', cursor - 1), text.lastIndexOf('\r', cursor - 1));
  if (lineBreak >= from) {
    const beforeLine = text.slice(from, lineBreak).trim();
    const currentLine = text.slice(lineBreak + 1, cursor);
    const trimmedLine = currentLine.trim();
    if (beforeLine && (!trimmedLine || isLineStarter(trimmedLine))) {
      from = lineBreak + 1;
    }
  }
  while (from < cursor && /\s/.test(text[from])) from += 1;
  return { from, to: cursor, raw: text.slice(from, cursor) };
}

function phraseKey(raw) {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase();
}

function matchPhrases(raw, force = false) {
  const key = phraseKey(raw);
  if (!key) return phrases.slice();
  const staticMatches = phrases.filter((phrase) => {
    const text = phrase.toLowerCase();
    return text.startsWith(key) && text !== key;
  });
  const dynamicMatches = [];
  const attrBracket = raw.match(/^(.*?\battribute\[)([^\]]*)$/i);
  if (attrBracket && schemaCache.has('attribute')) {
    const head = attrBracket[1];
    const partial = attrBracket[2].toLowerCase();
    for (const name of schemaCache.get('attribute')) {
      if (!partial || name.toLowerCase().startsWith(partial)) {
        dynamicMatches.push(`${head}${name}].value`);
        if (dynamicMatches.length >= 40) break;
      }
    }
  } else {
    const cmdMatch = raw.match(/^\s*(print|mod|modify|del|delete|help|list)\s+(type|policy|attribute|relationship|person|program|vault|role|group|association|command|menu|form|table|channel|portal|page)(?:\s+([^\s;]*))?$/i);
    if (cmdMatch) {
      const verb = cmdMatch[1];
      const kind = cmdMatch[2].toLowerCase();
      const partial = (cmdMatch[3] || '').replace(/^['"]|['"]$/g, '').toLowerCase();
      const cached = schemaCache.get(kind);
      if (cached) {
        for (const name of cached) {
          if (!partial || name.toLowerCase().includes(partial)) {
            const quoted = formatSchemaName(name);
            if (!quoted) continue;
            const suffix = kind === 'table' && verb.toLowerCase() === 'print' ? ' system' : '';
            const candidate = `${verb} ${kind} ${quoted}${suffix}`;
            if (candidate.toLowerCase() !== key) {
              dynamicMatches.push(candidate);
              if (dynamicMatches.length >= 40) break;
            }
          }
        }
      }
    }
  }
  const combined = [...staticMatches, ...dynamicMatches];
  if (combined.length > 0) return combined;
  const clauseMatches = [];
  const busQueryMatch = raw.match(/^(\s*(?:temp\s+)?query\s+bus\s+\S+\s+\S+\s+\S+)(?:\s+(.*))?$/i);
  if (busQueryMatch) {
    const head = busQueryMatch[1].replace(/\s+/g, ' ').trim();
    const tail = (busQueryMatch[2] || '').trim().toLowerCase();
    for (const suffix of [
      'select name id description',
      'where "attribute[???] == \'???\'"',
      'limit 0 orderby id select name id description',
    ]) {
      if (!tail || suffix.startsWith(tail)) {
        const candidate = `${head} ${suffix}`;
        if (candidate.toLowerCase() !== key) clauseMatches.push(candidate);
      }
    }
  }
  const busTargetMatch = raw.match(/^(\s*(?:print|expand)\s+bus\s+(?:\d+(?:\.\d+){3}|\S+\s+\S+\s+\S+))(?:\s+(.*))?$/i);
  if (busTargetMatch) {
    const head = busTargetMatch[1].replace(/\s+/g, ' ').trim();
    const tail = (busTargetMatch[2] || '').trim().toLowerCase();
    const isExpand = /^\s*expand\b/i.test(head);
    const suffixes = isExpand
      ? ['recurse to all select bus id current']
      : ['select name id description', 'select id current attribute[???].value'];
    for (const suffix of suffixes) {
      if (!tail || suffix.startsWith(tail)) {
        const candidate = `${head} ${suffix}`;
        if (candidate.toLowerCase() !== key) clauseMatches.push(candidate);
      }
    }
  }
  if (clauseMatches.length > 0) return clauseMatches;
  if (!force) return [];
  const firstWord = key.split(' ')[0];
  const verbMatches = phrases.filter((phrase) => phrase.toLowerCase().startsWith(firstWord));
  return verbMatches.length > 0 ? verbMatches : phrases.slice();
}

function closeAssist() {
  assist.hidden = true;
  assist.replaceChildren();
  assistMatches = [];
  assistIndex = 0;
}

function paintAssist() {
  const buttons = assist.querySelectorAll('button');
  for (let index = 0; index < buttons.length; index += 1) {
    const button = buttons[index];
    const on = index === assistIndex;
    button.classList.toggle('on', on);
    if (!on) continue;
    const top = button.offsetTop;
    const bottom = top + button.offsetHeight;
    if (top < assist.scrollTop) assist.scrollTop = top;
    else if (bottom > assist.scrollTop + assist.clientHeight) assist.scrollTop = bottom - assist.clientHeight;
  }
}

function renderAssist() {
  assist.replaceChildren();
  for (let index = 0; index < assistMatches.length; index += 1) {
    const phrase = assistMatches[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.index = String(index);
    button.textContent = phrase;
    button.title = phrase;
    button.classList.toggle('template', DDL_TEMPLATES.has(phrase));
    assist.append(button);
  }
  paintAssist();
}

function caretPoint() {
  const style = getComputedStyle(command);
  const mirror = document.createElement('div');
  mirror.style.position = 'fixed';
  mirror.style.left = '0';
  mirror.style.top = '0';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.boxSizing = 'border-box';
  mirror.style.width = command.clientWidth + 'px';
  mirror.style.border = '0';
  for (const prop of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
    mirror.style[prop] = style[prop];
  }
  mirror.textContent = command.value.slice(0, caretOffset());
  const mark = document.createElement('span');
  mark.textContent = '\u200b';
  mirror.append(mark);
  document.body.append(mirror);
  const markRect = mark.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const commandRect = command.getBoundingClientRect();
  const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
  const x = commandRect.left + borderLeft + (markRect.left - mirrorRect.left) - command.scrollLeft;
  const y = commandRect.top + (Number.parseFloat(style.borderTopWidth) || 0) + (markRect.bottom - mirrorRect.top) - command.scrollTop;
  mirror.remove();
  return { x, y };
}

function placeAssist() {
  const point = caretPoint();
  assist.hidden = false;
  assist.style.left = '0px';
  assist.style.top = '0px';
  const width = assist.offsetWidth;
  const height = assist.offsetHeight;
  const maxLeft = Math.max(8, window.innerWidth - width - 8);
  const left = Math.min(Math.max(8, point.x), maxLeft);
  let top = point.y + 2;
  if (top + height > window.innerHeight - 8) top = Math.max(8, point.y - height - 2);
  assist.style.left = left + 'px';
  assist.style.top = top + 'px';
}

function closeComposerMenu() {
  composerMenu.hidden = true;
  composerGear.setAttribute('aria-expanded', 'false');
}

function openComposerMenu() {
  closeAssist();
  closePick();
  closeRowMenu();
  const rect = composerGear.getBoundingClientRect();
  composerMenu.style.left = Math.max(8, rect.left) + 'px';
  composerMenu.style.top = rect.bottom + 4 + 'px';
  composerMenu.hidden = false;
  composerGear.setAttribute('aria-expanded', 'true');
  const width = composerMenu.offsetWidth;
  const height = composerMenu.offsetHeight;
  const maxLeft = Math.max(8, window.innerWidth - width - 8);
  const left = Math.min(Math.max(8, rect.right - width), maxLeft);
  let top = rect.bottom + 4;
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 4);
  composerMenu.style.left = left + 'px';
  composerMenu.style.top = top + 'px';
}

function setLineNumbers(on) {
  document.body.classList.toggle('line-numbers', on);
  lineNumbersItem.setAttribute('aria-checked', on ? 'true' : 'false');
  syncGutter();
}

let gutterLayout = false;

function measureLineHeights(lines, width) {
  const style = getComputedStyle(command);
  const mirror = document.createElement('div');
  mirror.style.position = 'fixed';
  mirror.style.left = '0';
  mirror.style.top = '0';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.boxSizing = 'border-box';
  mirror.style.width = width + 'px';
  mirror.style.whiteSpace = style.whiteSpace;
  mirror.style.overflowWrap = style.overflowWrap;
  mirror.style.wordWrap = style.wordWrap;
  mirror.style.wordBreak = style.wordBreak;
  mirror.style.paddingTop = style.paddingTop;
  mirror.style.paddingRight = style.paddingRight;
  mirror.style.paddingBottom = '0';
  mirror.style.paddingLeft = style.paddingLeft;
  mirror.style.border = '0';
  for (const prop of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'tabSize', 'wordSpacing']) {
    mirror.style[prop] = style[prop];
  }
  const rows = [];
  for (const line of lines) {
    const row = document.createElement('div');
    row.style.whiteSpace = style.whiteSpace;
    row.style.overflowWrap = style.overflowWrap;
    row.style.wordWrap = style.wordWrap;
    row.style.wordBreak = style.wordBreak;
    row.textContent = line.length > 0 ? line : '\u200b';
    mirror.append(row);
    rows.push(row);
  }
  document.body.append(mirror);
  const heights = rows.map((row) => row.getBoundingClientRect().height);
  mirror.remove();
  return heights;
}

function paintGutter(heights, lineHeight) {
  while (gutter.childElementCount > heights.length) gutter.lastElementChild.remove();
  while (gutter.childElementCount < heights.length) {
    const row = document.createElement('div');
    row.className = 'gutter-line';
    gutter.append(row);
  }
  for (let i = 0; i < heights.length; i += 1) {
    const row = gutter.children[i];
    const label = String(i + 1);
    if (row.textContent !== label) row.textContent = label;
    const height = heights[i] > 0 ? heights[i] : lineHeight;
    row.style.height = height + 'px';
  }
}

function absorbGutterGap(lineHeight) {
  const last = gutter.lastElementChild;
  if (!last || lineHeight <= 0) return;
  const gap = command.scrollHeight - gutter.scrollHeight;
  if (gap === 0 || Math.abs(gap) > lineHeight) return;
  const next = (parseFloat(last.style.height) || 0) + gap;
  if (next < lineHeight) return;
  last.style.height = next + 'px';
}

function layoutGutter() {
  if (gutterLayout) return;
  gutterLayout = true;
  try {
    const style = getComputedStyle(command);
    gutter.style.paddingTop = style.paddingTop;
    gutter.style.paddingBottom = style.paddingBottom;
    gutter.style.fontFamily = style.fontFamily;
    gutter.style.fontSize = style.fontSize;
    gutter.style.lineHeight = style.lineHeight;
    gutter.style.letterSpacing = style.letterSpacing;
    const lineHeight = parseFloat(style.lineHeight) || 0;
    const lines = command.value.split('\n');
    gutter.style.setProperty('--gutter-digits', String(String(Math.max(lines.length, 1)).length));
    let previous = -1;
    for (let pass = 0; pass < 4; pass += 1) {
      const width = command.clientWidth;
      if (pass > 0 && width === previous) break;
      previous = width;
      paintGutter(measureLineHeights(lines, width), lineHeight);
    }
    absorbGutterGap(lineHeight);
  } finally {
    gutterLayout = false;
  }
}

function syncGutter() {
  if (!document.body.classList.contains('line-numbers')) {
    if (gutter.childElementCount > 0) gutter.replaceChildren();
    gutter.scrollTop = 0;
    return;
  }
  if (command.clientWidth <= 0) return;
  layoutGutter();
  gutter.scrollTop = command.scrollTop;
}

function openAssist(force = false) {
  if (command.disabled) return;
  closeComposerMenu();
  const active = document.activeElement;
  if (isOtherInput(active)) return;
  if (!force && active !== command && active !== document.body && active !== document.documentElement) return;
  if (document.body.classList.contains('composer-hidden')) {
    if (!force) return;
    setComposerHidden(false);
  }
  if (document.activeElement !== command) command.focus();
  assistMatches = matchPhrases(statementPrefix().raw, force);
  assistIndex = 0;
  if (assistMatches.length === 0) {
    closeAssist();
    return;
  }
  renderAssist();
  placeAssist();
}

function moveAssist(step) {
  if (assistMatches.length === 0) return;
  assistIndex = (assistIndex + step + assistMatches.length) % assistMatches.length;
  paintAssist();
}

function acceptAssist() {
  const phrase = assistMatches[assistIndex];
  if (!phrase) return;
  const template = DDL_TEMPLATES.get(phrase);
  const text = template ? formatMqlText(template) : phrase;
  const range = statementPrefix();
  const value = command.value;
  recordCommand();
  command.value = value.slice(0, range.from) + text + value.slice(range.to);
  const caret = template ? range.from : range.from + text.length;
  command.selectionStart = caret;
  command.selectionEnd = caret;
  closeAssist();
  if (template) jumpPlaceholder(false);
  syncCommandClear();
  command.focus();
  savePrefs();
}

command.addEventListener('keydown', (event) => {
  if (isCtrlSpace(event)) {
    event.preventDefault();
    openAssist(true);
    return;
  }
  if (isHistoryKey(event)) {
    event.preventDefault();
    closeAssist();
    stepHistory(event.key === 'ArrowUp' ? 1 : -1);
    return;
  }
  if (!assist.hidden) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveAssist(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveAssist(-1);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAssist();
      return;
    }
    if ((event.key === 'Enter' && !event.ctrlKey && !event.metaKey) || event.key === 'Tab') {
      event.preventDefault();
      acceptAssist();
      return;
    }
  }
  if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey && jumpPlaceholder(event.shiftKey)) {
    event.preventDefault();
    return;
  }
  if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return;
  event.preventDefault();
  runStatement();
});

command.addEventListener('beforeinput', (event) => {
  if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
    event.preventDefault();
    stepCommandHistory(event.inputType === 'historyRedo');
    return;
  }
  recordCommand(editKind(event));
});

command.addEventListener('input', () => {
  historyAt = -1;
  syncCommandClear();
  savePrefs();
  if (assist.hidden) return;
  openAssist();
});

command.addEventListener('scroll', () => {
  if (!assist.hidden) placeAssist();
  if (document.body.classList.contains('line-numbers')) gutter.scrollTop = command.scrollTop;
});

gutter.addEventListener('wheel', (event) => {
  if (!document.body.classList.contains('line-numbers')) return;
  command.scrollTop += event.deltaY;
  command.scrollLeft += event.deltaX;
}, { passive: true });

window.addEventListener('resize', () => {
  if (!assist.hidden) placeAssist();
  closePick();
  closeRowMenu();
  closeComposerMenu();
});

new ResizeObserver(() => {
  placeCommandClear();
}).observe(command, { box: 'content-box' });

pick.addEventListener('mousedown', (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (event.button !== 0) return;
  const target = event.target;
  const button = target instanceof Element ? target.closest('button') : null;
  if (!button || button.disabled) return;
  const act = button.dataset.act || 'paste';
  const text = pickText.trim();
  const raw = pickText;
  closePick();
  window.getSelection()?.removeAllRanges();
  if (!raw) return;
  if (act === 'copy') {
    vscode.postMessage({ type: 'copy', text: raw });
    return;
  }
  if (act === 'printBus' && isObjectId(text)) {
    if (!command.disabled && !sideBusy) vscode.postMessage({ type: 'send', text: `print bus ${text};` });
    return;
  }
  if (act === 'expandBus' && isObjectId(text)) {
    if (!command.disabled) insertStatement(`expand bus ${text} recurse to all select bus id current;`);
    return;
  }
  if (act === 'editBus' && isObjectId(text)) {
    openEdit(text);
    return;
  }
  if (act === 'graphSearch') {
    const [type, name = '', revision = ''] = graphSearchTerms(text) ?? [];
    if (type) vscode.postMessage({ type: 'searchGraph', query: { type, name, revision } });
    return;
  }
  insertAtCaret(raw);
});

document.addEventListener('mousedown', (event) => {
  if (pick.hidden) return;
  const target = event.target;
  if (!(target instanceof Node) || pick.contains(target)) return;
  closePick();
});

document.addEventListener('mousedown', (event) => {
  if (rowMenu.hidden) return;
  const target = event.target;
  if (!(target instanceof Node) || rowMenu.contains(target)) return;
  closeRowMenu();
});

rowMenu.addEventListener('mousedown', (event) => {
  event.preventDefault();
  event.stopPropagation();
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('button');
  if (!button || button.disabled) return;
  const text = rowMenuText;
  const act = button.dataset.act || '';
  closeRowMenu();
  if (!text || !act) return;
  if (act === 'print') {
    const cmd = buildPrintSchemaCommand(listFetchedKind || listKind.value, text);
    if (cmd && !command.disabled && !sideBusy) vscode.postMessage({ type: 'send', text: cmd });
    return;
  }
  if (act === 'insert') {
    if (!command.disabled) insertAtCaret(text);
    return;
  }
  if (act === 'copy') vscode.postMessage({ type: 'copy', text });
});

assist.addEventListener('mousedown', (event) => {
  event.preventDefault();
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('button');
  if (!button) return;
  const index = Number(button.dataset.index);
  if (!Number.isInteger(index)) return;
  assistIndex = index;
  acceptAssist();
});

document.addEventListener('mousedown', (event) => {
  if (assist.hidden) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (assist.contains(target)) return;
  closeAssist();
});

runButton.addEventListener('click', () => {
  runStatement();
});

commandClear.addEventListener('click', () => {
  clearCommand();
});

composerToggle.addEventListener('click', () => {
  setComposerHidden(!document.body.classList.contains('composer-hidden'));
});

composerGear.addEventListener('click', () => {
  if (composerMenu.hidden) openComposerMenu();
  else closeComposerMenu();
});

composerMenu.addEventListener('mousedown', (event) => {
  event.preventDefault();
  event.stopPropagation();
  const target = event.target;
  if (!(target instanceof Element) || !target.closest('#line-numbers')) return;
  setLineNumbers(!document.body.classList.contains('line-numbers'));
  savePrefs();
  closeComposerMenu();
  if (!command.disabled && !document.body.classList.contains('composer-hidden')) command.focus();
});

document.addEventListener('mousedown', (event) => {
  if (composerMenu.hidden) return;
  const target = event.target;
  if (!(target instanceof Node) || composerMenu.contains(target) || composerGear.contains(target)) return;
  closeComposerMenu();
});

jpoToggle.addEventListener('click', () => {
  if (jpoToggle.disabled) return;
  setJpoOpen(!jpo.classList.contains('on'));
});

jpoPath.addEventListener('input', () => {
  syncJpoPath();
  savePrefs();
});

jpoBrowse.addEventListener('click', () => {
  if (jpoBrowse.disabled) return;
  vscode.postMessage({ type: 'pickJpo' });
});

jpoRun.addEventListener('click', () => {
  runJpo();
});

txCommit.addEventListener('click', () => {
  if (txCommit.disabled || command.disabled) return;
  vscode.postMessage({ type: 'send', text: 'commit transaction;' });
});

txAbort.addEventListener('click', () => {
  if (txAbort.disabled || command.disabled) return;
  vscode.postMessage({ type: 'send', text: 'abort transaction;' });
});

jpoPath.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  runJpo();
});

document.getElementById('snippets').addEventListener('mousedown', (event) => {
  if (!(event.target instanceof Element) || !event.target.closest('button')) return;
  event.preventDefault();
});

document.getElementById('snippets').addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('button');
  if (!button || button.disabled) return;
  const kind = button.dataset.insert;
  if (kind === 'context') insertStatement(contextCommand);
  else if (kind === 'verb') insertStatement('verb on;');
  else if (kind === 'temp') insertStatement('temp query bus * * *');
  else if (kind === 'print') insertStatement('print bus * * *');
  else if (kind === 'expand') insertStatement('expand bus * * * recurse to all select bus id current');
  else if (kind === 'limit') appendClause('limit 0 orderby id select name id description');
  else if (kind === 'where') appendClause('where "attribute[???] == \'???\'"', '???');
});

split.addEventListener('mousedown', (event) => {
  if (document.body.classList.contains('composer-hidden')) return;
  if (!(event.target instanceof Element) || event.target.closest('#run') || event.target.closest('#composerToggle') || event.target.closest('#composerGear') || event.target.closest('#snippets') || event.target.closest('#jpo')) return;
  closeComposerMenu();
  event.preventDefault();
  const previous = document.body.style.userSelect;
  document.body.style.userSelect = 'none';
  const move = (ev) => {
    const top = clearBar.getBoundingClientRect().bottom;
    const available = document.body.clientHeight - (top - document.body.getBoundingClientRect().top) - split.offsetHeight;
    if (available <= 0) return;
    applySplit((ev.clientY - top) / available);
  };
  const up = () => {
    document.body.style.userSelect = previous;
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    savePrefs();
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
});

railHelp.addEventListener('click', () => {
  toggleDrawer('help');
});

railList.addEventListener('click', () => {
  toggleDrawer('list');
});

railCreate.addEventListener('click', () => {
  toggleDrawer('create');
});

railEdit.addEventListener('click', () => {
  toggleDrawer('edit');
});

editView.addEventListener('input', () => {
  syncEdit();
});

efOid.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault();
  if (!drawerRefresh.disabled) void loadEdit();
});

efInsert.addEventListener('click', () => {
  if (!efInsert.disabled) insertStatement(editLines().lines.join('\n  '));
});

efRun.addEventListener('click', () => {
  if (efRun.disabled) return;
  const { lines, undo } = editLines();
  sendEdit(lines.join(' '), true, undo.join(' '));
});

efDelete.addEventListener('click', () => {
  if (efDelete.disabled) return;
  const { text, skipped } = recreateText();
  const label = skipped.length > 0 ? `${RECREATE_LABEL} · 따옴표 때문에 뺀 항목: ${[...new Set(skipped)].join(', ')}` : RECREATE_LABEL;
  sendEdit(`delete bus ${efLoaded};`, false, text, label);
});

efPromote.addEventListener('click', () => {
  if (!efPromote.disabled) sendEdit(`promote bus ${efLoaded};`, true, `demote bus ${efLoaded};`);
});

efDemote.addEventListener('click', () => {
  if (!efDemote.disabled) sendEdit(`demote bus ${efLoaded};`, true, `promote bus ${efLoaded};`);
});

efUndoCopy.addEventListener('click', () => {
  if (efUndo.textContent) vscode.postMessage({ type: 'copy', text: efUndo.textContent });
});

function isListed(list, value) {
  return [...list.options].some((option) => option.value === value);
}

createView.addEventListener('input', (event) => {
  const target = event.target;
  if (target === cfPolicy) cfPolicyAuto = false;
  const row = target instanceof Element ? target.closest('#cf-rows tbody tr') : null;
  if (row && row.dataset.status !== 'run') delete row.dataset.status;
  syncCreate();
  if (target === cfType && isListed(cfTypes, cfType.value.trim())) void loadType();
  if (target === cfPolicy && isListed(cfPolicies, cfPolicy.value.trim())) void loadPolicy();
  if (target === cfType || target.id === 'cf-name' || target.id === 'cf-rev') scheduleDuplicate();
});

cfType.addEventListener('change', () => {
  void loadType();
});

cfPolicy.addEventListener('change', () => {
  void loadPolicy();
});

cfInsert.addEventListener('click', () => {
  insertStatement(createText(createStatements()));
});

cfRun.addEventListener('click', () => {
  if (cfRun.disabled) return;
  if (isGridMode()) {
    runBatch();
    return;
  }
  const [statement] = createStatements();
  if (statement) vscode.postMessage({ type: 'send', text: statement.lines.join(' ') });
});

cfModeOne.addEventListener('click', () => {
  setCreateMode(false);
});

cfModeGrid.addEventListener('click', () => {
  setCreateMode(true);
});

cfAddRow.addEventListener('click', () => {
  addGridRow();
});

cfRows.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest('.cf-del')) return;
  removeGridRow(target.closest('tr'));
});

drawerClose.addEventListener('click', () => {
  setDrawerOpen(false);
});

drawerWide.addEventListener('click', () => {
  toggleHistory();
});

drawerSplit.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  if (!document.body.classList.contains('drawer-open')) return;
  if (document.body.classList.contains('history-hidden')) return;
  event.preventDefault();
  const previous = document.body.style.userSelect;
  const startX = event.clientX;
  const startWidth = drawer.getBoundingClientRect().width;
  document.body.style.userSelect = 'none';
  document.body.classList.add('drawer-resizing');
  const move = (ev) => {
    setDrawerWidth(startWidth + (startX - ev.clientX));
  };
  const up = () => {
    document.body.style.userSelect = previous;
    document.body.classList.remove('drawer-resizing');
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    savePrefs();
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
});

drawerRefresh.addEventListener('click', () => {
  refreshDrawer();
});

helpFind.addEventListener('input', () => {
  helpQuery = helpFind.value.trim();
  paintHelp(true, true);
});

listFilter.addEventListener('input', () => {
  applyListFilter();
});

helpTopic.addEventListener('change', () => {
  if (helpTopic.value !== helpFetchedTopic && !requestSide('help', helpText())) {
    helpTopic.value = helpFetchedTopic || '';
  }
  savePrefs();
});

listKind.addEventListener('change', () => {
  savePrefs();
  if (listKind.value === listFetchedKind) return;
  if (!requestSide('list', `list ${listKind.value}`)) listKind.value = listFetchedKind || listKind.value;
});

listView.addEventListener('contextmenu', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const row = target.closest('.list-row');
  if (!row) return;
  event.preventDefault();
  rowMenuText = row.dataset.name || '';
  if (!rowMenuText) return;
  openRowMenu(event.clientX, event.clientY);
});

listView.addEventListener('wheel', () => {
  closeRowMenu();
});

clearButton.addEventListener('click', () => {
  if (clearButton.disabled) return;
  vscode.postMessage({ type: 'clear' });
});

function resetView() {
  closeAssist();
  closePick();
  closeRowMenu();
  closeComposerMenu();
  command.value = '';
  resetCommandHistory();
  syncCommandClear();
  findInput.value = '';
  setFindQuery('');
  jpoPath.value = '';
  syncJpoPath();
  recallFilter.value = '';
  dismissedRecall.clear();
  for (const row of [...recallList.children]) {
    if (row.classList.contains('pinned')) row.dataset.id = '';
    else row.remove();
  }
  applyRecallFilter();
  syncRecallClear();
  efReload = null;
  undoHints.clear();
  forgetSymbolics();
  resetBatches();
  historyAt = -1;
  setContext('');
  helpFind.value = '';
  helpQuery = '';
  paintHelp(true, false);
  listFilter.value = '';
  applyListFilter();
  syncFieldClears();
  history.replaceChildren();
  blockText.clear();
  collapsed.clear();
  txActive = false;
  dropMeta();
  sideBusy = false;
  sideHold = false;
  sideStarted = false;
  queuedSide = null;
  syncTx();
  syncFind(false);
  syncCreate();
  savePrefs();
}

restartButton.addEventListener('click', () => {
  vscode.postMessage({ type: 'restart' });
});

syncHistory();
syncRail();
renderGridHead();
cfRowsBody.append(gridRowNode());
syncCreate();
new ResizeObserver(() => {
  syncGutter();
}).observe(command);
vscode.postMessage({ type: 'ready' });
