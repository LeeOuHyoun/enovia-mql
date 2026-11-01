const vscode = acquireVsCodeApi();
const history = document.getElementById('history');
const statusNode = document.getElementById('status');
const statusText = document.getElementById('status-text');
const clearButton = document.getElementById('clear');
const restartButton = document.getElementById('restart');
const clearBar = document.querySelector('.bar');
const split = document.getElementById('split');
const runButton = document.getElementById('run');
const commandClear = document.getElementById('commandClear');
const composerToggle = document.getElementById('composerToggle');
const snippetButtons = document.querySelectorAll('#snippets button');
const jpo = document.getElementById('jpo');
const jpoToggle = document.getElementById('jpoToggle');
const jpoPath = document.getElementById('jpoPath');
const jpoRun = document.getElementById('jpoRun');
const composer = document.getElementById('composer');
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
const helpFind = document.getElementById('help-find');
const helpView = document.getElementById('help-view');
const listKind = document.getElementById('list-kind');
const listFilter = document.getElementById('list-filter');
const listView = document.getElementById('list-view');
const drawerRefresh = document.getElementById('drawer-refresh');
const drawerClose = document.getElementById('drawer-close');
const drawerWide = document.getElementById('drawer-wide');
const rowMenu = document.getElementById('row-menu');
const collapsed = new Set();
const blockText = new Map();
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
  'add bus',
  'modify bus',
  'delete bus',
  'expand bus * * *',
  'connect bus',
  'disconnect bus',
  'promote bus',
  'demote bus',
  'set context user creator;',
  'insert prog',
  'start transaction;',
  'commit transaction;',
  'abort transaction;',
  'help;',
  'version;',
  'quit;',
  'exit;',
];
let assistIndex = 0;
let assistMatches = [];
let pickText = '';
let drawerLane = '';
let helpRaw = '';
let helpQuery = '';
let helpFetched = false;
let listRaw = '';
let listCut = 0;
let listFetchedKind = '';
let sentKind = 'type';
let sideBusy = false;
let sideStarted = false;
let activeToken = 0;
let sideToken = 0;
let pendingLane = '';
let rowMenuText = '';
let hydrated = false;
let splitRatio = 0.6;
let recallWidth = 200;
let drawerWidth = 300;

function follow() {
  history.scrollTop = history.scrollHeight;
}

function syncCommandClear() {
  commandClear.disabled = command.disabled || command.value === '';
}

function clearCommand() {
  if (command.disabled || command.value === '') return;
  closeAssist();
  command.value = '';
  syncCommandClear();
  command.focus();
  savePrefs();
}

function syncStatus() {
  const hasBlocks = history.querySelector('.block') !== null;
  const hasNotices = history.querySelector('.notice') !== null;
  const blockRunning = !command.disabled && clearButton.disabled && hasBlocks;
  const busy = sideBusy || blockRunning;
  for (const button of history.querySelectorAll('.block-rerun')) {
    button.disabled = command.disabled || busy;
  }
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
  syncCommandClear();
  syncJpoPath();
  syncDrawerControls();
  syncStatus();
  if (!enabled) closeAssist();
  if (enabled && !wasEnabled) {
    const active = document.activeElement;
    if (active !== helpFind && active !== listFilter && active !== listKind) command.focus();
    fetchDrawerIfEmpty();
  }
}

function setClearEnabled(enabled) {
  clearButton.disabled = !enabled;
  syncStatus();
  if (enabled) fetchDrawerIfEmpty();
}

function noticeNode(text) {
  const node = document.createElement('p');
  node.className = 'notice';
  node.textContent = text;
  return node;
}

function foldIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
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

