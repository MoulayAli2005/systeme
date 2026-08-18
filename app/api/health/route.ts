import { json } from "@/server/http";
import { health } from "@/server/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await health();
  return json(result, result.ok ? 200 : 503);
}
