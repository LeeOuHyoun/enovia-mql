import { execFile, spawn, type ChildProcess } from "node:child_process";

const promptTailPattern = /(MQL<\d*>)\s*$/;
const openDelayMs = 200;
const promptDelayMs = 80;
const immediateExitMs = 2000;
const batchWaitMs = 20000;
// 프롬프트로 응답 끝을 판단할 수 없을 때, 출력이 이 시간 동안 멈추면 응답이 끝난 것으로 본다.
const quietMs = 1500;
const startupLimit = 16384;

export type MqlSessionEvents = {
  output: (text: string) => void;
  ready: () => void;
  released: () => void;
  failed: () => void;
  ended: (text?: string) => void;
  batch: () => void;
  prompted: () => void;
};

type Pipe = "out" | "err";

export class MqlSession {
  private generation = 0;
  private proc: ChildProcess | undefined;
  private active = false;
  private opened = false;
  private failed = false;
  private promptSeen = false;
  private sent = false;
  private prompt: string | undefined;
  private hold = false;
  // 첫 프롬프트를 보기 전에 보낸 명령: 프롬프트만으로 끝을 판단할 수 없어 quiet 타이머로 마무리한다.
  private holdEarly = false;
  private parsing = false;
  private promptWait = false;
  private releaseWait = false;
  private lines: Record<Pipe, string> = { out: "", err: "" };
  private startup = "";
  private startedAt = 0;
  private openTimer: ReturnType<typeof setTimeout> | undefined;
  private trailTimer: ReturnType<typeof setTimeout> | undefined;
  private trailPipe: Pipe | undefined;
  private batchTimer: ReturnType<typeof setTimeout> | undefined;
  private quietTimer: ReturnType<typeof setTimeout> | undefined;
  private decoders: Record<Pipe, TextDecoder> = {
    out: new TextDecoder(),
    err: new TextDecoder(),
  };

  constructor(private readonly events: MqlSessionEvents) {}

  get running(): boolean {
    return this.active;
  }

  get prompted(): boolean {
    return this.promptSeen;
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.generation += 1;
    const generation = this.generation;
    this.opened = false;
    this.failed = false;
    this.promptSeen = false;
    this.sent = false;
    this.prompt = undefined;
    this.hold = false;
    this.holdEarly = false;
    this.parsing = false;
    this.promptWait = false;
    this.releaseWait = false;
    this.lines = { out: "", err: "" };
    this.trailPipe = undefined;
    this.startup = "";
    // chcp 조회를 비동기(최초 1회 실행 후 캐시)로 처리해 확장 호스트가 멈추지 않게 한다.
    void consoleEncoding().then((label) => {
      if (generation !== this.generation) return;
      try {
        this.decoders = {
          out: new TextDecoder(label),
          err: new TextDecoder(label),
        };
      } catch {
        this.decoders = { out: new TextDecoder(), err: new TextDecoder() };
      }
      this.launch(generation);
    });
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
    return (
      !!stdin &&
      stdin.writable &&
      !stdin.destroyed &&
      this.proc?.exitCode == null &&
      !this.failed
    );
  }

  send(text: string): boolean {
    if (!this.canSend()) return false;
    this.sent = true;
    this.proc?.stdin?.write(`${text}\n`);
    this.scheduleQuiet();
    return true;
  }

  arm(): boolean {
    if (!this.canSend()) return false;
    this.hold = true;
    this.holdEarly = !this.promptSeen;
    return true;
  }

