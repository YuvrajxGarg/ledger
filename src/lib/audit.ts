import { db } from "./db";

/** Write an audit-trail row. Call on every workflow state change. */
export async function logAudit(params: {
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  comment?: string;
}) {
  await db.auditLog.create({ data: params });
}
