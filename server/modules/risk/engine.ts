export type RiskInputs = {
  totalOrders: number;
  cancelled: number;
  returned: number;
  refused: number;
  uniquePhones: number;
  uniqueAddresses: number;
  velocity24h: number;
};

export type RiskResult = {
  score: number;
  label: "reliable" | "normal" | "risky" | "high_risk";
  requireManualVerification: boolean;
  factors: string[];
};

export function scoreRisk(input: RiskInputs): RiskResult {
  const factors: string[] = [];
  let score = 8;

  const cancelRate = input.totalOrders ? input.cancelled / input.totalOrders : 0;
  const returnRate = input.totalOrders ? input.returned / input.totalOrders : 0;

  if (cancelRate >= 0.4) {
    score += 32;
    factors.push("high_cancellation_history");
  } else if (cancelRate >= 0.2) {
    score += 16;
    factors.push("elevated_cancellation_history");
  }

  if (returnRate >= 0.3) {
    score += 24;
    factors.push("high_return_history");
  } else if (returnRate >= 0.15) {
    score += 12;
    factors.push("elevated_return_history");
  }

  if (input.refused > 0) {
    score += Math.min(20, input.refused * 8);
    factors.push("previous_refused_deliveries");
  }

  if (input.uniquePhones >= 3) {
    score += 10;
    factors.push("multiple_phone_numbers");
  }

  if (input.uniqueAddresses >= 4) {
    score += 8;
    factors.push("multiple_addresses");
  }

  if (input.velocity24h >= 4) {
    score += 22;
    factors.push("suspicious_order_velocity");
  } else if (input.velocity24h >= 2) {
    score += 10;
    factors.push("repeated_cod_orders");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label =
    score >= 80 ? "high_risk" : score >= 55 ? "risky" : score >= 25 ? "normal" : "reliable";

  return {
    score,
    label,
    requireManualVerification: score > 80,
    factors,
  };
}

export type ConditionOrder = {
  total: unknown;
  paymentMethod: string;
  status: string;
  callAttempts: number;
  city?: string;
  source?: string;
  tags?: string[];
  riskScore?: number;
};

export function matchConditions(
  conditions: Record<string, unknown>,
  order: ConditionOrder,
  payload: Record<string, unknown> = {},
) {
  if (conditions.status && conditions.status !== (payload.status ?? order.status)) return false;
  if (conditions.paymentMethod && conditions.paymentMethod !== order.paymentMethod) return false;
  if (typeof conditions.minTotal === "number" && Number(order.total) < conditions.minTotal) return false;
  if (typeof conditions.maxTotal === "number" && Number(order.total) > conditions.maxTotal) return false;
  if (typeof conditions.minCallAttempts === "number" && order.callAttempts < conditions.minCallAttempts) {
    return false;
  }
  if (conditions.city) {
    const city = (order.city ?? "").trim().toLowerCase();
    if (city !== String(conditions.city).trim().toLowerCase()) return false;
  }
  if (conditions.source && conditions.source !== order.source) return false;
  if (conditions.hasTag && !(order.tags ?? []).includes(String(conditions.hasTag))) return false;
  if (typeof conditions.minRiskScore === "number" && (order.riskScore ?? 0) < conditions.minRiskScore) {
    return false;
  }
  return true;
}
