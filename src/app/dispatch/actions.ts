"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyDispatch } from "@/lib/notify";
import { BATCH_TYPE_LABEL, type BatchType } from "@/lib/enums";

export async function createDispatch(formData: FormData) {
  const user = await requireUser();
  if (!can(user.role, "dispatch")) return;

  const batchType = String(formData.get("batchType")) as BatchType;
  if (!["MID_MONTH", "MONTH_END"].includes(batchType)) return;
  const notes = (formData.get("notes") as string) || undefined;

  const selected = formData.getAll("sheetIds").map(String).filter(Boolean);
  if (selected.length === 0) return;

  // Only dispatch sheets that are actually APPROVED right now (guards against a
  // stale form / double-submit dispatching something already sent or edited).
  const sheets = await db.closingSheet.findMany({
    where: { id: { in: selected }, status: "APPROVED" },
  });
  if (sheets.length === 0) return;
  const ids = sheets.map((s) => s.id);
  const label = BATCH_TYPE_LABEL[batchType];

  const dispatch = await db.dispatch.create({
    data: {
      batchType,
      triggeredById: user.id,
      includedSheetIds: JSON.stringify(ids),
      notes: notes ?? null,
    },
  });

  await db.closingSheet.updateMany({
    where: { id: { in: ids } },
    data: { status: "DISPATCHED" },
  });

  for (const id of ids) {
    await logAudit({
      entityType: "ClosingSheet",
      entityId: id,
      action: "DISPATCHED",
      actorId: user.id,
      comment: label,
    });
  }
  await logAudit({
    entityType: "Dispatch",
    entityId: dispatch.id,
    action: "DISPATCHED",
    actorId: user.id,
    comment: `${label} · ${ids.length} sheet${ids.length === 1 ? "" : "s"}`,
  });

  await notifyDispatch(label, ids.length, dispatch.id);

  revalidatePath("/dispatch");
  revalidatePath("/closing-sheets");
  revalidatePath("/accounts");
}
