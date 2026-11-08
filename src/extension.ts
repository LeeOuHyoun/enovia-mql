import * as vscode from 'vscode';
import { MqlSession } from './session';

const failNotice = 'mql을 시작하지 못했습니다';
const batchNotice = '배치가 표준 입력을 넘기지 못해 프롬프트가 오지 않았습니다';
const contextCommand = 'set context user creator;';
const prefsKey = 'enovia-mql.prefs';
const maxRecalls = 200;
const bootTimeoutMs = 1500;

type Block = {
  id: number;
  command: string;
  result: string;
  reset?: boolean;
};

type SideLane = 'help' | 'list' | 'meta';

type RecallItem = {
  text: string;
  pinned?: boolean;
};

type SavedPrefs = {
  recalls: RecallItem[];
  jpoOpen: boolean;
  jpoPath: string;
  commandText: string;
  splitRatio: number;
  recallWidth: number;
  drawerWidth: number;
  composerHidden: boolean;
  historyHidden: boolean;
  drawerLane: '' | 'help' | 'list' | 'create' | 'edit';
  helpTopic: string;
  listKind: string;
};

type Outbound =
  | {
      type: 'state';
      inputEnabled: boolean;
      clearEnabled: boolean;
      blocks: Block[];
      notices: string[];
      prefs: SavedPrefs;
      runningId?: number;
    }
  | { type: 'block'; id: number; command: string }
  | { type: 'blockDone'; id: number }
  | { type: 'reset'; id: number }
  | { type: 'chunk'; id: number; text: string }
  | { type: 'cleared' }
  | { type: 'input'; enabled: boolean }
  | { type: 'clearEnabled'; enabled: boolean }
  | { type: 'suggest' }
  | { type: 'format' }
  | { type: 'joinLines' }
  | { type: 'sideStart'; lane: SideLane; token: number }
  | { type: 'sideChunk'; lane: SideLane; token: number; text: string }
  | { type: 'sideEnd'; lane: SideLane; token: number }
  | { type: 'jpoPicked'; path: string };

export function activate(context: vscode.ExtensionContext) {
  const host = new MqlHost(context.extensionUri, context.globalState);
  const status = vscode.window.createStatusBarItem('enovia-mql.open', vscode.StatusBarAlignment.Left, 100);
  status.name = 'ENOVIA MQL';
  status.text = '$(terminal)';
  status.tooltip = 'ENOVIA MQL 뷰 열기';
  status.command = 'enovia-mql.show';
  status.show();
  context.subscriptions.push(
    vscode.commands.registerCommand('enovia-mql.show', () => {
      host.show();
    }),
    vscode.commands.registerCommand('enovia-mql.suggest', () => {
      host.suggest();
    }),
    vscode.commands.registerCommand('enovia-mql.format', () => {
      host.format();
    }),
    vscode.commands.registerCommand('enovia-mql.joinLines', () => {
      host.joinLines();
    }),
    status,
    host,
  );
}

export function deactivate() {}

class MqlHost implements vscode.Disposable {
  private readonly views: MqlView[] = [];
  private readonly slots = new Set<number>();
  private prefs: SavedPrefs;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly state: vscode.Memento,
  ) {
    this.prefs = parsePrefs(this.state.get(prefsKey));
  }

  dispose() {
    for (const view of [...this.views]) view.dispose();
  }

  show() {
    let slot = 1;
    while (this.slots.has(slot)) slot += 1;
    this.slots.add(slot);
    const view = new MqlView(
      this.extensionUri,
      slot,
      () => this.prefs,
      (raw) => {
        this.prefs = parsePrefs(raw, this.prefs);
        void this.state.update(prefsKey, this.prefs);
      },
      () => {
        this.slots.delete(slot);
        const index = this.views.indexOf(view);
        if (index >= 0) this.views.splice(index, 1);
      },
    );
    this.views.push(view);
    view.open();
  }

  suggest() {
    const view = this.views.find((item) => item.focused()) ?? this.views[this.views.length - 1];
    view?.suggest();
  }

  format() {
    const view = this.views.find((item) => item.focused()) ?? this.views[this.views.length - 1];
    view?.format();
  }

  joinLines() {
    const view = this.views.find((item) => item.focused()) ?? this.views[this.views.length - 1];
    view?.joinLines();
  }
}

