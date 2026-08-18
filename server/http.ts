export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return Response.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  console.error(err);
  return Response.json(
    { error: { code: "INTERNAL", message: "Something went wrong." } },
    { status: 500 },
  );
}

export function parsePage(url: URL) {
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
  const cursor = url.searchParams.get("cursor");
  const q = url.searchParams.get("q")?.trim() || undefined;
  return { take, cursor, q };
}
