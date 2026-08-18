import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, json, parsePage } from "../http";
import { prisma } from "../db";
import { requireAuth, requirePermission } from "../auth/session";
import { startOrderImport } from "../modules/imports/orders";
import { replayInboundEvent } from "../modules/inbound/service";

/** Background work and integration plumbing the operator needs to see. */
export async function handleOps(
  req: NextRequest,
  method: string,
  path: string,
  url: URL,
  body: unknown,
): Promise<Response | null> {
  if (path === "jobs" && method === "GET") {
    const ctx = await requireAuth(req);
    const page = parsePage(url);
    const rows = await prisma.jobRun.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(url.searchParams.get("kind") ? { kind: url.searchParams.get("kind")! } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: page.take,
      // `result` can hold the whole import payload; the list view never needs it.
      select: {
        id: true,
        kind: true,
        status: true,
        total: true,
        processed: true,
        failed: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    return json({ rows });
  }

  if (path.match(/^jobs\/[^/]+$/) && method === "GET") {
    const ctx = await requireAuth(req);
    const id = path.split("/")[1];
    const job = await prisma.jobRun.findFirst({
      where: { id, organizationId: ctx.organizationId },
      select: {
        id: true,
        kind: true,
        status: true,
        total: true,
        processed: true,
        failed: true,
        errors: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    if (!job) throw new ApiError(404, "NOT_FOUND", "Job not found.");
    return json(job);
  }

  if (path === "inbound-events" && method === "GET") {
    const ctx = await requirePermission("integrations.manage", req);
    const page = parsePage(url);
    const status = url.searchParams.get("status") ?? undefined;
    const rows = await prisma.inboundEvent.findMany({
      where: { organizationId: ctx.organizationId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: page.take + 1,
      ...(page.cursor ? { skip: 1, cursor: { id: page.cursor } } : {}),
      select: {
        id: true,
        provider: true,
        topic: true,
        status: true,
        externalId: true,
        orderId: true,
        error: true,
        attempts: true,
        createdAt: true,
        processedAt: true,
      },
    });
    const nextCursor = rows.length > page.take ? rows.pop()!.id : null;
    return json({ rows, nextCursor });
  }

  if (path.match(/^inbound-events\/[^/]+$/) && method === "GET") {
    const ctx = await requirePermission("integrations.manage", req);
    const id = path.split("/")[1];
    const event = await prisma.inboundEvent.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!event) throw new ApiError(404, "NOT_FOUND", "Inbound event not found.");
    return json(event);
  }

  if (path.match(/^inbound-events\/[^/]+\/replay$/) && method === "POST") {
    const ctx = await requirePermission("integrations.manage", req);
    const id = path.split("/")[1];
    return json(await replayInboundEvent(ctx.organizationId, id));
  }

  if (path === "import/orders" && method === "POST") {
    const ctx = await requirePermission("orders.write", req);
    const data = z
      .object({
        csv: z.string().optional(),
        rows: z.array(z.unknown()).optional(),
      })
      .parse(body);
    if (!data.csv && !data.rows?.length) {
      throw new ApiError(400, "BAD_REQUEST", "Provide either a `csv` string or a `rows` array.");
    }
    return json(
      await startOrderImport({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        csv: data.csv,
        rows: data.rows,
      }),
    );
  }

  return null;
}
