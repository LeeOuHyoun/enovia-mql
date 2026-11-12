import { execFile, spawn, type ChildProcess } from "node:child_process";

const promptTailPattern = /(MQL<\d*>)\s*$/;
const promptsPattern = /MQL<\d*>/g;
const quotedPattern = /"[^"]*"|'[^']*'/g;
const contextPattern = /(^|;)\s*(set|push|pop)\b|\bcont/i;
const markerCommand = "print context;";
const openDelayMs = 200;
const promptDelayMs = 80;
const immediateExitMs = 2000;
const batchWaitMs = 20000;
const quietMs = 5000;
const learnQuietMs = 100;
const settleMs = 30;
const startupLimit = 16384;
const pipes = ["out", "err"] as const;

export type MqlSessionEvents = {
  output: (text: string) => void;
  ready: () => void;
  released: () => void;
  failed: () => void;
  ended: (text?: string) => void;
  batch: () => void;
  prompted: () => void;
  context: (lines: string[]) => void;
};

type Pipe = "out" | "err";

type Learning = {
  lines: string[];
  sent: number;
  candidate?: string[];
  verifyFrom: number;
};

export class MqlSession {
  private generation = 0;
  private proc: ChildProcess | undefined;
  private active = false;
  private opened = false;
  private failed = false;
  private promptSeen = false;
  private prompt: string | undefined;
  private hold = false;
  private done = false;
  private marker: string[] | undefined;
  private learning: Learning | undefined;
  private parsing = false;
  private promptWait = false;
  private lines: Record<Pipe, string> = { out: "", err: "" };
  private rest: Record<Pipe, string> = { out: "", err: "" };
  private held: Record<Pipe, string[]> = { out: [], err: [] };
  private startup = "";
  private startedAt = 0;
  private openTimer: ReturnType<typeof setTimeout> | undefined;
  private trailTimer: ReturnType<typeof setTimeout> | undefined;
  private trailPipe: Pipe | undefined;
  private batchTimer: ReturnType<typeof setTimeout> | undefined;
  private quietTimer: ReturnType<typeof setTimeout> | undefined;
  private learnTimer: ReturnType<typeof setTimeout> | undefined;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private flushTimers: Partial<Record<Pipe, ReturnType<typeof setTimeout>>> = {};
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
    this.prompt = undefined;
    this.hold = false;
    this.done = false;
    this.marker = undefined;
    this.learning = undefined;
    this.parsing = false;
    this.promptWait = false;
    this.lines = { out: "", err: "" };
    this.rest = { out: "", err: "" };
    this.held = { out: [], err: [] };
    this.trailPipe = undefined;
    this.startup = "";
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
    if (!this.hold) {
      this.write(text);
      return true;
    }
    const learn = !this.marker || changesContext(text);
    if (learn) {
      this.marker = undefined;
      this.learning = { lines: [], sent: 2, verifyFrom: 0 };
    }
    this.write([text, markerCommand, ...(learn ? [markerCommand] : [])].join("\n"));
    this.scheduleQuiet();
    return true;
  }

  arm(): boolean {
    if (!this.canSend()) return false;
    this.hold = true;
    this.done = false;
    this.learning = undefined;
    this.rest = { out: "", err: "" };
    this.held = { out: [], err: [] };
    return true;
  }

  private write(text: string) {
    this.proc?.stdin?.write(`${text}\n`);
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
    this.scheduleOpen();
    proc.on("error", () => this.fail(generation));
    proc.on("close", () => this.onExit(generation));
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
    for (const pipe of pipes) {
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
      this.startup += text;
      if (this.startup.length > startupLimit) this.startup = this.startup.slice(-startupLimit);
    }
    this.route(text, pipe);
    this.scheduleOpen();
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
  }

  private route(text: string, pipe: Pipe) {
    if (!this.hold) {
      this.events.output(text);
      return;
    }
    const parts = (this.rest[pipe] + text).split(/\r?\n/);
    this.rest[pipe] = parts.pop() ?? "";
    const out = parts.map((line) => this.takeLine(line, pipe)).join("");
    if (out) this.events.output(out);
    if (this.learning) this.scheduleLearn();
    else this.scheduleFlush(pipe);
    this.scheduleQuiet();
  }

  private takeLine(line: string, pipe: Pipe) {
    if (this.learning) {
      this.learning.lines.push(cleanLine(line));
      return "";
    }
    const marker = this.marker;
    if (!marker || this.done) return `${line}\n`;
    const value = cleanLine(line).trim();
    let out = "";
    if (value && value !== marker[valuesOf(this.held[pipe]).length]) {
      out = joinLines(this.held[pipe]);
      this.held[pipe] = [];
      if (value !== marker[0]) return `${out}${line}\n`;
    }
    if (!value && !this.held[pipe].length) return `${line}\n`;
    this.held[pipe].push(line);
    if (valuesOf(this.held[pipe]).length < marker.length) return out;
    this.held[pipe] = [];
    this.done = true;
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.release(), settleMs);
    return out;
  }

  private scheduleFlush(pipe: Pipe) {
    clearTimeout(this.flushTimers[pipe]);
    const rest = this.rest[pipe];
    const value = cleanLine(rest).trim();
    if (!value || this.done || value !== this.marker?.[valuesOf(this.held[pipe]).length]) return;
    this.flushTimers[pipe] = setTimeout(() => {
      if (this.rest[pipe] !== rest) return;
      this.rest[pipe] = "";
      const out = this.takeLine(rest, pipe);
      if (out) this.events.output(out);
    }, settleMs);
  }

  private scheduleLearn() {
    clearTimeout(this.learnTimer);
    this.learnTimer = setTimeout(() => this.checkLearning(), learnQuietMs);
  }

  private checkLearning() {
    const learning = this.learning;
    if (!learning) return;
    const tentative = pipes.map((pipe) => cleanLine(this.rest[pipe])).filter((line) => line.trim());
    const values = valuesOf([...learning.lines, ...tentative]);
    const candidate = doubledTail(values);
    if (!candidate || countBlocks(values, candidate) < learning.sent) return;
    if (!learning.candidate || !sameBlock(learning.candidate, candidate)) {
      learning.candidate = candidate;
      learning.verifyFrom = values.length;
      learning.sent += 1;
      this.write(markerCommand);
      return;
    }
    if (!countBlocks(values.slice(learning.verifyFrom), candidate)) return;
    for (const pipe of pipes) {
      if (cleanLine(this.rest[pipe]).trim()) this.rest[pipe] = "";
    }
    learning.lines = stripBlocks([...learning.lines, ...tentative], candidate, learning.sent);
    this.marker = candidate;
    this.events.context(candidate);
    this.release();
  }

  private scheduleQuiet() {
    clearTimeout(this.quietTimer);
    this.quietTimer = undefined;
    if (!this.learning) return;
    this.quietTimer = setTimeout(() => this.release(), quietMs);
  }

  private release() {
    if (!this.hold) return;
    const learned = this.learning ? joinLines(this.learning.lines) : "";
    const leftover = pipes
      .map((pipe) => joinLines(this.held[pipe]) + (cleanLine(this.rest[pipe]).trim() ? this.rest[pipe] : ""))
      .join("");
    this.clearHoldTimers();
    this.hold = false;
    this.done = false;
    this.learning = undefined;
    this.rest = { out: "", err: "" };
    this.held = { out: [], err: [] };
    if (learned + leftover) this.events.output(learned + leftover);
    if (!this.promptSeen) {
      this.promptSeen = true;
      if (this.batchTimer) clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
      this.events.prompted();
    }
    this.events.released();
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
    this.prompt = candidate;
    if (this.promptSeen) return;
    this.promptSeen = true;
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = undefined;
    if (this.parsing) this.promptWait = true;
    else {
      this.events.prompted();
      this.open();
    }
  }

  private clearHoldTimers() {
    clearTimeout(this.quietTimer);
    clearTimeout(this.learnTimer);
    clearTimeout(this.settleTimer);
    for (const pipe of pipes) clearTimeout(this.flushTimers[pipe]);
    this.quietTimer = undefined;
    this.learnTimer = undefined;
    this.settleTimer = undefined;
    this.flushTimers = {};
  }

  private clearTimers() {
    if (this.openTimer) clearTimeout(this.openTimer);
    if (this.trailTimer) clearTimeout(this.trailTimer);
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.clearHoldTimers();
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

function changesContext(command: string) {
  return contextPattern.test(command.replace(quotedPattern, '""'));
}

function cleanLine(line: string) {
  return line.replace(promptsPattern, "");
}

function joinLines(lines: string[]) {
  return lines.map((line) => `${line}\n`).join("");
}

function valuesOf(lines: string[]) {
  return lines.map((line) => cleanLine(line).trim()).filter(Boolean);
}

function sameBlock(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function doubledTail(values: string[]) {
  for (let size = 1; size <= Math.min(10, Math.floor(values.length / 2)); size++) {
    const tail = values.slice(-size);
    if (sameBlock(values.slice(-size * 2, -size), tail)) return tail;
  }
  return undefined;
}

function countBlocks(values: string[], block: string[]) {
  let count = 0;
  for (let index = 0; index + block.length <= values.length; ) {
    if (sameBlock(values.slice(index, index + block.length), block)) {
      count++;
      index += block.length;
    } else index++;
  }
  return count;
}

function stripBlocks(lines: string[], block: string[], count: number) {
  let end = lines.length;
  for (let removed = 0; removed < count; removed++) {
    let index = end;
    let matched = block.length;
    while (index > 0 && matched > 0) {
      index--;
      const value = lines[index].trim();
      if (!value) continue;
      if (value !== block[matched - 1]) return lines.slice(0, end);
      matched--;
    }
    if (matched) return lines.slice(0, end);
    end = index;
  }
  return lines.slice(0, end);
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
