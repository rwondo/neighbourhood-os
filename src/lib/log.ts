type Level = "debug" | "info" | "warn" | "error";

const PALETTE: Record<Level, string> = {
  debug: "\x1b[90m", // grey
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
};

const RESET = "\x1b[0m";

function ts(): string {
  const d = new Date();
  return d.toISOString().slice(11, 23);
}

function format(scope: string, level: Level, msg: string): string {
  const color = PALETTE[level];
  return `${color}[${ts()}] [${level.toUpperCase()}] [${scope}]${RESET} ${msg}`;
}

function unwrapError(err: Error, depth = 0): string {
  if (depth > 3) return "(cause chain truncated)";
  const head = `${err.name}: ${err.message}`;
  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    return `${head}\n    caused by ${unwrapError(cause, depth + 1)}`;
  }
  if (cause !== undefined && cause !== null) {
    return `${head}\n    caused by ${typeof cause === "object" ? JSON.stringify(cause) : String(cause)}`;
  }
  return `${head}\n  ${err.stack ?? ""}`;
}

function payload(extra: unknown): string {
  if (extra === undefined) return "";
  if (extra instanceof Error) {
    return `\n  ${unwrapError(extra)}`;
  }
  try {
    return `  ${JSON.stringify(extra)}`;
  } catch {
    return `  ${String(extra)}`;
  }
}

export type Logger = {
  scope: string;
  debug: (msg: string, extra?: unknown) => void;
  info: (msg: string, extra?: unknown) => void;
  warn: (msg: string, extra?: unknown) => void;
  error: (msg: string, extra?: unknown) => void;
  child: (subScope: string) => Logger;
  time: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
};

export function makeLogger(scope: string): Logger {
  return {
    scope,
    debug(msg, extra) {
      console.debug(format(scope, "debug", msg) + payload(extra));
    },
    info(msg, extra) {
      console.log(format(scope, "info", msg) + payload(extra));
    },
    warn(msg, extra) {
      console.warn(format(scope, "warn", msg) + payload(extra));
    },
    error(msg, extra) {
      console.error(format(scope, "error", msg) + payload(extra));
    },
    child(sub) {
      return makeLogger(`${scope}:${sub}`);
    },
    async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
      const start = Date.now();
      this.debug(`${label} start`);
      try {
        const result = await fn();
        this.info(`${label} ok`, { ms: Date.now() - start });
        return result;
      } catch (err) {
        this.error(`${label} failed`, {
          ms: Date.now() - start,
          err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
        });
        throw err;
      }
    },
  };
}
