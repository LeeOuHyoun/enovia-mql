const vscode = acquireVsCodeApi();
const history = document.getElementById('history');
const clearButton = document.getElementById('clear');
const restartButton = document.getElementById('restart');
const clearBar = document.querySelector('.bar');
const split = document.getElementById('split');
const runButton = document.getElementById('run');
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
const railHistory = document.getElementById('rail-history');
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

function follow() {
  history.scrollTop = history.scrollHeight;
}

function setInputEnabled(enabled) {
  const wasEnabled = !command.disabled;
  command.disabled = !enabled;
  runButton.disabled = !enabled;
  for (const button of snippetButtons) button.disabled = !enabled;
  jpoToggle.disabled = !enabled;
  jpoPath.disabled = !enabled;
  syncJpoPath();
  syncDrawerControls();
  if (!enabled) closeAssist();
  if (enabled && !wasEnabled) {
    const active = document.activeElement;
    if (active !== helpFind && active !== listFilter && active !== listKind) command.focus();
    fetchDrawerIfEmpty();
  }
}

function setClearEnabled(enabled) {
  clearButton.disabled = !enabled;
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

function paintBlock(item) {
  const text = blockText.get(item.dataset.id);
  if (!text) return;
  paintText(item.querySelector('.command'), text.command);
  paintText(item.querySelector('.result'), text.result);
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
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'command';
  paintText(button, commandText);
  const result = document.createElement('pre');
  result.className = 'result';
  paintText(result, resultRaw);
  head.append(fold, button);
  item.append(head, result);
  return item;
}

function render(state) {
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

function recallNode(id, text) {
  const row = document.createElement('div');
  row.className = 'recall-row';
  row.dataset.id = String(id);
  row.dataset.text = text;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'recall';
  button.textContent = text;
  button.title = text;
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
  row.append(button, insert, remove);
  return row;
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
  recallClear.disabled = recallList.children.length === 0;
}

function addRecall(id, text) {
  const key = String(id);
  if (dismissedRecall.has(key)) return;
  for (const item of recallList.children) {
    if (item.dataset.id !== key) continue;
    item.classList.remove('missing');
    return;
  }
  const row = recallNode(id, text);
  recallList.prepend(row);
  row.hidden = !matchRecall(row);
  if (!row.hidden) recallList.scrollTop = 0;
  syncRecallClear();
}

function dropRecall(id) {
  const key = String(id);
  dismissedRecall.add(key);
  for (const item of recallList.children) {
    if (item.dataset.id !== key) continue;
    item.remove();
    break;
  }
  syncRecallClear();
}

function clearRecall() {
  for (const item of recallList.children) dismissedRecall.add(item.dataset.id);
  recallList.replaceChildren();
  syncRecallClear();
}

function setRecallWidth(width) {
  if (composer.clientWidth <= 0) return;
  const available = composer.clientWidth - recallSplit.offsetWidth;
  const minRecall = 112;
  const maxRecall = Math.max(minRecall, available - 96);
  recall.style.width = Math.min(maxRecall, Math.max(minRecall, width)) + 'px';
}

function ensureRecall(blocks) {
  for (const block of blocks) addRecall(block.id, block.command);
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

function statementAt(text, cursor) {
  const semi = text.slice(0, cursor).lastIndexOf(';');
  const next = text.indexOf(';', cursor);
  const to = next === -1 ? text.length : next + 1;
  if (semi !== -1 && text.slice(semi + 1, cursor).trim() === '') {
    if (text.slice(cursor, to).trim() === '') {
      const prev = semi === 0 ? -1 : text.lastIndexOf(';', semi - 1);
      const from = prev === -1 ? 0 : prev + 1;
      return text.slice(from, semi + 1).trim();
    }
    return text.slice(cursor, to).trim();
  }
  const from = semi === -1 ? 0 : semi + 1;
  return text.slice(from, to).trim();
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
  command.focus();
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
  command.focus();
}

function insertAtCursor(text) {
  const start = command.selectionStart ?? command.value.length;
  const end = command.selectionEnd ?? start;
  const value = command.value;
  command.value = value.slice(0, start) + text + value.slice(end);
  const caret = start + text.length;
  command.selectionStart = caret;
  command.selectionEnd = caret;
  command.focus();
}

function insertAtCaret(text) {
  const caret = caretOffset();
  const value = command.value;
  command.value = value.slice(0, caret) + text + value.slice(caret);
  const next = caret + text.length;
  command.selectionStart = next;
  command.selectionEnd = next;
  command.focus();
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
}

function syncHistory() {
  const open = !document.body.classList.contains('history-hidden');
  railHistory.setAttribute('aria-pressed', open ? 'true' : 'false');
  history.inert = !open;
  history.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function toggleHistory() {
  document.body.classList.toggle('history-hidden');
  syncHistory();
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
  if (stage.clientWidth <= 0) return;
  const available = stage.clientWidth - rail.offsetWidth;
  const minDrawer = 180;
  const maxDrawer = Math.max(minDrawer, available - 96);
  const next = Math.min(maxDrawer, Math.max(minDrawer, width));
  document.body.style.setProperty('--drawer-width', next + 'px');
}

function setDrawerOpen(open) {
  document.body.classList.toggle('drawer-open', open);
  if (open) document.body.dataset.drawer = drawerLane;
  if (!open) closeRowMenu();
  syncRail();
  if (open) fetchDrawerIfEmpty();
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
}

function applySplit(ratio) {
  const top = clearBar.getBoundingClientRect().bottom;
  const available = document.body.clientHeight - (top - document.body.getBoundingClientRect().top) - split.offsetHeight;
  const min = 72;
  const minRatio = available > min * 2 ? min / available : 0.4;
  const maxRatio = available > min * 2 ? (available - min) / available : 0.6;
  const next = Math.min(maxRatio, Math.max(minRatio, ratio));
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
    if (findQuery) {
      paintText(result, stored.result);
      syncFind(false);
    } else {
      result.textContent += message.text;
    }
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
  if (event.altKey || event.shiftKey) return;
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
  if (target.closest('.recall-delete')) {
    dropRecall(row.dataset.id ?? '');
    return;
  }
  if (target.closest('.recall-insert')) {
    insertAtCursor(row.dataset.text ?? '');
    return;
  }
  const block = blockById(row.dataset.id ?? '');
  if (!block) return;
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
  command.focus();
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

composerToggle.addEventListener('click', () => {
  setComposerHidden(!document.body.classList.contains('composer-hidden'));
});

jpoToggle.addEventListener('click', () => {
  if (jpoToggle.disabled) return;
  setJpoOpen(!jpo.classList.contains('on'));
});

jpoPath.addEventListener('input', () => {
  syncJpoPath();
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
  if (!(event.target instanceof Element) || event.target.closest('#run') || event.target.closest('#composerToggle') || event.target.closest('#snippets') || event.target.closest('#jpo')) return;
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
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
});

railHistory.addEventListener('click', () => {
  toggleHistory();
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
