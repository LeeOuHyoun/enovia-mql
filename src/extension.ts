import * as vscode from 'vscode';
import { MqlSession } from './session';

const failNotice = 'mql을 시작하지 못했습니다';
const batchNotice = '배치가 표준 입력을 넘기지 못해 프롬프트가 오지 않았습니다';
const prefsKey = 'enovia-mql.prefs';
const configKey = 'enovia-mql.contextCommand';
const graphExtension = 'local.3d-mql';
const graphCommand = '3d-mql.search';
const maxRecalls = 200;
const bootTimeoutMs = 5000;
const sideTimeoutMs = 60000;
const logLimit = 2000;
const blocksKey = 'enovia-mql.blocks';
const savedBlockLimit = 50;
const savedResultLimit = 100000;
const savedTotalLimit = 2000000;
const trimmedNote = '\n… (저장 용량 때문에 결과 앞부분만 복원했습니다)';
const secretPattern = /'[^']*'|"[^"]*"|(\bpassword\s+)('[^']*'|"[^"]*"|[^\s;'"]+)/gi;
const contextStatementPattern = /(?:^|;)\s*(?:set|push|pop)\s+context\b/i;
const metaPattern = /^(?:list (?:type|vault)|print (?:type|policy|attribute) (?:'[^';]*'|"[^";]*") select [a-z ]+|print bus \d+(?:\.\d+){3} select [a-z. ]+|temp query bus (?:(?:'[^';]*'|"[^";]*") ){3}select id dump '\|~\|'|list property on program eServiceSchemaVariableMapping\.tcl);$/;

type Block = {
  id: number;
  command: string;
  result: string;
  reset?: boolean;
  elapsed?: number;
  secret?: boolean;
  boot?: boolean;
};

type Queued = {
  text: string;
  batch?: number;
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
  drafts: Record<string, string>;
  splitRatio: number;
  splitAuto: boolean;
  recallWidth: number;
  drawerWidth: number;
  composerHidden: boolean;
  historyHidden: boolean;
  lineNumbers: boolean;
  drawerLane: '' | 'help' | 'list' | 'create' | 'edit';
  helpTopic: string;
  listKind: string;
};

type ViewPrefs = Omit<SavedPrefs, 'drafts'> & { commandText: string };

type SavedBlock = Pick<Block, 'command' | 'result' | 'elapsed'>;

type ViewHost = {
  prefs: () => ViewPrefs;
  save: (raw: unknown) => void;
  blocks: () => Block[];
  saveBlocks: (blocks: Block[]) => void;
  hydrate: () => void;
  closed: () => void;
  log: (text: string) => void;
};

type Outbound =
  | {
      type: 'state';
      inputEnabled: boolean;
      clearEnabled: boolean;
      blocks: Block[];
      notices: string[];
      prefs: ViewPrefs;
      runningId?: number;
      context: string;
      graph: boolean;
      contextCommand: string;
    }
  | { type: 'block'; id: number; command: string; secret?: boolean; batch?: number; folded?: boolean }
  | { type: 'blockDone'; id: number; elapsed: number }
  | { type: 'batchEnd'; batch: number }
  | { type: 'reset'; id: number; interrupted: boolean }
  | { type: 'chunk'; id: number; text: string }
  | { type: 'cleared' }
  | { type: 'resetView' }
  | { type: 'input'; enabled: boolean }
  | { type: 'clearEnabled'; enabled: boolean }
  | { type: 'context'; text: string }
  | { type: 'graph'; available: boolean }
  | { type: 'config'; contextCommand: string }
  | { type: 'suggest' }
  | { type: 'format' }
  | { type: 'joinLines' }
  | { type: 'sideStart'; lane: SideLane; token: number }
  | { type: 'sideChunk'; lane: SideLane; token: number; text: string }
  | { type: 'sideEnd'; lane: SideLane; token: number; failed?: boolean }
  | { type: 'jpoPicked'; path: string };

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('ENOVIA MQL');
  const host = new MqlHost(context.extensionUri, context.globalState, output);
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
    output,
    host,
  );
}

