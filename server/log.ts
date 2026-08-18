import { randomUUID } from "crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

const WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configured = (process.env.LOG_LEVEL as LogLevel | undefined) ?? undefined;
const threshold =
  WEIGHT[configured ?? (process.env.NODE_ENV === "production" ? "info" : "debug")] ?? WEIGHT.info;

// Railway and most log drains ingest one JSON object per line. Locally a
// human-readable line is easier to scan.
const asJson = process.env.NODE_ENV === "production" || process.env.LOG_FORMAT === "json";

export type LogFields = Record<string, unknown>;

function serializeError(err: unknown): LogFields {
  if (err instanceof Error) {
    return {
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack,
      ...("code" in err ? { errorCode: (err as { code?: unknown }).code } : {}),
    };
  }
  return { errorMessage: String(err) };
}

export class Logger {
  constructor(private readonly base: LogFields = {}) {}

  child(fields: LogFields) {
    return new Logger({ ...this.base, ...fields });
  }

  debug(msg: string, fields?: LogFields) {
    this.write("debug", msg, fields);
  }

  info(msg: string, fields?: LogFields) {
    this.write("info", msg, fields);
  }

  warn(msg: string, fields?: LogFields) {
    this.write("warn", msg, fields);
  }

  error(msg: string, err?: unknown, fields?: LogFields) {
    this.write("error", msg, { ...(err === undefined ? {} : serializeError(err)), ...fields });
  }

  private write(level: LogLevel, msg: string, fields?: LogFields) {
    if (WEIGHT[level] < threshold) return;
    const record = { level, time: new Date().toISOString(), msg, ...this.base, ...fields };
    const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    if (asJson) {
      sink(JSON.stringify(record));
      return;
    }
    const { level: _l, time: _t, msg: _m, ...rest } = record;
    const detail = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
    sink(`${level.toUpperCase().padEnd(5)} ${msg}${detail}`);
  }
}

export const log = new Logger();

export const REQUEST_ID_HEADER = "x-request-id";

export function newRequestId() {
  return randomUUID();
}

/** Reads the id stamped by `proxy.ts`, or mints one for non-proxied entry points. */
export function requestIdOf(req?: { headers: Headers }) {
  return req?.headers.get(REQUEST_ID_HEADER) || newRequestId();
}
