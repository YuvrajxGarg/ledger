// App-level enums. SQLite can't store Prisma native enums, so these const objects are the
// single source of truth for the string values used across the DB and UI.

export const Role = {
  PRODUCER: "PRODUCER",
  SENIOR_PRODUCER: "SENIOR_PRODUCER",
  ACCOUNTS: "ACCOUNTS",
  ADMIN: "ADMIN",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ROLE_LABEL: Record<Role, string> = {
  PRODUCER: "Producer",
  SENIOR_PRODUCER: "Senior Producer",
  ACCOUNTS: "Accounts",
  ADMIN: "Admin",
};

export const SheetStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  DISPATCHED: "DISPATCHED",
} as const;
export type SheetStatus = (typeof SheetStatus)[keyof typeof SheetStatus];

export const SHEET_STATUS_LABEL: Record<SheetStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DISPATCHED: "Dispatched",
};

export const Section = {
  PRODUCTION: "PRODUCTION",
  PETTY_CASH: "PETTY_CASH",
} as const;
export type Section = (typeof Section)[keyof typeof Section];

export const SECTION_LABEL: Record<Section, string> = {
  PRODUCTION: "Production Costs",
  PETTY_CASH: "Petty Cash Expenses",
};

export const PaymentMode = {
  NEFT: "NEFT",
  UPI: "UPI",
  REIMBURSEMENT: "REIMBURSEMENT",
  COMPANY_CARD: "COMPANY_CARD",
} as const;
export type PaymentMode = (typeof PaymentMode)[keyof typeof PaymentMode];

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  NEFT: "NEFT",
  UPI: "UPI",
  REIMBURSEMENT: "Reimbursement",
  COMPANY_CARD: "Company Card",
};

export const Cleared = {
  CLEARED: "CLEARED",
  NOT_CLEARED: "NOT_CLEARED",
} as const;
export type Cleared = (typeof Cleared)[keyof typeof Cleared];

export const InvoiceStatus = {
  PENDING: "PENDING",
  VALIDATED: "VALIDATED",
  FLAGGED: "FLAGGED",
  AMBIGUOUS: "AMBIGUOUS",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  PENDING: "Pending",
  VALIDATED: "Validated",
  FLAGGED: "Flagged",
  AMBIGUOUS: "Needs matching",
};

export const ReimbursementStatus = {
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  REJECTED: "REJECTED",
  PAID: "PAID",
} as const;
export type ReimbursementStatus =
  (typeof ReimbursementStatus)[keyof typeof ReimbursementStatus];

export const REIMBURSEMENT_STATUS_LABEL: Record<ReimbursementStatus, string> = {
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  REJECTED: "Rejected",
  PAID: "Paid",
};

// Reimbursements are only ever paid out to the producer directly — UPI or cash.
export const ReimbursementPaymentMode = {
  UPI: "UPI",
  CASH: "CASH",
} as const;
export type ReimbursementPaymentMode =
  (typeof ReimbursementPaymentMode)[keyof typeof ReimbursementPaymentMode];

export const REIMBURSEMENT_PAYMENT_MODE_LABEL: Record<ReimbursementPaymentMode, string> = {
  UPI: "UPI",
  CASH: "Cash",
};

export const LedgerType = {
  ADVANCE: "ADVANCE",
  PARTIAL: "PARTIAL",
  FINAL: "FINAL",
  REIMBURSEMENT: "REIMBURSEMENT",
} as const;
export type LedgerType = (typeof LedgerType)[keyof typeof LedgerType];

export const LEDGER_TYPE_LABEL: Record<LedgerType, string> = {
  ADVANCE: "Advance",
  PARTIAL: "Partial",
  FINAL: "Final",
  REIMBURSEMENT: "Reimbursement",
};

export const BatchType = {
  MID_MONTH: "MID_MONTH",
  MONTH_END: "MONTH_END",
} as const;
export type BatchType = (typeof BatchType)[keyof typeof BatchType];

export const BATCH_TYPE_LABEL: Record<BatchType, string> = {
  MID_MONTH: "Mid-Month Batch",
  MONTH_END: "Month-End Batch",
};

// Invoice categories from the Revolio format (reference/Revolio Invoicing Details.pdf)
export const INVOICE_CATEGORIES = [
  "Catering",
  "Equipment",
  "Acting",
  "Casting",
  "Art",
  "Prop",
  "DOP",
  "Director",
  "HMU",
  "Dressman",
  "Spot",
  "Stylist",
] as const;

// Amounts strictly under this (in paise) are auto UPI-eligible.
export const UPI_LIMIT_PAISE = 5000 * 100;