function paintSpans(node, text, spans) {
  if (!spans || spans.length === 0) {
    node.textContent = text;
    return;
  }
  const frag = document.createDocumentFragment();
  let from = 0;
  for (const [start, end] of spans) {
    if (start < from) continue;
    if (start > from) frag.append(document.createTextNode(text.slice(from, start)));
    const mark = document.createElement('mark');
    mark.className = 'hit';
    mark.textContent = text.slice(start, end);
    frag.append(mark);
    from = end;
  }
  if (from < text.length) frag.append(document.createTextNode(text.slice(from)));
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

function hasErrorLine(text) {
  return /(?:^|\n)\s*(?:Error:|System Error:|#\d+\s*:\s*Error)/i.test(text);
}

function paintResult(node, raw) {
  const text = cleanResult(raw);
  const block = node.closest('.block');
  if (block) block.classList.toggle('error', hasErrorLine(text));
  if (findQuery && !findBad) {
    paintSpans(node, text, findSpans(text, findQuery, findMatchCase, findWholeWord, findUseRegex));
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
    if (/^\s*(?:Error:|System Error:|#\d+\s*:\s*Error)/i.test(line)) {
      const span = document.createElement('span');
      span.className = 'res-err';
      span.textContent = line;
      frag.append(span);
      continue;
    }
    if (/^\s*(?:Warning:|#\d+\s*:\s*Warning)/i.test(line)) {
      const span = document.createElement('span');
      span.className = 'res-warn';
      span.textContent = line;
      frag.append(span);
      continue;
    }
    const kv = line.match(/^(\s*[A-Za-z0-9_.\-[\]]+\s*=\s*)(.+)$/);
    if (kv) {
      const keySpan = document.createElement('span');
      keySpan.className = 'res-key';
      keySpan.textContent = kv[1];
      frag.append(keySpan, document.createTextNode(kv[2]));
      continue;
    }
    frag.append(document.createTextNode(line));
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

function blockNode(block) {
  const id = String(block.id);
  const commandText = block.command;
  const resultRaw = block.result || '';
  blockText.set(id, { command: commandText, result: resultRaw });
  const item = document.createElement('div');
  item.className = 'block';
  item.dataset.id = id;
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
  const badge = document.createElement('span');
  badge.className = 'block-badge';
  badge.textContent = `#${id}`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'command';
  paintText(button, commandText);
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
  actions.append(copyBtn, rerunBtn);
  const result = document.createElement('pre');
  result.className = 'result';
  head.append(fold, badge, button, actions);
  item.append(head, result);
  paintResult(result, resultRaw);
  return item;
}

function render(state) {
  if (!hydrated && state.prefs) hydratePrefs(state.prefs);
  const nodes = [];
  for (const notice of state.notices) nodes.push(noticeNode(notice));
  for (const block of state.blocks) nodes.push(blockNode(block));
  history.replaceChildren(...nodes);
  pruneBlockState();
  ensureRecall(state.blocks);
  markRecall();
  setInputEnabled(state.inputEnabled);
  setClearEnabled(state.clearEnabled);
  follow();
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
      commandText: command.value,
      splitRatio,
      recallWidth,
      drawerWidth,
      composerHidden: document.body.classList.contains('composer-hidden'),
      historyHidden: document.body.classList.contains('history-hidden'),
      drawerLane: open ? drawerLane : '',
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
  if (prefs.historyHidden) {
    document.body.classList.add('history-hidden');
    syncHistory();
  }
  if (typeof prefs.listKind === 'string' && prefs.listKind) {
    listKind.value = prefs.listKind;
    sentKind = listKind.value;
  }
  if (prefs.drawerLane === 'help' || prefs.drawerLane === 'list') {
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
      if (isStarterSequence(restWords, 0)) {
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
  if ((w0 === 'print' || w0 === 'expand' || w0 === 'modify' || w0 === 'add' || w0 === 'delete' || w0 === 'promote' || w0 === 'demote' || w0 === 'connect' || w0 === 'disconnect') && (w1 === 'bus' || w1 === 'businessobject')) {
    if (words[2] && /^[0-9]+(\.[0-9]+)+$/.test(words[2].value)) return 3;
    return Math.min(words.length, 5);
  }
  if ((w0 === 'print' || w0 === 'list' || w0 === 'modify' || w0 === 'add' || w0 === 'delete') && MQL_HEADER_TARGETS.has(w1)) {
    return Math.min(words.length, w1 === 'context' ? 2 : 3);
  }
  return 1;
}

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
  if ((w0 === 'modify' || w0 === 'add') && (w1 === 'bus' || w1 === 'businessobject') && (lower === 'description' || lower === 'policy' || lower === 'vault' || lower === 'owner' || lower === 'current')) {
    return true;
  }
  return false;
}

function formatSingleStatement(words) {
  if (words.length === 0) return '';
  const headerEnd = minHeaderLength(words);
  const lines = [];
  let currentLine = [];
  let inSelect = false;

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i].value;
    const lower = word.toLowerCase();
    const shouldBreak = isClauseBreak(words, i, headerEnd) && !(inSelect && lower !== 'where' && lower !== 'dump' && lower !== 'recordsep' && lower !== 'tcl' && lower !== 'output' && lower !== 'orderby' && lower !== 'limit');

    if (shouldBreak && currentLine.length > 0) {
      lines.push(lines.length === 0 ? currentLine.join(' ') : '  ' + currentLine.join(' '));
      currentLine = [];
      inSelect = lower === 'select';
    } else if (i >= headerEnd && lower === 'select') {
      inSelect = true;
    }

    currentLine.push(word);
  }

  if (currentLine.length > 0) {
    lines.push(lines.length === 0 ? currentLine.join(' ') : '  ' + currentLine.join(' '));
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
    command.value = value.slice(0, start) + formatted + value.slice(end);
    command.selectionStart = start;
    command.selectionEnd = start + formatted.length;
  } else {
    const formatted = formatMqlText(value);
    if (!formatted) return;
    command.value = formatted;
    const caret = formatted.length;
    command.selectionStart = caret;
    command.selectionEnd = caret;
  }
  syncCommandClear();
  command.focus();
  savePrefs();
}

function statementAt(text, cursor) {
  const statements = splitMqlStatements(text);
  if (statements.length === 0) return '';
  for (const stmt of statements) {
    if (cursor >= stmt.start && cursor <= stmt.end) {
      return flattenStatement(stmt.words);
    }
  }
  let chosen = statements[0];
  for (const stmt of statements) {
    if (stmt.start <= cursor) chosen = stmt;
    else break;
  }
  return flattenStatement(chosen.words);
}

function statementAtCursor() {
  return statementAt(command.value, caretOffset());
}

function runStatement() {
  closeAssist();
  if (command.disabled) return;
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
  if (command.disabled) return;
  const text = jpoCommand();
  if (!text) {
    jpoPath.focus();
    return;
  }
  vscode.postMessage({ type: 'send', text });
}

function insertStatement(text) {
  if (command.disabled) return;
  const current = command.value;
  command.value = current.trim() === '' ? text : current.replace(/\s*$/, '') + '\n' + text;
  const caret = command.value.length;
  command.selectionStart = caret;
  command.selectionEnd = caret;
  syncCommandClear();
  command.focus();
  savePrefs();
}

function appendClause(text, pick) {
  if (command.disabled) return;
  const value = command.value;
  const trimmed = value.replace(/\s+$/, '');
  const cut = trimmed.endsWith(';') ? trimmed.length - 1 : trimmed.length;
  const head = value.slice(0, cut);
  const tail = value.slice(cut);
  const gap = head.length > 0 && !/\s$/.test(head) ? ' ' : '';
  const insertedAt = head.length + gap.length;
  command.value = head + gap + text + tail;
  const at = pick ? text.indexOf(pick) : -1;
  const start = insertedAt + (at === -1 ? text.length : at);
  const end = at === -1 ? start : start + pick.length;
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
  const anchorResult = anchor.closest('.result');
  const focusResult = focus.closest('.result');
  if (!anchorResult || anchorResult !== focusResult || !history.contains(anchorResult)) return '';
  return text;
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

function openPick(x, y) {
  closeAssist();
  closeRowMenu();
  placeFixed(pick, x, y);
}

function closeRowMenu() {
  rowMenu.hidden = true;
  rowMenuText = '';
}

function openRowMenu(x, y) {
  closeAssist();
  closePick();
  placeFixed(rowMenu, x, y);
}

function isPromptLine(line) {
  return /^MQL<\d+>$/.test(line.trim());
}

function isPromptTail(line) {
  const text = line.trim();
  return text === 'MQL' || /^MQL<\d*>?$/.test(text);
}

function syncDrawerControls() {
  const locked = command.disabled || sideBusy;
  drawerRefresh.disabled = locked;
  listKind.disabled = locked;
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
    listView.append(row);
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
  if (sideBusy || command.disabled) return false;
  sideToken += 1;
  activeToken = sideToken;
  pendingLane = lane;
  sideBusy = true;
  sideStarted = false;
  if (lane === 'list') sentKind = listKind.value;
  syncDrawerControls();
  vscode.postMessage({ type: 'side', lane, text, token: activeToken });
  return true;
}

function fetchDrawerIfEmpty() {
  if (!document.body.classList.contains('drawer-open') || sideBusy || command.disabled) return;
  if (drawerLane === 'help') {
    if (!helpFetched) requestSide('help', 'help');
    return;
  }
  if (listFetchedKind !== listKind.value) requestSide('list', `list ${listKind.value}`);
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
  if (open) fetchDrawerIfEmpty();
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
  if (drawerLane === 'help') requestSide('help', 'help');
  else requestSide('list', `list ${listKind.value}`);
}

function onSideStart(message) {
  if (message.token !== activeToken || message.lane !== pendingLane) return;
  sideStarted = true;
  if (message.lane === 'help') {
    helpRaw = '';
    paintHelp(false, false);
    return;
  }
  resetList();
}

function onSideChunk(message) {
  if (message.token !== activeToken || message.lane !== pendingLane) return;
  if (message.lane === 'help') {
    helpRaw += message.text;
    paintHelp(false, false);
    return;
  }
  listRaw += message.text;
  appendList(false);
}

function onSideEnd(message) {
  if (message.token !== activeToken) return;
  const started = sideStarted;
  const lane = pendingLane;
  sideBusy = false;
  sideStarted = false;
  if (started && lane === 'help') {
    paintHelp(true, false);
    helpFetched = true;
  }
  if (started && lane === 'list') {
    appendList(true);
    listFetchedKind = sentKind;
  }
  syncDrawerControls();
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
  if (hidden) closeAssist();
  else if (!command.disabled) command.focus();
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
    render(message);
    return;
  }
  if (message.type === 'block') {
    history.append(blockNode(message));
    addRecall(message.id, message.command);
    syncStatus();
    if (findQuery) syncFind(false);
    follow();
    return;
  }
  if (message.type === 'chunk') {
    const id = String(message.id);
    const stored = blockText.get(id);
    const result = findResult(message.id);
    if (!result || !stored) return;
    stored.result += message.text;
    paintResult(result, stored.result);
    if (findQuery) syncFind(false);
    follow();
    return;
  }
  if (message.type === 'cleared') {
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
  if (message.type === 'clearEnabled') setClearEnabled(message.enabled);
  if (message.type === 'suggest') openAssist();
  if (message.type === 'format') formatCommand();
  if (message.type === 'sideStart') onSideStart(message);
  if (message.type === 'sideChunk') onSideChunk(message);
  if (message.type === 'sideEnd') onSideEnd(message);
});

history.addEventListener('mouseup', (event) => {
  if (event.button !== 0) return;
  const text = resultSelection();
  if (!text) {
    closePick();
    return;
  }
  pickText = text;
  openPick(event.clientX, event.clientY);
});

history.addEventListener('wheel', () => {
  closePick();
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
  const copyBtn = target.closest('.block-copy');
  if (copyBtn) {
    const block = copyBtn.closest('.block');
    const stored = block ? blockText.get(block.dataset.id) : null;
    if (!stored) return;
    const text = cleanResult(stored.result) || stored.command;
    if (text) vscode.postMessage({ type: 'copy', text });
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
    setFindQuery('');
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

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && (!pick.hidden || !rowMenu.hidden)) {
    event.preventDefault();
    closePick();
    closeRowMenu();
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
});

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

function statementPrefix() {
  const cursor = caretOffset();
  const text = command.value;
  let from = text.slice(0, cursor).lastIndexOf(';');
  from = from === -1 ? 0 : from + 1;
  while (from < cursor && /\s/.test(text[from])) from += 1;
  return { from, to: cursor, raw: text.slice(from, cursor) };
}

function phraseKey(raw) {
  return raw.replace(/\s+/g, ' ').replace(/^\s+/, '').toLowerCase();
}

function matchPhrases(raw) {
  const key = phraseKey(raw);
  if (!key.trim()) return phrases.slice();
  return phrases.filter((phrase) => {
    const text = phrase.toLowerCase();
    return text.startsWith(key) && text !== key.trim();
  });
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

function openAssist() {
  if (command.disabled) return;
  const active = document.activeElement;
  if (active !== command && active !== document.body && active !== document.documentElement) return;
  if (active !== command) command.focus();
  assistMatches = matchPhrases(statementPrefix().raw);
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
  const range = statementPrefix();
  const value = command.value;
  command.value = value.slice(0, range.from) + phrase + value.slice(range.to);
  const caret = range.from + phrase.length;
  command.selectionStart = caret;
  command.selectionEnd = caret;
  closeAssist();
  syncCommandClear();
  command.focus();
  savePrefs();
}

command.addEventListener('keydown', (event) => {
  if (event.key === ' ' && event.ctrlKey && !event.altKey && !event.shiftKey) {
    event.preventDefault();
    openAssist();
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
  if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return;
  event.preventDefault();
  runStatement();
});

command.addEventListener('input', () => {
  syncCommandClear();
  savePrefs();
  if (assist.hidden) return;
  openAssist();
});

command.addEventListener('scroll', () => {
  if (!assist.hidden) placeAssist();
});

window.addEventListener('resize', () => {
  if (!assist.hidden) placeAssist();
  closePick();
  closeRowMenu();
});

pick.addEventListener('mousedown', (event) => {
  event.preventDefault();
  event.stopPropagation();
  const text = pickText;
  closePick();
  if (!text) return;
  insertAtCaret(text);
  window.getSelection()?.removeAllRanges();
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
  const text = rowMenuText;
  const act = button ? button.dataset.act : '';
  closeRowMenu();
  if (!text || !act) return;
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

jpoToggle.addEventListener('click', () => {
  if (jpoToggle.disabled) return;
  setJpoOpen(!jpo.classList.contains('on'));
});

jpoPath.addEventListener('input', () => {
  syncJpoPath();
  savePrefs();
});

jpoRun.addEventListener('click', () => {
  runJpo();
});

jpoPath.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  runJpo();
});

document.getElementById('snippets').addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('button');
  if (!button || button.disabled) return;
  const kind = button.dataset.insert;
  if (kind === 'context') insertStatement('set context user creator;');
  else if (kind === 'temp') insertStatement('temp query bus * * *');
  else if (kind === 'print') insertStatement('print bus * * *');
  else if (kind === 'limit') appendClause('limit 0 orderby id select name id description');
  else if (kind === 'where') appendClause('where "attribute[???] == \'???\'"', '???');
});

split.addEventListener('mousedown', (event) => {
  if (document.body.classList.contains('composer-hidden')) return;
  if (!(event.target instanceof Element) || event.target.closest('#run') || event.target.closest('#commandClear') || event.target.closest('#composerToggle') || event.target.closest('#snippets') || event.target.closest('#jpo')) return;
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

restartButton.addEventListener('click', () => {
  vscode.postMessage({ type: 'restart' });
});

syncHistory();
syncRail();
vscode.postMessage({ type: 'ready' });
