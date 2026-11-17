import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runRetentionPolicies } from "@/server/retention-job";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) {
    console.error("[cron:retention] CRON_SECRET não configurado");
    return NextResponse.json({ error: "Cron não configurado." }, { status: 503 });
  }

  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const results = await runRetentionPolicies();
  const deleted = results.reduce((total, r) => total + r.deleted, 0);

  return NextResponse.json({ ok: true, policies: results.length, deleted });
}
