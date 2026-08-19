import { ZodError } from "zod";
import { log } from "./log";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(data, { status, headers });
}

export function errorResponse(err: unknown, requestId?: string) {
  const idHeader = requestId ? { "X-Request-Id": requestId } : undefined;

  if (err instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "Request body failed validation.",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          requestId,
        },
      },
      { status: 400, headers: idHeader },
    );
  }

  if (err instanceof ApiError) {
    if (err.status >= 500) log.error("Request failed", err, { requestId, code: err.code });
    return Response.json(
      { error: { code: err.code, message: err.message, details: err.details, requestId } },
      { status: err.status, headers: { ...idHeader, ...err.headers } },
    );
  }

  log.error("Unhandled request error", err, { requestId });
  return Response.json(
    { error: { code: "INTERNAL", message: "Something went wrong.", requestId } },
    { status: 500, headers: idHeader },
  );
}

export type Page = { take: number; cursor: string | null; q?: string };

export function parsePage(url: URL): Page {
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
  const cursor = url.searchParams.get("cursor");
  const q = url.searchParams.get("q")?.trim() || undefined;
  return { take, cursor, q };
}

/**
 * Prisma arguments for keyset pagination. One extra row is fetched to detect
 * whether another page exists without a second count query.
 */
export function cursorArgs(page: Page) {
  return {
    take: page.take + 1,
    ...(page.cursor ? { skip: 1, cursor: { id: page.cursor } } : {}),
  };
}

/** Splits the lookahead row off and returns it as the next cursor. */
export function withCursor<T extends { id: string }>(rows: T[], page: Page) {
  const nextCursor = rows.length > page.take ? rows.pop()!.id : null;
  return { rows, nextCursor };
}
