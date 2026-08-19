import "dotenv/config";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../server/db";
import { ensurePermissions, seedRolesForOrg, seedStatuses } from "../server/org/bootstrap";
import { presetActions, presetConditions, WHATSAPP_PRESETS } from "../server/modules/automations/whatsapp";

const CITIES = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Tangier",
  "Agadir",
  "Fes",
  "Meknes",
  "Oujda",
  "Kenitra",
  "Tetouan",
];
const FIRST = ["Nabil", "Ihsane", "Tarik", "Nadia", "Mounir", "Dounia", "Yassine", "Noura", "Sara", "Omar", "Lina", "Reda", "Amina", "Hicham", "Ines", "Mehdi", "Rania", "Walid", "Aya", "Karim"];
const LAST = ["Amrani", "Mernissi", "Ouazzani", "Harmouch", "Zahraoui", "Slaoui", "Berrada", "Senhaji", "Benjelloun", "Tazi", "Chraibi", "Fassi", "Kettani", "Lahlou", "Kadiri", "Squalli", "El Alami", "Bennani", "Cherkaoui", "Idrissi"];

const STATUSES = [
  ["NEW", 8],
  ["TO_CONFIRM", 12],
  ["CALLING", 4],
  ["NO_ANSWER", 3],
  ["CALLBACK", 3],
  ["CONFIRMED", 10],
  ["PREPARING", 6],
  ["SHIPPED", 12],
  ["OUT_FOR_DELIVERY", 8],
  ["DELIVERED", 24],
  ["CANCELLED", 6],
  ["RETURNED", 4],
] as const;

function pickStatus(i: number) {
  const total = STATUSES.reduce((s, x) => s + x[1], 0);
  let n = i % total;
  for (const [k, w] of STATUSES) {
    n -= w;
    if (n < 0) return k;
  }
  return "DELIVERED";
}

const PRODUCT_DEFS = [
  ["Aurora Linen Shirt", "Shirts", 289, 110, 32],
  ["Terra Knit Polo", "Knitwear", 349, 140, 92],
  ["Nomad Denim", "Denim", 419, 160, 220],
  ["Marrakech Loafers", "Shoes", 459, 180, 28],
  ["Sahara Slip Dress", "Dresses", 389, 150, 40],
  ["Atlas Linen Blazer", "Outerwear", 629, 250, 230],
  ["Casa Cotton Tee", "Basics", 149, 45, 0],
  ["Rif Canvas Tote", "Bags", 219, 70, 38],
  ["Medina Silk Scarf", "Accessories", 179, 40, 12],
  ["Agadir Swim Shorts", "Basics", 199, 60, 195],
] as const;

