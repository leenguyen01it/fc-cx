import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ingestTransfer } from "@/lib/ingest";
import { sepaySchema } from "@/lib/schemas";

/**
 * Webhook SePay (https://docs.sepay.vn): cấu hình URL
 *   https://<domain>/api/webhook/sepay
 * kiểu chứng thực "API Key" = WEBHOOK_API_KEY → SePay gửi header "Authorization: Apikey <key>".
 */

function authorized(req: Request) {
  const key = process.env.WEBHOOK_API_KEY;
  if (!key) return false;
  const header = req.headers.get("authorization") ?? "";
  const got = header.replace(/^(Apikey|Bearer)\s+/i, "").trim();
  const a = Buffer.from(got);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseVnDate(s?: string) {
  if (s && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s.replace(" ", "T") + "+07:00");
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ success: false, error: "unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ success: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = sepaySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ success: false, error: "invalid payload", issues: parsed.error.issues.length }, { status: 400 });
  }
  const body = parsed.data;
  if (body.transferType !== "in") return Response.json({ success: true, status: "skipped" });

  const result = await ingestTransfer({
    externalId: `sepay:${body.id}`,
    amount: body.transferAmount,
    content: body.content || body.description || "",
    occurredAt: parseVnDate(body.transactionDate),
  });

  if (result.status === "matched" || result.status === "pending") revalidatePath("/", "layout");
  return Response.json({ success: true, ...result });
}