class MqlView implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private panelListeners: vscode.Disposable | undefined;
  private disposed = false;
  private domReady = false;
  private inputEnabled = false;
  private holding = false;
  private closeAfterEnd = false;
  private booting = false;
  private recovering = false;
  private lastContextCommand = '';
  private verbOn = false;
  private txActive = false;
  private bootQueue: string[] = [];
  private commandQueue: string[] = [];
  private pendingSide: { lane: SideLane; text: string; token: number } | undefined;
  private bootTimer: ReturnType<typeof setTimeout> | undefined;
  private activeId: number | undefined;
  private blockOpen = false;
  private sideLane: SideLane | undefined;
  private sideToken = 0;
  private nextId = 0;
  private blocks: Block[] = [];
  private notices: string[] = [];
  private readonly session: MqlSession;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly slot: number,
    private readonly getPrefs: () => SavedPrefs,
    private readonly savePrefs: (raw: unknown) => void,
    private readonly onClosed: () => void,
  ) {
    this.session = new MqlSession({
      output: (text) => this.onOutput(text),
      ready: () => this.onReadySession(),
      released: () => this.onReleased(),
      failed: () => this.onFailed(),
      ended: (text) => this.onEnded(text),
      batch: () => this.onBatch(),
      prompted: () => this.onPrompted(),
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearTimers();
    this.panelListeners?.dispose();
    this.panelListeners = undefined;
    const panel = this.panel;
    this.panel = undefined;
    panel?.dispose();
    this.session.stop();
    this.onClosed();
  }

  focused() {
    return this.panel?.active === true;
  }

  suggest() {
    this.post({ type: 'suggest' });
  }

  format() {
    this.post({ type: 'format' });
  }

  joinLines() {
    this.post({ type: 'joinLines' });
  }

  open() {
    const title = this.slot === 1 ? 'ENOVIA MQL' : `ENOVIA MQL ${this.slot}`;
    const panel = vscode.window.createWebviewPanel('enovia-mql', title, vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    });
    panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'icon.png');
    this.panel = panel;
    this.domReady = false;
    this.panelListeners = vscode.Disposable.from(
      panel.onDidDispose(() => {
        this.panel = undefined;
        this.dispose();
      }),
      panel.webview.onDidReceiveMessage((message: unknown) => {
        this.onMessage(message);
      }),
    );
    void this.setHtml(panel).then(() => {
      if (this.panel !== panel) return;
      this.begin();
    });
  }

  private async setHtml(panel: vscode.WebviewPanel) {
    const webview = panel.webview;
    const htmlUri = vscode.Uri.joinPath(this.extensionUri, 'media', 'view.html');
    const bytes = await vscode.workspace.fs.readFile(htmlUri);
    const css = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'view.css'));
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'view.js'));
    if (this.panel !== panel) return;
    webview.html = new TextDecoder()
      .decode(bytes)
      .replaceAll('{{csp}}', webview.cspSource)
      .replaceAll('{{css}}', css.toString())
      .replaceAll('{{js}}', script.toString());
  }

  private begin() {
    if (this.session.running) return;
    this.clearTimers();
    this.booting = true;
    this.recovering = false;
    this.bootQueue = [];
    this.commandQueue = [];
    this.cancelPendingSide();
    this.lastContextCommand = '';
    this.verbOn = false;
    this.txActive = false;
    this.finishSide(false);
    this.inputEnabled = false;
    this.holding = false;
    this.blockOpen = false;
    this.activeId = undefined;
    this.notices = [];
    this.postState();
    this.session.start();
  }

  private onMessage(message: unknown) {
    if (!isRecord(message) || typeof message.type !== 'string') return;
    if (message.type === 'ready') {
      this.domReady = true;
      this.postState();
      return;
    }
    if (message.type === 'send' && typeof message.text === 'string') {
      void this.confirmSend(message.text, message.confirm === true);
      return;
    }
    if (message.type === 'stop') {
      void this.onStop();
      return;
    }
    if (message.type === 'side' && (message.lane === 'help' || message.lane === 'list' || message.lane === 'meta') && typeof message.text === 'string') {
      const token = typeof message.token === 'number' ? message.token : 0;
      this.onSide(message.lane, message.text, token);
      return;
    }
    if (message.type === 'copy' && typeof message.text === 'string') {
      void vscode.env.clipboard.writeText(message.text);
      return;
    }
    if (message.type === 'prefs') {
      this.savePrefs(message.prefs);
      return;
    }
    if (message.type === 'pickJpo') {
      void this.onPickJpo();
      return;
    }
    if (message.type === 'clear') this.onClear();
    if (message.type === 'restart') this.onRestart();
  }

  private async onPickJpo() {
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    const defaultUri = activeUri?.scheme === 'file' ? activeUri : undefined;
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: true,
      canSelectFolders: false,
      defaultUri,
      filters: {
        'JPO Java Files': ['java'],
        'All Files': ['*'],
      },
      title: 'JPO 파일 선택',
    });
    const picked = uris?.[0]?.fsPath;
    if (picked) this.post({ type: 'jpoPicked', path: picked });
  }

  private async confirmSend(text: string, force = false) {
    const destructive = isDestructive(text);
    if (!destructive && !force) {
      this.onSend(text);
      return;
    }
    const run = '실행';
    const withTx = '트랜잭션 시작 후 실행';
    const advice = isDelete(text) ? ' 운영 환경에서는 del 대신 mod 사용을 권장합니다.' : '';
    const picked = await vscode.window.showWarningMessage(
      `${destructive ? '되돌리기 어려운' : '데이터베이스를 변경하는'} 명령을 실행할까요?\n\n${withSemicolon(text)}`,
      {
        modal: true,
        detail: this.txActive
          ? '현재 트랜잭션 안에서 실행됩니다.'
          : `트랜잭션 밖에서 실행하면 되돌릴 수 없습니다.${advice}`,
      },
      ...(this.txActive ? [run] : [withTx, run]),
    );
    if (!picked || this.disposed) return;
    if (picked === withTx) this.onSend('start transaction;');
    this.onSend(text);
  }

  private async onStop() {
    const id = this.activeId;
    if (!this.blockOpen || this.booting || this.sideLane || id == null) return;
    if (this.txActive) {
      const stop = '중단';
      const picked = await vscode.window.showWarningMessage(
        '실행을 중단할까요?',
        { modal: true, detail: '세션을 다시 연결하므로 진행 중인 트랜잭션은 롤백됩니다.' },
        stop,
      );
      if (picked !== stop || this.disposed || !this.blockOpen || this.activeId !== id) return;
    }
    this.commandQueue = [];
    this.cancelPendingSide();
    this.recoverSession();
  }

  private onSend(text: string) {
    if (this.sideLane) return;
    if (this.holding || this.booting || this.recovering || !this.inputEnabled) {
      if (this.holding || this.booting || this.recovering) this.commandQueue.push(text);
      return;
    }
    this.sendCommand(text);
  }

  private onSide(lane: SideLane, text: string, token: number) {
    const command = sideCommand(lane, text);
    if (!command || this.sideLane) {
      this.post({ type: 'sideEnd', lane, token });
      return;
    }
    if (this.booting || this.recovering || this.holding || !this.inputEnabled) {
      if (this.booting || this.recovering || this.holding) {
        this.pendingSide = { lane, text, token };
        return;
      }
      this.post({ type: 'sideEnd', lane, token });
      return;
    }
    this.beginSide(lane, command, token, text);
  }

  private beginSide(lane: SideLane, command: string, token: number, raw: string) {
    if (!this.session.canSend() || !this.session.arm()) {
      this.pendingSide = { lane, text: raw, token };
      if (!this.booting) this.recoverSession();
      return;
    }
    this.sideLane = lane;
    this.sideToken = token;
    this.holding = true;
    this.post({ type: 'sideStart', lane, token });
    this.post({ type: 'input', enabled: false });
    this.postClear();
    if (!this.session.send(command)) {
      this.pendingSide = { lane, text: raw, token };
      this.recoverSession();
    }
  }

  private cancelPendingSide() {
    const side = this.pendingSide;
    this.pendingSide = undefined;
    if (!side || this.sideLane) return;
    this.post({ type: 'sideEnd', lane: side.lane, token: side.token });
  }

  private sendCommand(text: string) {
    const command = withSemicolon(text);
    if (!command) return;
    if (this.holding) {
      this.commandQueue.unshift(text);
      return;
    }
    if (!this.session.canSend() || !this.session.arm()) {
      if (!this.booting) this.commandQueue.unshift(text);
      this.recoverSession();
      return;
    }
    this.closeAfterEnd = isSessionEnd(command);
    const block: Block = { id: ++this.nextId, command, result: '' };
    this.blocks.push(block);
    this.activeId = block.id;
    this.blockOpen = true;
    this.holding = true;
    this.post({ type: 'block', id: block.id, command: block.command });
    this.postClear();
    if (!this.session.send(command)) {
      this.settleHistoryBlock();
      this.holding = false;
      this.activeId = undefined;
      if (!this.booting) this.commandQueue.unshift(text);
      this.recoverSession();
      return;
    }
    if (this.booting) this.scheduleBootTimeout();
  }

  private onRestart() {
    this.clearTimers();
    this.closeAfterEnd = false;
    this.recovering = false;
    this.commandQueue = [];
    this.cancelPendingSide();
    this.finishSide(false);
    this.holding = false;
    this.blocks = [];
    this.nextId = 0;
    this.activeId = undefined;
    this.savePrefs({
      ...this.getPrefs(),
      recalls: this.getPrefs().recalls.filter((item) => item.pinned),
      jpoPath: '',
      commandText: '',
    });
    this.session.stop();
    this.begin();
  }

  private onClear() {
    if (!this.clearEnabled()) return;
    this.blocks = [];
    this.blockOpen = false;
    this.activeId = undefined;
    this.post({ type: 'cleared' });
  }

  private onOutput(text: string) {
    if (this.booting) this.scheduleBootTimeout();
    if (this.sideLane) {
      this.post({ type: 'sideChunk', lane: this.sideLane, token: this.sideToken, text });
      return;
    }
    if (this.activeId == null) return;
    const block = this.blocks.find((item) => item.id === this.activeId);
    if (!block) return;
    block.result += text;
    this.post({ type: 'chunk', id: block.id, text });
  }

  private onReadySession() {
    if (this.booting) {
      this.scheduleBootTimeout();
      return;
    }
    this.inputEnabled = true;
    this.post({ type: 'input', enabled: !this.sideLane });
  }

  private onReleased() {
    this.clearTimers();
    this.settleHistoryBlock();
    if (this.booting) {
      this.noteActiveCommand();
      this.holding = false;
      this.activeId = undefined;
      this.postClear();
      this.sendBootNext();
      return;
    }
    const failed = this.noteActiveCommand();
    const side = this.sideLane != null;
    this.holding = false;
    this.finishSide(side);
    this.postClear();
    if (failed) {
      this.restoreContext();
      return;
    }
    this.flushPending();
  }

  private restoreContext() {
    this.booting = true;
    this.recovering = true;
    this.bootQueue = [this.lastContextCommand || contextCommand];
    this.sendBootNext();
  }

  private finishSide(restoreInput: boolean) {
    const lane = this.sideLane;
    if (!lane) return;
    const token = this.sideToken;
    this.sideLane = undefined;
    this.post({ type: 'sideEnd', lane, token });
    if (restoreInput) this.post({ type: 'input', enabled: this.inputEnabled });
  }

  private onFailed() {
    if (this.consumeClose()) return;
    this.clearTimers();
    this.booting = false;
    this.recovering = false;
    this.bootQueue = [];
    this.commandQueue = [];
    this.cancelPendingSide();
    this.finishSide(false);
    if (this.blocks.length === 0) this.notices = [failNotice];
    this.inputEnabled = false;
    this.holding = false;
    this.blockOpen = false;
    this.activeId = undefined;
    this.postState();
  }

  private onEnded(text?: string) {
    if (this.consumeClose()) return;
    if (this.blocks.length > 0 || this.inputEnabled || (this.recovering && this.holding)) {
      this.recoverSession();
      return;
    }
    this.clearTimers();
    this.booting = false;
    this.recovering = false;
    this.bootQueue = [];
    this.finishSide(false);
    this.inputEnabled = false;
    this.holding = false;
    this.blockOpen = false;
    this.activeId = undefined;
    if (text && this.blocks.length === 0) this.notices = [text];
    this.postState();
  }

  private scheduleBootTimeout() {
    this.clearBootTimer();
    this.bootTimer = setTimeout(() => {
      this.bootTimer = undefined;
      if (!this.booting || this.disposed) return;
      if (this.holding) {
        this.inputEnabled = true;
        this.post({ type: 'input', enabled: !this.sideLane });
        this.postClear();
        return;
      }
      this.finishBoot();
    }, bootTimeoutMs);
  }

  private clearBootTimer() {
    if (!this.bootTimer) return;
    clearTimeout(this.bootTimer);
    this.bootTimer = undefined;
  }

  private clearTimers() {
    this.clearBootTimer();
  }

  private recoverSession() {
    if (this.disposed || this.closeAfterEnd) return;
    this.clearTimers();
    const side = this.sideLane != null;
    this.settleHistoryBlock();
    this.markReset();
    this.activeId = undefined;
    this.holding = false;
    this.finishSide(side);
    this.booting = true;
    this.recovering = true;
    this.bootQueue = [];
    this.txActive = false;
    this.inputEnabled = false;
    this.post({ type: 'input', enabled: false });
    this.postClear();
    this.session.stop();
    this.session.start();
  }

  private markReset() {
    const last = this.blocks[this.blocks.length - 1];
    if (!last || last.reset) return;
    last.reset = true;
    this.post({ type: 'reset', id: last.id });
  }

  private sendBootNext() {
    const next = this.bootQueue.shift();
    if (!next) {
      this.finishBoot();
      return;
    }
    if (this.recovering) {
      this.sendSilent(next);
      return;
    }
    this.sendCommand(next);
  }

  private sendSilent(text: string) {
    const command = withSemicolon(text);
    if (!command || !this.session.canSend() || !this.session.arm()) {
      if (this.recovering) this.finishBoot();
      else this.recoverSession();
      return;
    }
    this.activeId = undefined;
    this.holding = true;
    this.postClear();
    if (!this.session.send(command)) {
      this.holding = false;
      if (this.recovering) this.finishBoot();
      else this.recoverSession();
      return;
    }
    if (this.booting) this.scheduleBootTimeout();
  }

  private finishBoot() {
    if (this.disposed) return;
    this.clearTimers();
    this.booting = false;
    this.recovering = false;
    this.bootQueue = [];
    this.inputEnabled = true;
    this.post({ type: 'input', enabled: !this.sideLane });
    this.postClear();
    if (!this.holding) this.flushPending();
  }

  private noteActiveCommand() {
    if (this.activeId == null) return false;
    const block = this.blocks.find((item) => item.id === this.activeId);
    if (!block) return false;
    if (hasMqlError(block.result)) return true;
    this.trackSessionSetting(block.command);
    return false;
  }

  private flushPending() {
    if (this.holding || this.booting || this.recovering || this.sideLane || !this.inputEnabled) return;
    const cmd = this.commandQueue.shift();
    if (cmd) {
      this.sendCommand(cmd);
      return;
    }
    const side = this.pendingSide;
    this.pendingSide = undefined;
    if (side) this.onSide(side.lane, side.text, side.token);
  }

  private trackSessionSetting(command: string) {
    const norm = command.trim().replace(/\s+/g, ' ');
    if (/^set context\b/i.test(norm)) {
      this.lastContextCommand = norm;
      return;
    }
    if (/^verb(?:ose)? on\s*;$/i.test(norm)) {
      this.verbOn = true;
      return;
    }
    if (/^verb(?:ose)? off\s*;$/i.test(norm)) {
      this.verbOn = false;
      return;
    }
    if (/^start transaction(?: (?:read|write))?\s*;$/i.test(norm)) {
      this.txActive = true;
      return;
    }
    if (/^(?:commit|abort) transaction\s*;$/i.test(norm)) this.txActive = false;
  }

  private consumeClose() {
    if (!this.closeAfterEnd) return false;
    this.closeAfterEnd = false;
    this.panel?.dispose();
    return true;
  }

  private onBatch() {
    if (this.notices.includes(batchNotice)) return;
    this.notices.push(batchNotice);
    this.postState();
  }

  private onPrompted() {
    const next = this.notices.filter((notice) => notice !== batchNotice);
    if (next.length !== this.notices.length) {
      this.notices = next;
      this.postState();
    }
    if (!this.booting) return;
    this.bootQueue = [];
    const ctx = this.recovering ? this.lastContextCommand : contextCommand;
    if (ctx) this.bootQueue.push(ctx);
    if (this.verbOn) this.bootQueue.push('verb on;');
    this.sendBootNext();
  }

  private settleHistoryBlock() {
    if (!this.blockOpen || this.sideLane || this.activeId == null) return;
    const id = this.activeId;
    this.blockOpen = false;
    this.post({ type: 'blockDone', id });
  }

  private clearEnabled() {
    return this.blocks.length > 0;
  }

  private postClear() {
    this.post({ type: 'clearEnabled', enabled: this.clearEnabled() });
  }

  private postState() {
    this.post({
      type: 'state',
      inputEnabled: this.inputEnabled && !this.sideLane,
      clearEnabled: this.clearEnabled(),
      blocks: this.blocks.map((block) => ({ ...block })),
      notices: [...this.notices],
      prefs: this.getPrefs(),
      runningId: this.blockOpen && !this.sideLane ? this.activeId : undefined,
    });
  }

  private post(message: Outbound) {
    if (!this.domReady || !this.panel) return;
    void this.panel.webview.postMessage(message);
  }
}