  private launch(generation: number) {
    let proc: ChildProcess;
    try {
      proc = spawn("mql", [], {
        shell: true,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
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
    proc.on("error", () => this.fail(generation));
    proc.on("exit", () => this.onExit(generation));
    proc.stdout?.on("data", (chunk: Uint8Array) =>
      this.onChunk(generation, chunk, "out"),
    );
    proc.stderr?.on("data", (chunk: Uint8Array) =>
      this.onChunk(generation, chunk, "err"),
    );
    proc.stdin?.on("error", () => {});
    void mqlIsBatch().then((batch) => {
      if (!batch || generation !== this.generation || this.promptSeen) return;
      this.batchTimer = setTimeout(() => {
        if (generation !== this.generation || this.promptSeen) return;
        this.events.batch();
      }, batchWaitMs);
    });
  }

  private onChunk(generation: number, chunk: Uint8Array, pipe: Pipe) {
    if (generation !== this.generation) return;
    const text = this.decoders[pipe].decode(chunk, { stream: true });
    if (text) this.consume(text, pipe);
  }

  private onExit(generation: number) {
    if (generation !== this.generation) return;
    for (const pipe of ["out", "err"] as const) {
      const rest = this.decoders[pipe].decode();
      if (rest) this.consume(rest, pipe);
    }
    this.active = false;
    this.proc = undefined;
    this.clearTimers();
    if (this.failed) return;
    const immediate = Date.now() - this.startedAt < immediateExitMs;
    if (!this.promptSeen && !this.sent && immediate) {
      this.failed = true;
      this.events.failed();
      return;
    }
    const leftover = this.promptSeen
      ? undefined
      : this.startup.trim() || undefined;
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
    if (!this.promptSeen) {
      // 프롬프트가 없는 환경에서 무한히 쌓이지 않도록 끝부분만 유지한다(종료 안내용).
      this.startup += text;
      if (this.startup.length > startupLimit) this.startup = this.startup.slice(-startupLimit);
    }
    this.events.output(text);
    this.scheduleOpen();
    this.scheduleQuiet();
    const nested = this.parsing;
    const generation = this.generation;
    this.parsing = true;
    for (const char of text) {
      if (char === "\n" || char === "\r") {
        const finished = this.lines[pipe];
        this.lines[pipe] = "";
        if (finished) this.finishLine(finished, pipe);
      } else {
        this.lines[pipe] += char;
      }
    }
    if (this.lines[pipe]) this.scheduleTrailing(pipe);
    this.parsing = nested;
    if (nested || generation !== this.generation) return;
    if (this.promptWait) {
      this.promptWait = false;
      this.events.prompted();
      this.open();
    }
    if (this.releaseWait && generation === this.generation) {
      this.releaseWait = false;
      this.events.released();
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
    const candidate = matchPrompt(this.lines[pipe]);
    if (!candidate) return;
    if (this.trailTimer) clearTimeout(this.trailTimer);
    this.trailTimer = undefined;
    this.trailPipe = pipe;
    const generation = this.generation;
    this.trailTimer = setTimeout(() => {
      this.trailTimer = undefined;
      this.trailPipe = undefined;
      if (generation !== this.generation) return;
      if (matchPrompt(this.lines[pipe]) !== candidate) return;
      this.accept(candidate, pipe);
    }, promptDelayMs);
  }

  private finishLine(raw: string, pipe: Pipe) {
    if (this.trailPipe === pipe) {
      if (this.trailTimer) clearTimeout(this.trailTimer);
      this.trailTimer = undefined;
      this.trailPipe = undefined;
    }
    const candidate = matchPrompt(raw);
    if (!candidate) return;
    this.accept(candidate, pipe);
  }

  private accept(candidate: string, pipe: Pipe) {
    if (matchPrompt(this.lines[pipe]) === candidate) this.lines[pipe] = "";
    if (!this.promptSeen) {
      this.prompt = candidate;
      this.promptSeen = true;
      if (this.batchTimer) clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
      if (this.parsing) this.promptWait = true;
      else {
        this.events.prompted();
        this.open();
      }
      return;
    }
    if (!this.hold) {
      this.prompt = candidate;
      return;
    }
    this.prompt = candidate;
    this.release();
  }

  private release() {
    if (!this.hold) return;
    this.hold = false;
    this.holdEarly = false;
    if (this.quietTimer) clearTimeout(this.quietTimer);
    this.quietTimer = undefined;
    if (this.parsing) this.releaseWait = true;
    else this.events.released();
  }

  private scheduleQuiet() {
    if (this.quietTimer) clearTimeout(this.quietTimer);
    this.quietTimer = undefined;
    // 프롬프트 규칙이 확립된 뒤의 정상 hold는 프롬프트만으로 판단한다.
    if (!this.hold || (this.promptSeen && !this.holdEarly)) return;
    const generation = this.generation;
    this.quietTimer = setTimeout(() => {
      this.quietTimer = undefined;
      if (generation !== this.generation) return;
      this.release();
    }, quietMs);
  }

  private clearTimers() {
    if (this.openTimer) clearTimeout(this.openTimer);
    if (this.trailTimer) clearTimeout(this.trailTimer);
    if (this.batchTimer) clearTimeout(this.batchTimer);
    if (this.quietTimer) clearTimeout(this.quietTimer);
    this.quietTimer = undefined;
    this.openTimer = undefined;
    this.trailTimer = undefined;
    this.trailPipe = undefined;
    this.batchTimer = undefined;
  }
}

function matchPrompt(raw: string): string | undefined {
  const tail = raw.length > 32 ? raw.slice(-32) : raw;
  return promptTailPattern.exec(tail)?.[1];
}

let encodingLookup: Promise<string> | undefined;

function consoleEncoding(): Promise<string> {
  encodingLookup ??= new Promise((resolve) => {
    execFile(
      "cmd.exe",
      ["/d", "/c", "chcp"],
      { windowsHide: true },
      (error, stdout) => {
        if (error) {
          resolve("utf-8");
          return;
        }
        const code = String(stdout).match(/(\d+)/)?.[1];
        resolve(code === "949" ? "euc-kr" : "utf-8");
      },
    );
  });
  return encodingLookup;
}

function mqlIsBatch(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("where.exe", ["mql"], { windowsHide: true }, (error, stdout) => {
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
  const killer = spawn("taskkill", ["/pid", String(proc.pid), "/t", "/f"], {
    windowsHide: true,
    stdio: "ignore",
  });
  killer.on("error", () => {
    if (!proc.killed) proc.kill();
  });
}
