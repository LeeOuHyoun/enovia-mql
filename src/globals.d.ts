declare function setTimeout(handler: () => void, timeout: number): number;

declare function clearTimeout(handle: number | undefined): void;

declare class TextDecoder {
  constructor(label?: string);
  decode(input?: Uint8Array, options?: { stream?: boolean }): string;
}

declare module 'node:child_process' {
  interface Writable {
    writable: boolean;
    destroyed: boolean;
    write(chunk: string): boolean;
    on(event: 'error', listener: (error: Error) => void): void;
  }

  interface Readable {
    on(event: 'data', listener: (chunk: Uint8Array) => void): void;
  }

  export interface ChildProcess {
    readonly pid?: number;
    readonly exitCode: number | null;
    readonly killed: boolean;
    readonly stdin: Writable | null;
    readonly stdout: Readable | null;
    readonly stderr: Readable | null;
    on(event: 'error', listener: (error: Error) => void): void;
    on(event: 'exit', listener: (code: number | null) => void): void;
    kill(): boolean;
  }

  export function spawn(
    command: string,
    args: readonly string[],
    options: {
      shell?: boolean;
      windowsHide?: boolean;
      stdio?: readonly ['pipe', 'pipe', 'pipe'] | 'ignore';
    },
  ): ChildProcess;

  export function execFile(
    file: string,
    args: readonly string[],
    options: { windowsHide?: boolean },
    callback: (error: Error | null, stdout: string | Uint8Array, stderr: string | Uint8Array) => void,
  ): ChildProcess;
}
