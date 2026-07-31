import { Badge, type Tone } from "./ui";
import {
  SHEET_STATUS_LABEL,
  REIMBURSEMENT_STATUS_LABEL,
  type SheetStatus,
  type InvoiceStatus,
  type ReimbursementStatus,
} from "@/lib/enums";

const sheetTone: Record<SheetStatus, Tone> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  CHANGES_REQUESTED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  DISPATCHED: "accent",
};

export function SheetStatusBadge({ status }: { status: string }) {
  const s = status as SheetStatus;
  return <Badge tone={sheetTone[s] ?? "neutral"}>{SHEET_STATUS_LABEL[s] ?? status}</Badge>;
}

const invoiceTone: Record<InvoiceStatus, Tone> = {
  PENDING: "neutral",
  VALIDATED: "success",
  FLAGGED: "danger",
  AMBIGUOUS: "warning",
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  const s = status as InvoiceStatus;
  return <Badge tone={invoiceTone[s] ?? "neutral"}>{s?.toLowerCase?.() ?? status}</Badge>;
}

const reimbTone: Record<ReimbursementStatus, Tone> = {
  SUBMITTED: "info",
  APPROVED: "success",
  CHANGES_REQUESTED: "warning",
  REJECTED: "danger",
  PAID: "accent",
};

export function ReimbursementStatusBadge({ status }: { status: string }) {
  const s = status as ReimbursementStatus;
  return (
    <Badge tone={reimbTone[s] ?? "neutral"}>
      {REIMBURSEMENT_STATUS_LABEL[s] ?? status}
    </Badge>
  );
}