function defaultPrefs(): SavedPrefs {
  return {
    recalls: [],
    jpoOpen: false,
    jpoPath: '',
    commandText: '',
    splitRatio: 0.6,
    recallWidth: 200,
    drawerWidth: 300,
    composerHidden: false,
    historyHidden: false,
    drawerLane: '',
    helpTopic: '',
    listKind: 'type',
  };
}

function parseRecalls(value: unknown, fallback: RecallItem[]): RecallItem[] {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const pinned: RecallItem[] = [];
  const normal: RecallItem[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.text !== 'string') continue;
    const text = item.text.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    if (item.pinned === true) pinned.push({ text, pinned: true });
    else normal.push({ text });
  }
  return [...pinned, ...normal].slice(0, maxRecalls);
}

function parsePrefs(value: unknown, base = defaultPrefs()): SavedPrefs {
  if (!isRecord(value)) return base;
  const splitRatio = typeof value.splitRatio === 'number' && Number.isFinite(value.splitRatio)
    ? Math.min(0.85, Math.max(0.15, value.splitRatio))
    : base.splitRatio;
  const recallWidth = typeof value.recallWidth === 'number' && Number.isFinite(value.recallWidth)
    ? Math.max(112, Math.round(value.recallWidth))
    : base.recallWidth;
  const drawerWidth = typeof value.drawerWidth === 'number' && Number.isFinite(value.drawerWidth)
    ? Math.max(180, Math.round(value.drawerWidth))
    : base.drawerWidth;
  const drawerLane = value.drawerLane === 'help' || value.drawerLane === 'list' || value.drawerLane === 'create' || value.drawerLane === 'edit' || value.drawerLane === ''
    ? value.drawerLane
    : base.drawerLane;
  const helpTopic = typeof value.helpTopic === 'string' && /^[a-z]*$/.test(value.helpTopic)
    ? value.helpTopic
    : base.helpTopic;
  const listKind = typeof value.listKind === 'string' && /^[a-z]+$/.test(value.listKind)
    ? value.listKind
    : base.listKind;
  return {
    recalls: parseRecalls(value.recalls, base.recalls),
    jpoOpen: typeof value.jpoOpen === 'boolean' ? value.jpoOpen : base.jpoOpen,
    jpoPath: typeof value.jpoPath === 'string' ? value.jpoPath : base.jpoPath,
    commandText: typeof value.commandText === 'string' ? value.commandText : base.commandText,
    splitRatio,
    recallWidth,
    drawerWidth,
    composerHidden: typeof value.composerHidden === 'boolean' ? value.composerHidden : base.composerHidden,
    historyHidden: typeof value.historyHidden === 'boolean' ? value.historyHidden : base.historyHidden,
    drawerLane,
    helpTopic,
    listKind,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function withSemicolon(text: string) {
  const command = text.trim();
  if (!command) return '';
  if (command.endsWith(';')) return command;
  return `${command};`;
}

function isSessionEnd(command: string) {
  return /^(quit|exit)\s*;$/i.test(command);
}

function isDelete(text: string) {
  return /^\s*del(?:ete)?\s/i.test(text);
}

function isDestructive(text: string) {
  const bare = text.replace(/'[^']*'|"[^"]*"/g, "''");
  return isDelete(bare) || /^\s*(?:disconnect|demote)\s/i.test(bare) || /^\s*mod(?:ify)?\s[\s\S]*\bremove\b/i.test(bare);
}

function sideCommand(lane: SideLane, text: string) {
  const command = withSemicolon(text);
  if (lane === 'help' && /^help(?: [a-z]+)?;$/.test(command)) return command;
  if (lane === 'list' && /^list [a-z]+;$/.test(command)) return command;
  if (lane === 'meta' && /^(?:list (?:type|vault)|print (?:type|policy|attribute) '[^';]*' select [a-z ]+|print bus \d+(?:\.\d+){3} select [a-z. ]+);$/.test(command)) return command;
  return '';
}

function hasMqlError(text: string) {
  return /(?:^|\r|\n)\s*(?:(?:System\s+|MQL\s+|Connect\s+|Syntax\s+|Parse\s+|Database\s+|Severe\s+|Fatal\s+)?Error(?:\s*:|\s+#\d+)|#\d{4,}\s*:|(?:Enter\s+)?Password\s*:\s*$)/i.test(text);
}
