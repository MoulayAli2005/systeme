import { sha256 } from "./crypto";

/**
 * Behind Railway/most proxies the socket address is the edge, so the first
 * `x-forwarded-for` hop is the closest thing to a client address we have.
 */
export function clientIp(req: { headers: Headers }) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}

/**
 * A rate-limit subject that does not require a database round trip. Callers
 * sharing one office IP still get individual budgets when they are signed in,
 * and the raw credential never reaches Redis.
 */
export function identityKey(req: { headers: Headers }) {
  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const apiKey = req.headers.get("x-api-key");
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("nexora_session="))
    ?.slice("nexora_session=".length);

  const credential = bearer || apiKey || cookie;
  if (credential) return `sub:${sha256(decodeURIComponent(credential)).slice(0, 24)}`;
  return `ip:${clientIp(req)}`;
}

