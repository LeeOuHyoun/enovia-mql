import { execFile, execFileSync, spawn, type ChildProcess } from 'node:child_process';

const promptPattern = /^MQL<\d+>$/;
const openDelayMs = 200;
const promptDelayMs = 80;
const immediateExitMs = 2000;
const batchWaitMs = 20000;

export type MqlSessionEvents = {
  output: (text: string) => void;
  ready: () => void;
  released: () => void;
  failed: () => void;
  ended: (text?: string) => void;
  batch: () => void;
  prompted: () => void;
};

type Pipe = 'out' | 'err';

export class MqlSession {
  private generation = 0;
  private proc: ChildProcess | undefined;
  private active = false;
  private opened = false;
  private failed = false;
  private promptSeen = false;
  private prompt: string | undefined;
  private hold = false;
  private lines: Record<Pipe, string> = { out: '', err: '' };
  private startup = '';
  private startedAt = 0;
  private openTimer: ReturnType<typeof setTimeout> | undefined;
  private trailTimer: ReturnType<typeof setTimeout> | undefined;
  private trailPipe: Pipe | undefined;
  private batchTimer: ReturnType<typeof setTimeout> | undefined;
  private decoders: Record<Pipe, TextDecoder> = { out: new TextDecoder(), err: new TextDecoder() };

  constructor(private readonly events: MqlSessionEvents) {}

  get running(): boolean {
    return this.active;
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.generation += 1;
    const generation = this.generation;
    this.opened = false;
    this.failed = false;
    this.promptSeen = false;
    this.prompt = undefined;
    this.hold = false;
    this.lines = { out: '', err: '' };
    this.trailPipe = undefined;
    this.startup = '';
    try {
      const label = consoleEncoding();
      this.decoders = { out: new TextDecoder(label), err: new TextDecoder(label) };
    } catch {
      this.decoders = { out: new TextDecoder(), err: new TextDecoder() };
    }
    void this.launch(generation);
  }

  stop() {
    this.generation += 1;
    this.active = false;
    this.clearTimers();
    const proc = this.proc;
    this.proc = undefined;
    killTree(proc);
  }

  canSend(): boolean {
    const stdin = this.proc?.stdin;
    return !!stdin && stdin.writable && !stdin.destroyed && this.proc?.exitCode == null && !this.failed;
  }

  send(text: string): boolean {
    if (!this.canSend()) return false;
    this.proc?.stdin?.write(`${text}\n`);
    return true;
  }

  arm(): boolean {
    if (!this.prompt) return false;
    this.hold = true;
    return true;
  }

