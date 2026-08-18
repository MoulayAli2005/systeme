import { prisma, type Db } from "../../db";
import { ApiError } from "../../http";
import { log } from "../../log";
import { shippingProvider } from "../../providers/registry";
import { changeStatus } from "../orders/service";

/**
 * Carrier vocabularies differ; everything is normalised to this set before it
 * touches an order so the state machine only ever sees known values.
 */
export type ShipmentStatus =
  | "created"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "failed_attempt"
  | "delivered"
  | "refused"
  | "returned"
  | "cancelled"
  | "lost";

const STATUS_ALIASES: Record<string, ShipmentStatus> = {
  created: "created",
  new: "created",
  pending: "created",
  registered: "created",
  ready: "created",
  picked_up: "picked_up",
  pickedup: "picked_up",
  collected: "picked_up",
  received: "picked_up",
  in_transit: "in_transit",
  intransit: "in_transit",
  transit: "in_transit",
  shipped: "in_transit",
  at_hub: "in_transit",
  out_for_delivery: "out_for_delivery",
  outfordelivery: "out_for_delivery",
  dispatched: "out_for_delivery",
  with_courier: "out_for_delivery",
  failed_attempt: "failed_attempt",
  attempt_failed: "failed_attempt",
  no_answer: "failed_attempt",
  unreachable: "failed_attempt",
  postponed: "failed_attempt",
  delivered: "delivered",
  completed: "delivered",
  paid: "delivered",
  refused: "refused",
  rejected: "refused",
  declined: "refused",
  returned: "returned",
  return_to_sender: "returned",
  returned_to_sender: "returned",
  cancelled: "cancelled",
  canceled: "cancelled",
  lost: "lost",
  damaged: "lost",
};

export function normalizeCarrierStatus(raw: string): ShipmentStatus | null {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return STATUS_ALIASES[key] ?? null;
}

/** Order status implied by a shipment status, or null to leave the order alone. */
export function orderStatusFor(status: ShipmentStatus): string | null {
  switch (status) {
    case "delivered":
      return "DELIVERED";
    case "refused":
    case "returned":
      return "RETURNED";
    case "out_for_delivery":
      return "OUT_FOR_DELIVERY";
    case "picked_up":
    case "in_transit":
      return "SHIPPED";
    case "cancelled":
      return "CANCELLED";
    default:
      return null;
  }
}

export const ACTIVE_STATUSES: ShipmentStatus[] = [
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "failed_attempt",
];

export type Quote = { deliveryFee: number; returnFee: number; codFeePercent: number; codFee: number };

/**
 * Prices a shipment from the carrier's rate grid. The most specific row wins:
 * an exact city rate, then the carrier default (city `null`). Without a grid
 * the cost is zero rather than an invented flat fee, so analytics never shows
 * a made-up margin.
 */
export async function quoteShipment(
  opts: { organizationId: string; carrierId?: string | null; city: string; codAmount: number },
  client: Db = prisma,
): Promise<Quote> {
  const empty = { deliveryFee: 0, returnFee: 0, codFeePercent: 0, codFee: 0 };
  if (!opts.carrierId) return empty;

  const rates = await client.carrierRate.findMany({
    where: {
      organizationId: opts.organizationId,
      carrierId: opts.carrierId,
      OR: [{ city: "" }, { city: { equals: opts.city, mode: "insensitive" } }],
    },
  });
  if (!rates.length) return empty;

  const match = rates.find((r) => r.city !== "") ?? rates[0];
  const codFeePercent = Number(match.codFeePercent);
  return {
    deliveryFee: Number(match.deliveryFee),
    returnFee: Number(match.returnFee),
    codFeePercent,
    codFee: Math.round(((opts.codAmount * codFeePercent) / 100) * 100) / 100,
  };
}

export async function createShipmentForOrder(opts: {
  organizationId: string;
  orderId: string;
  carrierId?: string | null;
  userId?: string;
}) {
  const order = await prisma.order.findFirst({
    where: { id: opts.orderId, organizationId: opts.organizationId, deletedAt: null },
    include: { customer: true },
  });
  if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found.");

  const existing = await prisma.shipment.findFirst({
    where: { orderId: order.id, status: { in: ACTIVE_STATUSES } },
  });
  if (existing) return { shipment: existing, created: false };

  const carrierId =
    opts.carrierId ??
    (await prisma.carrier.findFirst({ where: { organizationId: opts.organizationId } }))?.id ??
    null;

  const codAmount = Number(order.codAmount);
  const quote = await quoteShipment({
    organizationId: opts.organizationId,
    carrierId,
    city: order.customer.city,
    codAmount,
  });

  const ship = await shippingProvider().createShipment({
    orderId: order.id,
    city: order.customer.city,
    address: order.customer.address ?? order.customer.city,
    phone: order.customer.phone,
    codAmount,
  });

  const shipment = await prisma.shipment.create({
    data: {
      organizationId: opts.organizationId,
      orderId: order.id,
      carrierId,
      awb: ship.awb,
      trackingUrl: ship.trackingUrl,
      status: "created",
      codAmount,
      shippingCost: quote.deliveryFee,
      returnFee: quote.returnFee,
      codFee: quote.codFee,
      events: { create: { status: "created", detail: `AWB ${ship.awb}`, source: "app" } },
    },
  });

  await changeStatus({
    organizationId: opts.organizationId,
    userId: opts.userId,
    id: order.id,
    status: "SHIPPED",
    note: `AWB ${ship.awb}`,
    source: "shipping",
  });

  return { shipment, created: true };
}

/**
 * Applies a carrier status to a shipment and, when it implies one, to its
 * order. Used by both the polling job and the inbound carrier webhook, so the
 * two paths cannot drift apart.
 */
