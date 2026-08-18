"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { StatusBadge, Avatar, PrimaryButton, GhostButton, ProductSwatch } from "@/components/ui";
import {
  assignOrder,
  cancelOrder,
  confirmOrder,
  dispatchOrders,
  updateOrderStatus,
  useAppState,
} from "@/lib/store";
import { clock, dateLabel, money, paymentLabel, SOURCE_LABEL } from "@/lib/format";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { orders, products, agents, carriers, conversations } = useAppState();
  const order = orders.find((o) => o.id === id);
  if (!order) {
    return (
      <div className="text-sm text-zinc-500">
        Order not found.{" "}
        <Link href="/app/orders" className="font-semibold text-ink">
          Back
        </Link>
      </div>
    );
  }
  const agent = agents.find((a) => a.id === order.assignedTo);
  const carrier = carriers.find((c) => c.id === order.carrierId);
  const conv = conversations.find((c) => c.orderId === order.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/orders" className="text-xs font-semibold text-zinc-500">
            ← Orders
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{order.number}</h1>
            <StatusBadge status={order.status} />
            <span className="text-xs text-zinc-500">{SOURCE_LABEL[order.source]}</span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">{dateLabel(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["new", "pending_confirmation"].includes(order.status) ? (
            <>
              <PrimaryButton onClick={() => confirmOrder(order.id, "whatsapp")}>
                Confirm
              </PrimaryButton>
              <GhostButton onClick={() => cancelOrder(order.id)}>Cancel</GhostButton>
            </>
          ) : null}
          {order.status === "confirmed" ? (
            <PrimaryButton
              onClick={() => dispatchOrders([order.id], carriers.find((c) => c.connected)?.id ?? "c1")}
            >
              Dispatch
            </PrimaryButton>
          ) : null}
          {order.status === "shipped" ? (
            <PrimaryButton onClick={() => updateOrderStatus(order.id, "out_for_delivery", "Out for delivery")}>
              Mark out for delivery
            </PrimaryButton>
          ) : null}
          {order.status === "out_for_delivery" ? (
            <PrimaryButton onClick={() => updateOrderStatus(order.id, "delivered", "Delivered · COD collected")}>
              Mark delivered
            </PrimaryButton>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-sand bg-white p-5">
            <div className="text-sm font-semibold">Customer</div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-zinc-400">Name</div>
                {order.customer.name}
              </div>
              <div>
                <div className="text-xs text-zinc-400">Phone</div>
                {order.customer.phone}
              </div>
              <div>
                <div className="text-xs text-zinc-400">City</div>
                {order.customer.city}
              </div>
              <div>
                <div className="text-xs text-zinc-400">Address</div>
                {order.customer.address}
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-sand bg-white p-5">
            <div className="text-sm font-semibold">Items</div>
            <ul className="mt-3 divide-y divide-sand">
              {order.items.map((it, i) => {
                const p = products.find((x) => x.id === it.productId);
                return (
                  <li key={i} className="flex items-center gap-3 py-3">
                    {p ? <ProductSwatch hue={p.imageHue} className="h-11 w-11" /> : null}
                    <div className="flex-1">
                      <div className="text-sm font-medium">{it.name}</div>
                      <div className="text-xs text-zinc-500">{it.variant}</div>
                    </div>
                    <div className="text-sm">×{it.qty}</div>
                    <div className="w-20 text-right text-sm font-semibold">{money(it.price * it.qty)}</div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex justify-between text-sm font-semibold">
              <span>{paymentLabel(order.payment)}</span>
              <span>{money(order.total)}</span>
            </div>
          </section>
        </div>
        <div className="space-y-4">
          <section className="rounded-2xl border border-sand bg-white p-5">
            <div className="text-sm font-semibold">Assignment</div>
            <select
              className="mt-3 w-full rounded-xl border border-sand px-3 py-2 text-sm"
              value={order.assignedTo ?? ""}
              onChange={(e) => assignOrder(order.id, e.target.value)}
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.role}
                </option>
              ))}
            </select>
            {agent ? (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Avatar initials={agent.initials} hue={agent.hue} />
                {agent.name}
              </div>
            ) : null}
            {carrier ? (
              <div className="mt-4 text-sm">
                <div className="text-xs text-zinc-400">Carrier</div>
                {carrier.name}
                {order.awb ? <div className="font-mono text-xs">{order.awb}</div> : null}
              </div>
            ) : null}
            {conv ? (
              <button
                className="mt-4 text-xs font-semibold"
                onClick={() => router.push(`/app/inbox?c=${conv.id}`)}
              >
                Open conversation →
              </button>
            ) : null}
          </section>
          <section className="rounded-2xl border border-sand bg-white p-5">
            <div className="text-sm font-semibold">Timeline</div>
            <ol className="mt-3 space-y-3">
              {order.timeline.map((ev) => (
                <li key={ev.id} className="flex gap-3 text-sm">
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      ev.tone === "success"
                        ? "bg-emerald-500"
                        : ev.tone === "danger"
                          ? "bg-rose-500"
                          : ev.tone === "warn"
                            ? "bg-amber-500"
                            : "bg-zinc-300"
                    }`}
                  />
                  <div>
                    <div className="font-medium">{ev.title}</div>
                    {ev.detail ? <div className="text-xs text-zinc-500">{ev.detail}</div> : null}
                    <div className="text-[11px] text-zinc-400">{clock(ev.at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