  private async launch(generation: number) {
    const batch = await mqlIsBatch();
    if (generation !== this.generation) return;
    let proc: ChildProcess;
    try {
      proc = spawn('mql', [], {
        shell: true,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      this.fail(generation);
      return;
    }
    if (generation !== this.generation) {
      killTree(proc);
      return;
    }
    this.proc = proc;
    this.startedAt = Date.now();
    proc.on('error', () => this.fail(generation));
    proc.on('exit', () => this.onExit(generation));
    proc.stdout?.on('data', (chunk: Uint8Array) => this.onChunk(generation, chunk, 'out'));
    proc.stderr?.on('data', (chunk: Uint8Array) => this.onChunk(generation, chunk, 'err'));
    proc.stdin?.on('error', () => {});
    if (batch) {
      this.batchTimer = setTimeout(() => {
        if (generation !== this.generation || this.promptSeen) return;
        this.events.batch();
      }, batchWaitMs);
    }
  }

  private onChunk(generation: number, chunk: Uint8Array, pipe: Pipe) {
    if (generation !== this.generation) return;
    const text = this.decoders[pipe].decode(chunk, { stream: true });
    if (text) this.consume(text, pipe);
  }

  private onExit(generation: number) {
    if (generation !== this.generation) return;
    for (const pipe of ['out', 'err'] as const) {
      const rest = this.decoders[pipe].decode();
      if (rest) this.consume(rest, pipe);
    }
    this.active = false;
    this.proc = undefined;
    this.clearTimers();
    if (this.failed) return;
    const immediate = Date.now() - this.startedAt < immediateExitMs;
    if (!this.promptSeen && immediate) {
      this.failed = true;
      this.events.failed();
      return;
    }
    const leftover = this.promptSeen ? undefined : this.startup.trim() || undefined;
    this.events.ended(leftover);
  }

  private fail(generation: number) {
    if (generation !== this.generation || this.failed) return;
    this.failed = true;
    this.active = false;
    this.generation += 1;
    this.clearTimers();
    const proc = this.proc;
    this.proc = undefined;
    killTree(proc);
    this.events.failed();
  }

  private consume(text: string, pipe: Pipe) {
    if (!this.promptSeen) this.startup += text;
    this.events.output(text);
    this.scheduleOpen();
    for (const char of text) {
      if (char === '\n' || char === '\r') {
        const finished = this.lines[pipe];
        this.lines[pipe] = '';
        this.finishLine(finished, pipe);
      } else {
        this.lines[pipe] += char;
        if (this.lines[pipe].length <= 32) this.scheduleTrailing(pipe);
      }
    }
  }

  private scheduleOpen() {
    if (this.opened || this.openTimer) return;
    const generation = this.generation;
    this.openTimer = setTimeout(() => {
      this.openTimer = undefined;
      if (generation !== this.generation) return;
      this.open();
    }, openDelayMs);
  }

  private open() {
    if (this.opened || !this.active) return;
    this.opened = true;
    this.events.ready();
  }

  private scheduleTrailing(pipe: Pipe) {
    const candidate = this.lines[pipe].trim();
    if (!promptPattern.test(candidate)) return;
    if (this.trailTimer) clearTimeout(this.trailTimer);
    this.trailTimer = undefined;
    this.trailPipe = pipe;
    const generation = this.generation;
    this.trailTimer = setTimeout(() => {
      this.trailTimer = undefined;
      this.trailPipe = undefined;
      if (generation !== this.generation) return;
      if (this.lines[pipe].trim() !== candidate) return;
      this.accept(candidate, pipe);
    }, promptDelayMs);
  }

  private finishLine(raw: string, pipe: Pipe) {
    if (this.trailPipe === pipe) {
      if (this.trailTimer) clearTimeout(this.trailTimer);
      this.trailTimer = undefined;
      this.trailPipe = undefined;
    }
    const candidate = raw.trim();
    if (!promptPattern.test(candidate)) return;
    this.accept(candidate, pipe);
  }

  private accept(candidate: string, pipe: Pipe) {
    if (!promptPattern.test(candidate)) return;
    if (this.lines[pipe].trim() === candidate) this.lines[pipe] = '';
    if (!this.promptSeen) {
      this.prompt = candidate;
      this.promptSeen = true;
      if (this.batchTimer) clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
      this.events.prompted();
      this.open();
      return;
    }
    if (!this.hold) {
      this.prompt = candidate;
      return;
    }
    this.prompt = candidate;
    this.hold = false;
    this.events.released();
  }

  private clearTimers() {
    if (this.openTimer) clearTimeout(this.openTimer);
    if (this.trailTimer) clearTimeout(this.trailTimer);
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.openTimer = undefined;
    this.trailTimer = undefined;
    this.trailPipe = undefined;
    this.batchTimer = undefined;
  }
}

function consoleEncoding(): string {
  try {
    const output = execFileSync('cmd.exe', ['/d', '/c', 'chcp'], {
      windowsHide: true,
      encoding: 'utf8',
    });
    const code = output.match(/(\d+)/)?.[1];
    if (code === '949') return 'euc-kr';
  } catch {
    return 'utf-8';
  }
  return 'utf-8';
}

function mqlIsBatch(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('where.exe', ['mql'], { windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }
      const first = String(stdout)
        .split(/\r?\n/)
        .find((item) => item.trim());
      resolve(!!first && /\.(bat|cmd)$/i.test(first.trim()));
    });
  });
}

function killTree(proc: ChildProcess | undefined) {
  if (!proc?.pid) return;
  const killer = spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], {
    windowsHide: true,
    stdio: 'ignore',
  });
  killer.on('error', () => {
    if (!proc.killed) proc.kill();
  });
}