export function deactivate() {}

class MqlHost implements vscode.Disposable {
  private readonly views: MqlView[] = [];
  private readonly slots = new Set<number>();
  private readonly known = new Map<number, Set<string>>();
  private readonly listeners: vscode.Disposable;
  private prefs: SavedPrefs;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly state: vscode.Memento,
    private readonly output: vscode.OutputChannel,
  ) {
    const raw = this.state.get(prefsKey);
    this.prefs = loadPrefs(raw);
    if (raw !== undefined) void this.state.update(prefsKey, this.prefs);
    this.listeners = vscode.Disposable.from(
      vscode.extensions.onDidChange(() => {
        for (const view of this.views) view.postGraph();
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration(configKey)) return;
        for (const view of this.views) view.postConfig();
      }),
    );
  }

  dispose() {
    this.listeners.dispose();
    for (const view of [...this.views]) view.dispose();
  }

  show() {
    let slot = 1;
    while (this.slots.has(slot)) slot += 1;
    this.slots.add(slot);
    const view = new MqlView(this.extensionUri, slot, {
      prefs: () => this.viewPrefs(slot),
      save: (raw) => this.savePrefs(slot, raw),
      blocks: () => loadBlocks(this.state.get(blocksKey)),
      saveBlocks: (blocks) => void this.state.update(blocksKey, trimBlocks(blocks)),
      hydrate: () => {
        this.known.set(slot, new Set(this.prefs.recalls.map((item) => item.text)));
      },
      closed: () => {
        this.slots.delete(slot);
        this.known.delete(slot);
        const index = this.views.indexOf(view);
        if (index >= 0) this.views.splice(index, 1);
      },
      log: (text) => {
        this.output.appendLine(`[${new Date().toISOString()}] [${slot}] ${text}`);
      },
    });
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

  private viewPrefs(slot: number): ViewPrefs {
    const { drafts, ...rest } = this.prefs;
    return { ...rest, commandText: drafts[slot] ?? '' };
  }

  private savePrefs(slot: number, raw: unknown) {
    if (!isRecord(raw)) return;
    const next = parsePrefs(raw, this.prefs);
    const sent = new Set(next.recalls.map((item) => item.text));
    const known = this.known.get(slot) ?? new Set<string>();
    const kept = this.prefs.recalls.filter((item) => !sent.has(item.text) && !known.has(item.text));
    const draft = typeof raw.commandText === 'string' && !hasSecret(raw.commandText) ? raw.commandText : '';
    this.known.set(slot, sent);
    this.prefs = {
      ...next,
      recalls: parseRecalls([...next.recalls, ...kept], []),
      drafts: { ...this.prefs.drafts, [slot]: draft },
    };
    void this.state.update(prefsKey, this.prefs);
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
  private bootStarted = false;
  private recovering = false;
  private lastContextCommand = '';
  private verbOn = false;
  private txActive = false;
  private bootQueue: string[] = [];
  private commandQueue: Queued[] = [];
  private readonly confirming = new Set<string>();
  private pendingSide: { lane: SideLane; text: string; token: number } | undefined;
  private bootTimer: ReturnType<typeof setTimeout> | undefined;
  private sideTimer: ReturnType<typeof setTimeout> | undefined;
  private activeId: number | undefined;
  private activeText = '';
  private activeBatch: number | undefined;
  private activeStart = 0;
  private blockOpen = false;
  private sideLane: SideLane | undefined;
  private sideToken = 0;
  private sideText = '';
  private sideOutput = '';
  private sideStart = 0;
  private contextText = '';
  private nextId = 0;
  private blocks: Block[] = [];
  private notices: string[] = [];
  private readonly session: MqlSession;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly slot: number,
    private readonly host: ViewHost,
  ) {
    this.blocks = host.blocks();
    this.nextId = this.blocks.length;
    this.session = new MqlSession({
      output: (text) => this.onOutput(text),
      ready: () => this.onReadySession(),
      released: () => this.onReleased(),
      failed: () => this.onFailed(),
      ended: (text) => this.onEnded(text),
      batch: () => this.onBatch(),
      prompted: () => this.onPrompted(),
      context: (lines) => this.onContext(lines),
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
    this.host.closed();
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

  postGraph() {
    this.post({ type: 'graph', available: graphAvailable() });
  }

  postConfig() {
    this.post({ type: 'config', contextCommand: configuredContext() });
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
    this.bootStarted = false;
    this.recovering = false;
    this.bootQueue = [];
    this.clearQueue();
    this.cancelPendingSide();
    this.lastContextCommand = '';
    this.verbOn = false;
    this.txActive = false;
    this.contextText = '';
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
      this.host.hydrate();
      this.postState();
      return;
    }
    if (message.type === 'send' && typeof message.text === 'string') {
      void this.confirmSend(message.text, message.confirm === true);
      return;
    }
    if (message.type === 'batch' && Array.isArray(message.texts) && typeof message.batch === 'number') {
      this.onBatchSend(message.texts, message.batch);
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
    if (message.type === 'notify' && typeof message.text === 'string') {
      vscode.window.setStatusBarMessage(`$(warning) ${message.text}`, 3000);
      return;
    }
    if (message.type === 'openDocument' && typeof message.content === 'string') {
      void this.openDocument(message.content);
      return;
    }
    if (message.type === 'searchGraph' && isRecord(message.query)) {
      void this.searchGraph(message.query);
      return;
    }
    if (message.type === 'prefs') {
      this.host.save(message.prefs);
      return;
    }
    if (message.type === 'pickJpo') {
      void this.onPickJpo();
      return;
    }
    if (message.type === 'clear') this.onClear();
    if (message.type === 'restart') void this.confirmRestart();
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

  private async openDocument(content: string) {
    const document = await vscode.workspace.openTextDocument({ content });
    await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preview: false });
  }

  private async searchGraph(query: Record<string, unknown>) {
    try {
      await vscode.commands.executeCommand(graphCommand, query);
    } catch (error) {
      void vscode.window.showErrorMessage(`3D MQL 그래프에서 검색하지 못했습니다. ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async confirmSend(text: string, force = false) {
    const destructive = isDestructive(text);
    if (!destructive && !force) {
      this.onSend(text);
      return;
    }
    const key = withSemicolon(text);
    if (this.confirming.has(key) || this.isDuplicate(text)) return;
    this.confirming.add(key);
    const run = '실행';
    const withTx = '트랜잭션 시작 후 실행';
    const advice = isDelete(text) ? ' 운영 환경에서는 del 대신 mod 사용을 권장합니다.' : '';
    try {
      const picked = await vscode.window.showWarningMessage(
        `${destructive ? '되돌리기 어려운' : '데이터베이스를 변경하는'} 명령을 실행할까요?\n\n${key}`,
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
    } finally {
      this.confirming.delete(key);
    }
  }

  private isDuplicate(text: string) {
    const command = withSemicolon(text);
    if (this.blockOpen && !this.sideLane && this.activeBatch == null && this.activeText === command) return true;
    return this.commandQueue.some((item) => item.batch == null && withSemicolon(item.text) === command);
  }

  private async confirmRestart() {
    if (this.txActive) {
      const reset = '초기화';
      const picked = await vscode.window.showWarningMessage(
        '세션을 초기화할까요?',
        { modal: true, detail: '세션을 다시 시작하므로 진행 중인 트랜잭션은 롤백됩니다.' },
        reset,
      );
      if (picked !== reset || this.disposed) return;
    }
    this.post({ type: 'resetView' });
    this.onRestart();
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
    this.clearQueue();
    this.cancelPendingSide();
    this.recoverSession();
  }

  private onSend(text: string) {
    if (this.sideLane || this.isDuplicate(text)) return;
    if (this.holding || this.booting || this.recovering || !this.inputEnabled) {
      if (this.holding || this.booting || this.recovering) this.commandQueue.push({ text });
      return;
    }
    this.sendCommand(text);
  }

  private onBatchSend(texts: unknown[], batch: number) {
    const items = texts
      .filter((text): text is string => typeof text === 'string' && text.trim() !== '')
      .map((text) => ({ text, batch }));
    const waiting = this.holding || this.booting || this.recovering;
    if (this.sideLane || items.length === 0 || (!waiting && !this.inputEnabled)) {
      this.post({ type: 'batchEnd', batch });
      return;
    }
    this.commandQueue.push(...items);
    this.flushPending();
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
    this.sideText = command;
    this.sideOutput = '';
    this.sideStart = Date.now();
    this.holding = true;
    this.post({ type: 'sideStart', lane, token });
    this.post({ type: 'input', enabled: false });
    this.postClear();
    if (!this.session.send(command)) {
      this.pendingSide = { lane, text: raw, token };
      this.recoverSession();
      return;
    }
    this.scheduleSideTimeout();
  }

  private scheduleSideTimeout() {
    clearTimeout(this.sideTimer);
    this.sideTimer = setTimeout(() => void this.onSideTimeout(), sideTimeoutMs);
  }

  private async onSideTimeout() {
    this.sideTimer = undefined;
    const token = this.sideToken;
    this.host.log(`응답 없음 [${this.sideLane}] > ${this.sideText.slice(0, logLimit)}`);
    if (this.txActive) {
      const reconnect = '다시 연결';
      const picked = await vscode.window.showWarningMessage(
        '조회가 60초 동안 응답하지 않습니다. 세션을 다시 연결할까요?',
        { modal: true, detail: '세션을 다시 연결하므로 진행 중인 트랜잭션은 롤백됩니다.' },
        reconnect,
      );
      if (this.disposed || !this.sideLane || this.sideToken !== token) return;
      if (picked !== reconnect) {
        this.scheduleSideTimeout();
        return;
      }
    }
    this.recoverSession();
  }

  private cancelPendingSide() {
    const side = this.pendingSide;
    this.pendingSide = undefined;
    if (!side || this.sideLane) return;
    this.post({ type: 'sideEnd', lane: side.lane, token: side.token });
  }

  private sendCommand(text: string, batch?: number) {
    const command = withSemicolon(text);
    if (!command) return;
    if (this.holding) {
      this.commandQueue.unshift({ text, batch });
      return;
    }
    if (!this.session.canSend() || !this.session.arm()) {
      if (!this.booting) this.commandQueue.unshift({ text, batch });
      this.recoverSession();
      return;
    }
    this.closeAfterEnd = isSessionEnd(command);
    const shown = maskSecret(command);
    const block: Block = {
      id: ++this.nextId,
      command: shown,
      result: '',
      ...(shown !== command && { secret: true }),
      ...(this.booting && { boot: true }),
    };
    this.blocks.push(block);
    this.activeId = block.id;
    this.activeText = command;
    this.activeBatch = batch;
    this.activeStart = Date.now();
    this.blockOpen = true;
    this.holding = true;
    this.post({ type: 'block', id: block.id, command: block.command, secret: block.secret, batch, ...(this.booting && { folded: true }) });
    this.postClear();
    if (!this.session.send(command)) {
      this.settleHistoryBlock();
      this.holding = false;
      this.activeId = undefined;
      this.activeBatch = undefined;
      if (!this.booting) this.commandQueue.unshift({ text, batch });
      this.recoverSession();
      return;
    }
    if (this.booting) this.scheduleBootTimeout();
  }

  private onRestart() {
    this.clearTimers();
    this.closeAfterEnd = false;
    this.recovering = false;
    this.clearQueue();
    this.cancelPendingSide();
    this.finishSide(false);
    this.holding = false;
    this.blocks = [];
    this.nextId = 0;
    this.activeId = undefined;
    this.host.saveBlocks(this.blocks);
    const prefs = this.host.prefs();
    this.host.save({
      ...prefs,
      recalls: prefs.recalls.filter((item) => item.pinned),
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
    this.host.saveBlocks(this.blocks);
    this.post({ type: 'cleared' });
  }

  private onOutput(text: string) {
    if (this.booting) this.scheduleBootTimeout();
    if (this.sideLane) {
      if (this.sideTimer) this.scheduleSideTimeout();
      if (this.sideOutput.length < logLimit) this.sideOutput += text;
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
      this.startBootCommands();
      return;
    }
    this.inputEnabled = true;
    this.post({ type: 'input', enabled: !this.sideLane });
  }

  private onReleased() {
    this.clearTimers();
    this.closeAfterEnd = false;
    this.settleHistoryBlock();
    if (this.booting) {
      this.noteActiveCommand();
      this.holding = false;
      this.activeId = undefined;
      this.activeBatch = undefined;
      this.postClear();
      this.sendBootNext();
      return;
    }
    const failed = this.noteActiveCommand();
    const batch = this.activeBatch;
    const side = this.sideLane != null;
    this.holding = false;
    this.activeBatch = undefined;
    this.finishSide(side, true);
    this.postClear();
    if (batch != null && (failed || !this.commandQueue.some((item) => item.batch === batch))) this.dropBatch(batch);
    if (failed && contextStatementPattern.test(this.activeText)) {
      this.restoreContext();
      return;
    }
    this.flushPending();
  }

  private restoreContext() {
    if (!this.lastContextCommand) {
      this.flushPending();
      return;
    }
    this.booting = true;
    this.recovering = true;
    this.bootQueue = [this.lastContextCommand];
    this.sendBootNext();
  }

  private finishSide(restoreInput: boolean, completed = false) {
    const lane = this.sideLane;
    if (!lane) return;
    const token = this.sideToken;
    this.sideLane = undefined;
    this.host.log(`${Date.now() - this.sideStart}ms [${lane}] > ${this.sideText.slice(0, logLimit)}\n${this.sideOutput.slice(0, logLimit)}`);
    this.sideOutput = '';
    this.post({ type: 'sideEnd', lane, token, failed: !completed });
    if (restoreInput) this.post({ type: 'input', enabled: this.inputEnabled });
  }

  private onFailed() {
    if (this.consumeClose()) return;
    this.host.log(failNotice);
    this.clearTimers();
    this.booting = false;
    this.recovering = false;
    this.bootQueue = [];
    this.clearQueue();
    this.cancelPendingSide();
    this.finishSide(false);
    this.notices = [failNotice];
    this.inputEnabled = false;
    this.holding = false;
    this.blockOpen = false;
    this.activeId = undefined;
    this.postState();
  }

  private onEnded(text?: string) {
    this.host.log(text ? `세션이 끝났습니다: ${text}` : '세션이 끝났습니다');
    if (this.consumeClose()) return;
    const firstBoot = this.booting && !this.recovering;
    if (!firstBoot && (this.blocks.length > 0 || this.inputEnabled || (this.recovering && this.holding))) {
      this.recoverSession();
      return;
    }
    this.clearTimers();
    this.booting = false;
    this.recovering = false;
    this.bootQueue = [];
    this.clearQueue();
    this.cancelPendingSide();
    this.finishSide(false);
    this.inputEnabled = false;
    this.holding = false;
    this.blockOpen = false;
    this.activeId = undefined;
    if (text && (firstBoot || this.blocks.length === 0)) this.notices = [text];
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
      if (!this.bootStarted) {
        this.startBootCommands();
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
    clearTimeout(this.sideTimer);
    this.sideTimer = undefined;
  }

  private recoverSession() {
    if (this.disposed || this.closeAfterEnd) return;
    this.host.log('세션을 다시 연결합니다');
    this.clearTimers();
    const side = this.sideLane != null;
    const batch = this.activeBatch;
    const interrupted = this.blockOpen;
    this.settleHistoryBlock();
    this.markReset(interrupted);
    this.activeId = undefined;
    this.activeBatch = undefined;
    if (batch != null) this.dropBatch(batch);
    this.holding = false;
    this.finishSide(side);
    this.booting = true;
    this.bootStarted = false;
    this.recovering = true;
    this.bootQueue = [];
    this.txActive = false;
    this.inputEnabled = false;
    this.post({ type: 'input', enabled: false });
    this.postClear();
    this.session.stop();
    this.session.start();
  }

  private markReset(interrupted: boolean) {
    const last = this.blocks[this.blocks.length - 1];
    if (!last || last.reset) return;
    last.reset = true;
    this.post({ type: 'reset', id: last.id, interrupted });
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
    this.host.log(`> ${maskSecret(command)} (복구)`);
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
    this.trackSessionSetting(this.activeText);
    return false;
  }

  private flushPending() {
    if (this.holding || this.booting || this.recovering || this.sideLane || !this.inputEnabled) return;
    const next = this.commandQueue.shift();
    if (next) {
      this.sendCommand(next.text, next.batch);
      return;
    }
    const side = this.pendingSide;
    this.pendingSide = undefined;
    if (side) this.onSide(side.lane, side.text, side.token);
  }

  private dropBatch(batch: number) {
    this.commandQueue = this.commandQueue.filter((item) => item.batch !== batch);
    this.post({ type: 'batchEnd', batch });
  }

  private clearQueue() {
    const batches = new Set([...this.commandQueue.map((item) => item.batch), this.activeBatch]);
    this.commandQueue = [];
    this.activeBatch = undefined;
    for (const batch of batches) {
      if (batch != null) this.post({ type: 'batchEnd', batch });
    }
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
    this.host.log(batchNotice);
    this.notices.push(batchNotice);
    this.postState();
  }

  private onPrompted() {
    const next = this.notices.filter((notice) => notice !== batchNotice);
    if (next.length !== this.notices.length) {
      this.notices = next;
      this.postState();
    }
    if (this.booting) this.startBootCommands();
  }

  private onContext(lines: string[]) {
    this.contextText = lines.join(' ');
    this.host.log(`context: ${this.contextText}`);
    this.post({ type: 'context', text: this.contextText });
  }

  private startBootCommands() {
    if (this.bootStarted) return;
    this.bootStarted = true;
    this.bootQueue = [];
    const ctx = this.recovering ? this.lastContextCommand : configuredContext();
    if (ctx) this.bootQueue.push(ctx);
    if (this.verbOn) this.bootQueue.push('verb on;');
    this.sendBootNext();
  }

  private settleHistoryBlock() {
    if (!this.blockOpen || this.sideLane || this.activeId == null) return;
    const id = this.activeId;
    const block = this.blocks.find((item) => item.id === id);
    const elapsed = Date.now() - this.activeStart;
    if (block) block.elapsed = elapsed;
    this.blockOpen = false;
    this.post({ type: 'blockDone', id, elapsed });
    this.host.saveBlocks(this.blocks);
    if (block) this.host.log(`${elapsed}ms > ${block.command}\n${block.result.slice(0, logLimit)}`);
  }

  private clearEnabled() {
    return this.blocks.length > 0 && !this.blockOpen;
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
      prefs: this.host.prefs(),
      runningId: this.blockOpen && !this.sideLane ? this.activeId : undefined,
      context: this.contextText,
      graph: graphAvailable(),
      contextCommand: configuredContext(),
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
    drafts: {},
    splitRatio: 0.6,
    splitAuto: true,
    recallWidth: 200,
    drawerWidth: 300,
    composerHidden: false,
    historyHidden: false,
    lineNumbers: false,
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
    if (!text || seen.has(text) || hasSecret(text)) continue;
    seen.add(text);
    if (item.pinned === true) pinned.push({ text, pinned: true });
    else normal.push({ text });
  }
  return [...pinned, ...normal].slice(0, maxRecalls);
}

function parseDrafts(value: unknown, fallback: Record<string, string>) {
  if (!isRecord(value)) return fallback;
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && !hasSecret(entry[1])),
  );
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
    drafts: parseDrafts(value.drafts, base.drafts),
    splitRatio,
    splitAuto: typeof value.splitAuto === 'boolean' ? value.splitAuto : base.splitAuto,
    recallWidth,
    drawerWidth,
    composerHidden: typeof value.composerHidden === 'boolean' ? value.composerHidden : base.composerHidden,
    historyHidden: typeof value.historyHidden === 'boolean' ? value.historyHidden : base.historyHidden,
    lineNumbers: typeof value.lineNumbers === 'boolean' ? value.lineNumbers : base.lineNumbers,
    drawerLane,
    helpTopic,
    listKind,
  };
}

function loadPrefs(value: unknown): SavedPrefs {
  const prefs = parsePrefs(value);
  if (!isRecord(value) || isRecord(value.drafts) || typeof value.commandText !== 'string' || hasSecret(value.commandText)) return prefs;
  return { ...prefs, drafts: { 1: value.commandText } };
}

function trimResult(result: string) {
  if (result.length <= savedResultLimit) return result;
  const cut = result.lastIndexOf('\n', savedResultLimit);
  return `${result.slice(0, cut > 0 ? cut : savedResultLimit)}${trimmedNote}`;
}

function trimBlocks(blocks: Block[]): SavedBlock[] {
  const kept: SavedBlock[] = [];
  let total = 0;
  for (const block of [...blocks].reverse()) {
    if (block.secret || block.boot) continue;
    const result = trimResult(block.result);
    total += result.length + block.command.length;
    if (kept.length >= savedBlockLimit || total > savedTotalLimit) break;
    kept.unshift({ command: block.command, result, elapsed: block.elapsed });
  }
  return kept;
}

function loadBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  const blocks: Block[] = raw
    .filter(isRecord)
    .filter((item) => typeof item.command === 'string' && typeof item.result === 'string' && !hasSecret(item.command))
    .map((item, index) => ({
      id: index + 1,
      command: String(item.command),
      result: String(item.result),
      ...(typeof item.elapsed === 'number' && { elapsed: item.elapsed }),
    }));
  if (blocks.length) blocks[blocks.length - 1].reset = true;
  return blocks;
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
  return isDelete(bare) || /^\s*(?:disconnect|demote)\s/i.test(bare) || /^\s*clear\s+(?:vault|all)\b/i.test(bare) || /^\s*mod(?:ify)?\s[\s\S]*\bremove\b/i.test(bare);
}

function sideCommand(lane: SideLane, text: string) {
  if (lane === 'meta') {
    const commands = text.split('\n').map(withSemicolon).filter(Boolean);
    return commands.length > 0 && commands.every((command) => metaPattern.test(command)) ? commands.join('\n') : '';
  }
  const command = withSemicolon(text);
  if (lane === 'help' && /^help(?: [a-z]+)?;$/.test(command)) return command;
  if (lane === 'list' && /^list [a-z]+;$/.test(command)) return command;
  return '';
}

function hasMqlError(text: string) {
  return /(?:^|\r|\n)\s*(?:(?:System\s+|MQL\s+|Connect\s+|Syntax\s+|Parse\s+|Database\s+|Severe\s+|Fatal\s+)?Error(?:\s*:|\s+#\d+)|#\d{4,}\s*:|(?:Enter\s+)?Password\s*:\s*$)/i.test(text);
}

function maskSecret(text: string) {
  return text.replace(secretPattern, (match: string, head?: string) => (head ? `${head}****` : match));
}

function hasSecret(text: string) {
  return maskSecret(text) !== text;
}

function configuredContext() {
  return vscode.workspace.getConfiguration('enovia-mql').get<string>('contextCommand', '').trim();
}

function graphAvailable() {
  return vscode.extensions.getExtension(graphExtension) !== undefined;
}
