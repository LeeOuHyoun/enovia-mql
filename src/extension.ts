import * as vscode from 'vscode';
import { MqlSession } from './session';

const failNotice = 'mql을 시작하지 못했습니다';
const batchNotice = '배치가 표준 입력을 넘기지 못해 프롬프트가 오지 않았습니다';
const contextCommand = 'set context user creator;';

type Block = {
  id: number;
  command: string;
  result: string;
};

type SideLane = 'help' | 'list';

type Outbound =
  | {
      type: 'state';
      inputEnabled: boolean;
      clearEnabled: boolean;
      blocks: Block[];
      notices: string[];
    }
  | { type: 'block'; id: number; command: string }
  | { type: 'chunk'; id: number; text: string }
  | { type: 'cleared' }
  | { type: 'input'; enabled: boolean }
  | { type: 'clearEnabled'; enabled: boolean }
  | { type: 'suggest' }
  | { type: 'sideStart'; lane: SideLane; token: number }
  | { type: 'sideChunk'; lane: SideLane; token: number; text: string }
  | { type: 'sideEnd'; lane: SideLane; token: number };

export function activate(context: vscode.ExtensionContext) {
  const host = new MqlHost(context.extensionUri);
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
    status,
    host,
  );
}

export function deactivate() {}

class MqlHost implements vscode.Disposable {
  private readonly views: MqlView[] = [];
  private readonly slots = new Set<number>();

  constructor(private readonly extensionUri: vscode.Uri) {}

  dispose() {
    for (const view of [...this.views]) view.dispose();
  }

  show() {
    let slot = 1;
    while (this.slots.has(slot)) slot += 1;
    this.slots.add(slot);
    const view = new MqlView(this.extensionUri, slot, () => {
      this.slots.delete(slot);
      const index = this.views.indexOf(view);
      if (index >= 0) this.views.splice(index, 1);
    });
    this.views.push(view);
    view.open();
  }

  suggest() {
    const view = this.views.find((item) => item.focused());
    view?.suggest();
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
  private activeId: number | undefined;
  private sideLane: SideLane | undefined;
  private sideToken = 0;
  private nextId = 0;
  private blocks: Block[] = [];
  private notices: string[] = [];
  private readonly session: MqlSession;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly slot: number,
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
    this.finishSide(false);
    this.inputEnabled = false;
    this.holding = false;
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
      this.onSend(message.text);
      return;
    }
    if (message.type === 'side' && (message.lane === 'help' || message.lane === 'list') && typeof message.text === 'string') {
      const token = typeof message.token === 'number' ? message.token : 0;
      this.onSide(message.lane, message.text, token);
      return;
    }
    if (message.type === 'copy' && typeof message.text === 'string') {
      void vscode.env.clipboard.writeText(message.text);
      return;
    }
    if (message.type === 'clear') this.onClear();
    if (message.type === 'restart') this.onRestart();
  }

  private onSend(text: string) {
    if (!this.inputEnabled || this.sideLane) return;
    this.sendCommand(text);
  }

  private onSide(lane: SideLane, text: string, token: number) {
    const command = sideCommand(lane, text);
    if (!command || !this.inputEnabled || this.holding || this.sideLane || !this.session.canSend() || !this.session.arm()) {
      this.post({ type: 'sideEnd', lane, token });
      return;
    }
    if (!this.session.send(command)) {
      this.post({ type: 'sideEnd', lane, token });
      return;
    }
    this.sideLane = lane;
    this.sideToken = token;
    this.holding = true;
    this.post({ type: 'sideStart', lane, token });
    this.post({ type: 'input', enabled: false });
    this.postClear();
  }

  private sendCommand(text: string) {
    const command = withSemicolon(text);
    if (!command || !this.session.canSend()) return;
    if (!this.session.send(command)) return;
    this.closeAfterEnd = isSessionEnd(command);
    const block: Block = { id: ++this.nextId, command, result: '' };
    this.blocks.push(block);
    this.activeId = block.id;
    this.holding = this.session.arm();
    this.post({ type: 'block', id: block.id, command: block.command });
    this.postClear();
  }

  private onRestart() {
    this.closeAfterEnd = false;
    this.finishSide(false);
    this.holding = false;
    this.session.stop();
    this.begin();
  }

  private onClear() {
    if (!this.clearEnabled()) return;
    this.blocks = [];
    this.activeId = undefined;
    this.post({ type: 'cleared' });
  }

  private onOutput(text: string) {
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
    this.inputEnabled = true;
    this.post({ type: 'input', enabled: true });
  }

  private onReleased() {
    const side = this.sideLane != null;
    this.holding = false;
    this.finishSide(side);
    this.postClear();
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
    this.finishSide(false);
    this.blocks = [];
    this.notices = [failNotice];
    this.inputEnabled = false;
    this.holding = false;
    this.activeId = undefined;
    this.postState();
  }

  private onEnded(text?: string) {
    if (this.consumeClose()) return;
    this.finishSide(false);
    this.inputEnabled = false;
    this.holding = false;
    this.activeId = undefined;
    if (text && this.blocks.length === 0) this.notices = [text];
    this.postState();
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
    this.sendCommand(contextCommand);
  }

  private clearEnabled() {
    return this.blocks.length > 0 && !this.holding;
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
    });
  }

  private post(message: Outbound) {
    if (!this.domReady || !this.panel) return;
    void this.panel.webview.postMessage(message);
  }
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

function sideCommand(lane: SideLane, text: string) {
  const command = withSemicolon(text);
  if (lane === 'help' && command === 'help;') return command;
  if (lane === 'list' && /^list [a-z]+;$/.test(command)) return command;
  return '';
}