async function reset() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "WebhookDelivery","WebhookEndpoint","AutomationRun","Automation",
      "AdSpend","Ad","Campaign","Message","Conversation","Call",
      "RemittanceLine","Remittance","ReturnCase","ShipmentEvent","Shipment",
      "OrderEvent","OrderItem","Order","OrderCounter",
      "InventoryMovement","InventoryItem","StockTransfer","ProductVariant","Product",
      "Customer","AgentProfile","Team","CarrierRate","Carrier","Store","Warehouse","Supplier",
      "Notification","Task","AuditLog","ApiKey","Integration","MessageTemplate",
      "InboundEvent","JobRun",
      "StatusDefinition","UsageRecord","Subscription","RolePermission","Membership",
      "Session","LoginEvent","PasswordReset","EmailVerification",
      "Role","Organization"
    RESTART IDENTITY CASCADE;
  `);
}

export async function main() {
  console.log("Seeding Nexora…");
  await ensurePermissions();
  await reset();
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const adminHash = await bcrypt.hash("ChangeMeAdmin!", 10);

  const platform = await prisma.user.upsert({
    where: { email: "nina.v@example.com" },
    update: { passwordHash: adminHash, isPlatformAdmin: true },
    create: {
      email: "nina.v@example.com",
      name: "Platform Admin",
      passwordHash: adminHash,
      isPlatformAdmin: true,
      emailVerifiedAt: new Date(),
    },
  });

  const atlas = await seedOrg({
    name: "Atlas Atelier",
    slug: "atlas-atelier",
    country: "MA",
    currency: "MAD",
    owner: { email: "amine@atlasatelier.ma", name: "Amine Kadiri" },
    agents: [
      { email: "yasmine@atlasatelier.ma", name: "Yasmine El Fassi", role: "call_center_manager" },
      { email: "karim@atlasatelier.ma", name: "Karim Bennani", role: "call_center_agent" },
      { email: "salma@atlasatelier.ma", name: "Salma Idrissi", role: "call_center_agent" },
      { email: "omar@atlasatelier.ma", name: "Omar Cherkaoui", role: "warehouse_manager" },
      { email: "nour@atlasatelier.ma", name: "Nour Alami", role: "warehouse_employee" },
      { email: "imane@atlasatelier.ma", name: "Imane Kadiri", role: "call_center_agent" },
      { email: "hassan@atlasatelier.ma", name: "Hassan Tazi", role: "call_center_agent" },
      { email: "sofia@atlasatelier.ma", name: "Sofia Berrada", role: "call_center_agent" },
      { email: "youssef@atlasatelier.ma", name: "Youssef Mernissi", role: "call_center_agent" },
      { email: "laila@atlasatelier.ma", name: "Laila Senhaji", role: "call_center_agent" },
      { email: "anass@atlasatelier.ma", name: "Anass Lahlou", role: "call_center_agent" },
      { email: "rania@atlasatelier.ma", name: "Rania Harmouch", role: "warehouse_employee" },
      { email: "mehdi@atlasatelier.ma", name: "Mehdi Squalli", role: "accountant" },
      { email: "ghita@atlasatelier.ma", name: "Ghita Fassi", role: "marketing_manager" },
    ],
    extraStores: 2,
    orderCount: 4000,
    passwordHash,
  });

  await seedOrg({
    name: "Casa Home",
    slug: "casa-home",
    country: "MA",
    currency: "MAD",
    owner: { email: "sara@casahome.ma", name: "Sara El Alami" },
    agents: [
      { email: "hicham@casahome.ma", name: "Hicham Lahlou", role: "call_center_agent" },
      { email: "lina@casahome.ma", name: "Lina Chraibi", role: "marketing_manager" },
    ],
    extraStores: 1,
    orderCount: 1000,
    passwordHash,
  });

  await prisma.user.update({ where: { id: platform.id }, data: { isPlatformAdmin: true } });
  console.log("Done. Atlas org", atlas.orgId);
}

async function seedOrg(opts: {
  name: string;
  slug: string;
  country: string;
  currency: string;
  owner: { email: string; name: string };
  agents: Array<{ email: string; name: string; role: string }>;
  extraStores: number;
  orderCount: number;
  passwordHash: string;
}) {
  const org = await prisma.organization.create({
    data: {
      name: opts.name,
      slug: opts.slug,
      country: opts.country,
      currency: opts.currency,
      plan: "PRO",
    },
  });
  await seedRolesForOrg(org.id);
  await seedStatuses(org.id);
  await prisma.subscription.create({
    data: { organizationId: org.id, plan: "PRO", status: "active" },
  });

  const roles = await prisma.role.findMany({ where: { organizationId: org.id } });
  const role = (k: string) => roles.find((r) => r.key === k)!;

  async function userWithRole(email: string, name: string, key: string, hue = 160) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash: opts.passwordHash, emailVerifiedAt: new Date() },
      create: {
        email,
        name,
        passwordHash: opts.passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.membership.create({
      data: { organizationId: org.id, userId: user.id, roleId: role(key).id },
    });
    const profile = await prisma.agentProfile.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        state: "available",
        confirmedToday: Math.floor(Math.random() * 30),
        avgConfirmMin: 4 + Math.floor(Math.random() * 6),
        hue,
      },
    });
    return { user, profile };
  }

  const owner = await userWithRole(opts.owner.email, opts.owner.name, "owner", 150);
  const agentUsers = [owner];
  for (const [i, a] of opts.agents.entries()) {
    agentUsers.push(await userWithRole(a.email, a.name, a.role, 40 + i * 40));
  }

  const team = await prisma.team.create({
    data: { organizationId: org.id, name: "Confirmation desk", kind: "confirmation" },
  });
  await prisma.agentProfile.updateMany({
    where: { organizationId: org.id },
    data: { teamId: team.id },
  });

  const whCasa = await prisma.warehouse.create({
    data: {
      organizationId: org.id,
      name: "Casa Hub",
      city: "Casablanca",
      isDefault: true,
      routingRules: [{ city: "Casablanca" }, { city: "Rabat" }, { city: "Kenitra" }],
    },
  });
  const whMarrakech = await prisma.warehouse.create({
    data: {
      organizationId: org.id,
      name: "South Hub",
      city: "Marrakech",
      routingRules: [{ city: "Marrakech" }, { city: "Agadir" }],
    },
  });
  await prisma.warehouse.create({
    data: { organizationId: org.id, name: "North Hub", city: "Tangier", routingRules: [{ city: "Tangier" }, { city: "Tetouan" }] },
  });

  const store1 = await prisma.store.create({
    data: {
      organizationId: org.id,
      name: `${opts.name} Shopify`,
      platform: "shopify",
      domain: `${opts.slug}.myshopify.com`,
      warehouseId: whCasa.id,
      status: "connected",
    },
  });
  const store2 = await prisma.store.create({
    data: {
      organizationId: org.id,
      name: `${opts.name} YouCan`,
      platform: "youcan",
      warehouseId: whMarrakech.id,
      status: "connected",
    },
  });
  const stores = [store1, store2];
  for (let i = 0; i < opts.extraStores; i++) {
    stores.push(
      await prisma.store.create({
        data: {
          organizationId: org.id,
          name: `${opts.name} Woo ${i + 1}`,
          platform: "woocommerce",
          warehouseId: whCasa.id,
        },
      }),
    );
  }

  const carriers = await prisma.carrier.createManyAndReturn({
    data: [
      { organizationId: org.id, name: "Ozon Express", adapter: "demo", connected: true, pickupWindow: "Today 17:00", deliveredRate: 91 },
      { organizationId: org.id, name: "Ameex", adapter: "demo", connected: true, pickupWindow: "Today 16:30", deliveredRate: 88 },
      { organizationId: org.id, name: "Aramex", adapter: "generic", connected: false, deliveredRate: 93 },
      { organizationId: org.id, name: "Cathedis", adapter: "demo", connected: true, pickupWindow: "Tomorrow 10:00", deliveredRate: 86 },
    ],
  });

  // Rate grid: without it every shipment costs zero and margin is fiction.
  // Big cities are cheaper to serve than the long tail.
  const METRO = ["Casablanca", "Rabat", "Marrakech", "Tangier"];
  await prisma.carrierRate.createMany({
    data: carriers.flatMap((carrier, index) => [
      {
        organizationId: org.id,
        carrierId: carrier.id,
        city: "",
        deliveryFee: 32 + index * 3,
        returnFee: 18 + index * 2,
        codFeePercent: 1.2,
      },
      ...METRO.map((city) => ({
        organizationId: org.id,
        carrierId: carrier.id,
        city,
        deliveryFee: 24 + index * 2,
        returnFee: 14 + index,
        codFeePercent: 1,
      })),
    ]),
  });

  const variants: Array<{ id: string; productName: string; variantName: string; price: number; cost: number }> = [];
  const productCount = opts.slug === "atlas-atelier" ? 80 : 20;
  for (let i = 0; i < productCount; i++) {
    const def = PRODUCT_DEFS[i % PRODUCT_DEFS.length];
    const sku = `${opts.slug.slice(0, 3).toUpperCase()}-${1000 + i}`;
    const product = await prisma.product.create({
      data: {
        organizationId: org.id,
        storeId: stores[i % stores.length].id,
        name: `${def[0]} ${i > 9 ? `#${i}` : ""}`.trim(),
        sku,
        category: def[1],
        price: def[2],
        cost: def[3],
        hue: def[4],
        variants: {
          create: [
            { name: "M / Default", sku: `${sku}-M`, price: def[2], cost: def[3], options: { size: "M" } },
            { name: "L / Default", sku: `${sku}-L`, price: def[2], cost: def[3], options: { size: "L" } },
          ],
        },
      },
      include: { variants: true },
    });
    for (const v of product.variants) {
      variants.push({
        id: v.id,
        productName: product.name,
        variantName: v.name,
        price: Number(v.price),
        cost: Number(v.cost),
      });
      await prisma.inventoryItem.create({
        data: {
          organizationId: org.id,
          variantId: v.id,
          warehouseId: i % 3 === 0 ? whMarrakech.id : whCasa.id,
          onHand: 20 + (i % 40),
          reserved: i % 5,
        },
      });
    }
  }

  const customerIds: string[] = [];
  const customerPhones: string[] = [];
  const custRows = [];
  const customerTarget = opts.slug === "atlas-atelier" ? 800 : 200;
  for (let i = 0; i < customerTarget; i++) {
    const id = randomUUID();
    customerIds.push(id);
    const phone = `+2126${String(10000000 + i).slice(0, 8)}`;
    customerPhones.push(phone);
    custRows.push({
      id,
      organizationId: org.id,
      name: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`,
      phone,
      city: CITIES[i % CITIES.length],
      address: `${12 + (i % 80)} Rue ${i % 40}`,
      country: "MA",
      riskScore: 10 + (i % 70),
      riskLabel: i % 17 === 0 ? "high_risk" : i % 9 === 0 ? "risky" : "normal",
    });
  }
  for (let i = 0; i < custRows.length; i += 200) {
    await prisma.customer.createMany({ data: custRows.slice(i, i + 200) });
  }

  const sources = ["shopify", "woocommerce", "youcan", "facebook", "tiktok", "manual"];
  const orderRows = [];
  const itemRows = [];
  const eventRows = [];
  const now = Date.now();
  for (let i = 0; i < opts.orderCount; i++) {
    const id = randomUUID();
    const status = pickStatus(i);
    const variant = variants[i % variants.length];
    const qty = 1 + (i % 3 === 0 ? 1 : 0);
    const total = variant.price * qty;
    const createdAt = new Date(now - (opts.orderCount - i) * 25 * 60_000);
    const custId = customerIds[i % customerIds.length];
    const agent = agentUsers[i % agentUsers.length].user.id;
    orderRows.push({
      id,
      organizationId: org.id,
      storeId: stores[i % stores.length].id,
      warehouseId: i % 4 === 0 ? whMarrakech.id : whCasa.id,
      customerId: custId,
      agentId: ["TO_CONFIRM", "NEW", "CALLING"].includes(status) ? agent : agent,
      number: `${opts.slug === "atlas-atelier" ? "NX" : "CH"}-${10000 + i}`,
      status,
      paymentMethod: i % 8 === 0 ? "prepaid" : "cod",
      source: sources[i % sources.length],
      utmSource: sources[i % sources.length],
      utmCampaign: i % 5 === 0 ? "ramadan-linen" : "evergreen",
      subtotal: total,
      total,
      codAmount: i % 8 === 0 ? 0 : total,
      currency: "MAD",
      createdAt,
      updatedAt: createdAt,
    });
    itemRows.push({
      id: randomUUID(),
      orderId: id,
      variantId: variant.id,
      name: variant.productName,
      variant: variant.variantName,
      quantity: qty,
      price: variant.price,
      cost: variant.cost,
    });
    eventRows.push({
      id: randomUUID(),
      orderId: id,
      title: "Order placed",
      detail: sources[i % sources.length],
      createdAt,
    });
  }
  for (let i = 0; i < orderRows.length; i += 250) {
    await prisma.order.createMany({ data: orderRows.slice(i, i + 250) });
  }
  for (let i = 0; i < itemRows.length; i += 250) {
    await prisma.orderItem.createMany({ data: itemRows.slice(i, i + 250) });
  }
  for (let i = 0; i < eventRows.length; i += 250) {
    await prisma.orderEvent.createMany({ data: eventRows.slice(i, i + 250) });
  }

  const shipped = orderRows.filter((o) =>
    ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"].includes(o.status),
  );
  const cityOf = new Map<string, string>(custRows.map((c) => [String(c.id), c.city]));
  const shipRows = shipped.slice(0, Math.min(shipped.length, 800)).map((o, i) => {
    const carrier = carriers[i % carriers.length];
    const metro = METRO.includes(cityOf.get(o.customerId) ?? "");
    const deliveryFee = metro ? 24 + (i % carriers.length) * 2 : 32 + (i % carriers.length) * 3;
    const cod = Number(o.codAmount ?? o.total);
    const status =
      o.status === "DELIVERED" ? "delivered" : o.status === "RETURNED" ? "returned" : "in_transit";
    return {
      id: randomUUID(),
      organizationId: org.id,
      orderId: o.id,
      carrierId: carrier.id,
      awb: `${opts.slug === "atlas-atelier" ? "OZ" : "CH"}${100000000 + i}`,
      status,
      codAmount: cod,
      shippingCost: deliveryFee,
      returnFee: metro ? 14 : 18,
      codFee: Math.round(cod * (metro ? 1 : 1.2)) / 100,
      deliveredAt: status === "delivered" ? o.createdAt : null,
      createdAt: o.createdAt,
    };
  });
  for (let i = 0; i < shipRows.length; i += 250) {
    await prisma.shipment.createMany({ data: shipRows.slice(i, i + 250) });
  }

  // One settled statement and one still open, so reconciliation has something
  // to show — including a short payment to investigate.
  const delivered = shipRows.filter((s) => s.status === "delivered");
  if (delivered.length > 20) {
    const settledBatch = delivered.slice(0, 40);
    const openBatch = delivered.slice(40, 70);

    for (const [index, batch] of [settledBatch, openBatch].entries()) {
      if (!batch.length) continue;
      const settled = index === 0;
      const lines = batch.map((s, i) => {
        // Every twentieth line is short-paid: real statements never balance.
        const short = i % 20 === 19 ? 50 : 0;
        const declared = Math.max(0, Number(s.codAmount) - Number(s.codFee) - short);
        return {
          organizationId: org.id,
          shipmentId: s.id,
          orderId: s.orderId,
          awb: s.awb,
          status: short ? "variance" : "matched",
          declaredAmount: declared,
          expectedAmount: Number(s.codAmount),
          feeAmount: Number(s.codFee),
          variance: declared + Number(s.codFee) - Number(s.codAmount),
        };
      });
      const remittance = await prisma.remittance.create({
        data: {
          organizationId: org.id,
          carrierId: carriers[0].id,
          reference: `${settled ? "STMT" : "STMT-OPEN"}-${opts.slug.slice(0, 3).toUpperCase()}-0${index + 1}`,
          status: settled ? "settled" : "matched",
          declaredTotal: lines.reduce((s, l) => s + l.declaredAmount, 0),
          matchedTotal: lines.reduce((s, l) => s + l.declaredAmount, 0),
          expectedTotal: lines.reduce((s, l) => s + l.expectedAmount, 0),
          feeTotal: lines.reduce((s, l) => s + l.feeAmount, 0),
          varianceTotal: lines.reduce((s, l) => s + l.variance, 0),
          settledAt: settled ? new Date() : null,
        },
      });
      await prisma.remittanceLine.createMany({
        data: lines.map((l) => ({ ...l, remittanceId: remittance.id })),
      });
      if (settled) {
        for (const line of lines) {
          await prisma.shipment.update({
            where: { id: line.shipmentId },
            data: { codCollected: line.declaredAmount, settledAt: new Date() },
          });
        }
      }
    }
  }

  const returned = orderRows.filter((o) => o.status === "RETURNED").slice(0, 80);
  if (returned.length) {
    await prisma.returnCase.createMany({
      data: returned.map((o) => ({
        organizationId: org.id,
        orderId: o.id,
        status: "RECEIVED",
        reason: "Size / refused COD",
      })),
    });
  }

  const convs = [];
  for (let i = 0; i < 40; i++) {
    convs.push({
      id: randomUUID(),
      organizationId: org.id,
      customerId: customerIds[i],
      orderId: orderRows[i]?.id,
      channel: i % 5 === 0 ? "instagram" : i % 7 === 0 ? "email" : "whatsapp",
      unread: i % 3 === 0 ? 1 : 0,
      lastMessage: i % 2 === 0 ? "Confirm" : "Where is my order?",
      lastAt: new Date(now - i * 3600_000),
    });
  }
  await prisma.conversation.createMany({ data: convs });
  await prisma.message.createMany({
    data: convs.flatMap((c) => [
      {
        conversationId: c.id,
        from: "system",
        text: `Hi, we received your order. Cash on delivery.`,
        createdAt: c.lastAt,
      },
      { conversationId: c.id, from: "customer", text: c.lastMessage ?? "ok", createdAt: c.lastAt },
    ]),
  });

  const camp = await prisma.campaign.create({
    data: { organizationId: org.id, platform: "meta", name: "Ramadan linen", status: "active" },
  });
  const ad = await prisma.ad.create({
    data: { organizationId: org.id, campaignId: camp.id, name: "Aurora beige" },
  });
  const spendDays = [];
  for (let d = 0; d < 14; d++) {
    spendDays.push({
      organizationId: org.id,
      adId: ad.id,
      date: new Date(Date.now() - d * 864e5),
      spend: 400 + d * 20,
      impressions: 12000 + d * 100,
      clicks: 300 + d * 8,
    });
  }
  await prisma.adSpend.createMany({ data: spendDays });

  await prisma.automation.createMany({
    data: [
      ...WHATSAPP_PRESETS.map((preset, index) => ({
        organizationId: org.id,
        name: preset.name,
        trigger: preset.trigger,
        conditions: presetConditions(preset),
        actions: presetActions(preset),
        enabled: true,
        runsToday: [40, 12, 18, 22, 16, 14, 3][index] ?? 0,
      })),
      {
        organizationId: org.id,
        name: "Dispatch on confirm",
        trigger: "order.status",
        conditions: { status: "CONFIRMED" },
        actions: [{ type: "create_shipment" }],
        runsToday: 18,
      },
      {
        organizationId: org.id,
        name: "Callback after 3 misses",
        trigger: "order.status",
        conditions: { minCallAttempts: 3 },
        actions: [{ type: "change_status", status: "CALLBACK" }],
        runsToday: 4,
      },
    ],
  });

  await prisma.integration.createMany({
    data: [
      { organizationId: org.id, kind: "store", provider: "shopify", name: "Shopify", connected: true },
      { organizationId: org.id, kind: "store", provider: "woocommerce", name: "WooCommerce", connected: true },
      { organizationId: org.id, kind: "channel", provider: "whatsapp", name: "WhatsApp Cloud API", connected: false },
      { organizationId: org.id, kind: "carrier", provider: "ozon", name: "Ozon Express", connected: true },
      { organizationId: org.id, kind: "ads", provider: "meta", name: "Meta Ads", connected: false },
    ],
  });

  await prisma.messageTemplate.createMany({
    data: [
      {
        organizationId: org.id,
        channel: "whatsapp",
        name: "Confirm COD",
        body: "Hi {{customer_name}}, confirm {{order_id}} — {{product_name}} {{total}} MAD COD to {{city}}?",
      },
      {
        organizationId: org.id,
        channel: "sms",
        name: "Out for delivery",
        body: "{{order_id}} is out for delivery. COD {{total}} MAD. Keep your phone on.",
      },
    ],
  });

  await prisma.webhookEndpoint.create({
    data: {
      organizationId: org.id,
      url: "https://example.com/nexora-hooks",
      secret: "whsec_demo",
      events: ["order.created", "order.CONFIRMED", "order.DELIVERED"],
      enabled: false,
    },
  });

  return { orgId: org.id };
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