export async function applyShipmentStatus(opts: {
  shipmentId: string;
  status: ShipmentStatus;
  detail?: string;
  source: "sync" | "webhook" | "app";
  collectedAmount?: number;
}) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: opts.shipmentId },
    include: { order: { select: { id: true, status: true } } },
  });
  if (!shipment) return { changed: false };

  const unchanged = shipment.status === opts.status;
  const now = new Date();

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: opts.status,
      lastStatusDetail: opts.detail,
      lastSyncAt: now,
      ...(opts.status === "delivered" && !shipment.deliveredAt ? { deliveredAt: now } : {}),
      ...(opts.status === "failed_attempt" && !unchanged
        ? { deliveryAttempts: { increment: 1 } }
        : {}),
      ...(opts.collectedAmount !== undefined ? { codCollected: opts.collectedAmount } : {}),
    },
  });

  if (unchanged) return { changed: false };

  await prisma.shipmentEvent.create({
    data: {
      shipmentId: shipment.id,
      status: opts.status,
      detail: opts.detail,
      source: opts.source,
    },
  });

  const target = orderStatusFor(opts.status);
  if (target && target !== shipment.order.status) {
    try {
      await changeStatus({
        organizationId: shipment.organizationId,
        id: shipment.order.id,
        status: target,
        note: `Carrier: ${opts.status}${opts.detail ? ` — ${opts.detail}` : ""}`,
        source: `carrier-${opts.source}`,
      });
    } catch (err) {
      // An illegal move (e.g. a cancelled order the carrier still delivered)
      // must not stall the sync; it is surfaced on the shipment timeline.
      log.warn("Carrier status could not move the order", {
        shipmentId: shipment.id,
        orderId: shipment.order.id,
        from: shipment.order.status,
        to: target,
        error: (err as Error).message,
      });
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: opts.status,
          detail: `Order left in ${shipment.order.status}: ${(err as Error).message}`,
          source: opts.source,
        },
      });
    }
  }

  if (opts.status === "returned" || opts.status === "refused") {
    await openReturnCase(shipment.organizationId, shipment.order.id, opts.status, Number(shipment.returnFee));
  }

  return { changed: true };
}

async function openReturnCase(
  organizationId: string,
  orderId: string,
  reason: string,
  shippingCost: number,
) {
  const existing = await prisma.returnCase.findFirst({
    where: { organizationId, orderId, status: { notIn: ["CLOSED", "REFUNDED"] } },
  });
  if (existing) return existing;
  return prisma.returnCase.create({
    data: {
      organizationId,
      orderId,
      status: "RETURN_IN_TRANSIT",
      reason: reason === "refused" ? "Customer refused delivery" : "Returned by carrier",
      shippingCost,
    },
  });
}

/** Polls one shipment against the carrier API. */
export async function syncShipment(shipmentId: string) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment?.awb) return { synced: false, reason: "no_awb" };

  const provider = shippingProvider();
  const result = await provider.trackShipment(shipment.awb);
  const status = normalizeCarrierStatus(result.status);
  if (!status) {
    log.warn("Unmapped carrier status", { awb: shipment.awb, status: result.status });
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { lastSyncAt: new Date(), lastStatusDetail: `Unmapped: ${result.status}` },
    });
    return { synced: false, reason: "unmapped_status" };
  }

  const applied = await applyShipmentStatus({
    shipmentId: shipment.id,
    status,
    detail: result.detail,
    source: "sync",
  });
  return { synced: true, status, ...applied };
}

/**
 * Polls the shipments that can still move. Ordered by staleness so a large
 * backlog is worked through fairly across runs rather than starving the tail.
 */
export async function syncActiveShipments(limit = 200) {
  const shipments = await prisma.shipment.findMany({
    where: { status: { in: ACTIVE_STATUSES }, awb: { not: null } },
    orderBy: [{ lastSyncAt: { sort: "asc", nulls: "first" } }],
    take: limit,
    select: { id: true },
  });

  let changed = 0;
  let failed = 0;
  for (const { id } of shipments) {
    try {
      const result = await syncShipment(id);
      if ("changed" in result && result.changed) changed += 1;
    } catch (err) {
      failed += 1;
      log.warn("Shipment sync failed", { shipmentId: id, error: (err as Error).message });
    }
  }
  return { checked: shipments.length, changed, failed };
}

/**
 * Delivered shipments whose cash has not been reconciled past the carrier's
 * settlement window. This is money owed to the merchant that nobody chased.
 */
export async function overdueSettlements(organizationId: string) {
  const carriers = await prisma.carrier.findMany({
    where: { organizationId },
    select: { id: true, name: true, settlementDays: true },
  });
  const defaultDays = 14;
  const rows = await prisma.shipment.findMany({
    where: { organizationId, status: "delivered", settledAt: null, deliveredAt: { not: null } },
    include: { order: { select: { number: true } } },
    orderBy: { deliveredAt: "asc" },
    take: 200,
  });

  const now = Date.now();
  return rows
    .map((s) => {
      const days = carriers.find((c) => c.id === s.carrierId)?.settlementDays ?? defaultDays;
      const ageDays = Math.floor((now - (s.deliveredAt?.getTime() ?? now)) / 864e5);
      return {
        shipmentId: s.id,
        awb: s.awb,
        orderNumber: s.order.number,
        carrier: carriers.find((c) => c.id === s.carrierId)?.name ?? "Unassigned",
        deliveredAt: s.deliveredAt,
        ageDays,
        overdueBy: ageDays - days,
        codAmount: Number(s.codAmount),
      };
    })
    .filter((row) => row.overdueBy > 0);
}
