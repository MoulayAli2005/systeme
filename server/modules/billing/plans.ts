export const PLANS = {
  FREE: { orders: 100, users: 2, stores: 1, whatsapp: 50, sms: 20, ai: 20, api: 1000 },
  STARTER: { orders: 1500, users: 5, stores: 3, whatsapp: 500, sms: 200, ai: 200, api: 10_000 },
  PRO: { orders: 15_000, users: 25, stores: 15, whatsapp: 5000, sms: 2000, ai: 2000, api: 100_000 },
  BUSINESS: { orders: 50_000, users: 80, stores: 40, whatsapp: 20_000, sms: 8000, ai: 8000, api: 500_000 },
  ENTERPRISE: { orders: -1, users: -1, stores: -1, whatsapp: -1, sms: -1, ai: -1, api: -1 },
} as const;

export type PlanKey = keyof typeof PLANS;
