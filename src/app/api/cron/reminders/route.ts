import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyWrapUpReminder, notifyMonthEndEscalation } from "@/lib/notify";

// Cron-triggered reminders (PRODUCT_BRIEF §7 #10, #14). This app has no built-in scheduler,
// so an external cron (Vercel Cron, a system crontab, GitHub Actions, …) should GET this
// route daily, e.g.:  0 9 * * *  curl -H "Authorization: Bearer $CRON_SECRET" \
//   https://<host>/api/cron/reminders
//
// By date it fires:
//   - the 25th        → wrap-up reminder (sheets still DRAFT / CHANGES_REQUESTED)
//   - last day of mo. → escalation (sheets not yet APPROVED/DISPATCHED)
// Pass ?force=wrapup|monthend to run a check regardless of the date (for testing).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const key = req.nextUrl.searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const force = req.nextUrl.searchParams.get("force");
  const now = new Date();
  const day = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const result: Record<string, unknown> = { ranAt: now.toISOString() };

  if (force === "wrapup" || (!force && day === 25)) {
    const pending = await db.closingSheet.findMany({
      where: { status: { in: ["DRAFT", "CHANGES_REQUESTED"] } },
    });
    if (pending.length > 0) await notifyWrapUpReminder(pending.length);
    result.wrapup = { pending: pending.length, sent: pending.length > 0 };
  }

  if (force === "monthend" || (!force && day === lastDay)) {
    const stuck = await db.closingSheet.findMany({
      where: { status: { in: ["DRAFT", "SUBMITTED", "CHANGES_REQUESTED"] } },
      include: { project: true },
    });
    if (stuck.length > 0) await notifyMonthEndEscalation(stuck.map((s) => s.project.name));
    result.monthend = { pending: stuck.length, escalated: stuck.length > 0 };
  }

  return NextResponse.json(result);
}
