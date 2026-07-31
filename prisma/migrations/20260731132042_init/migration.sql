-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "shootDate" DATETIME,
    "finalBudget" INTEGER NOT NULL DEFAULT 0,
    "producerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClosingSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentRevision" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" DATETIME,
    "decidedAt" DATETIME,
    "decidedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClosingSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClosingSheetLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "closingSheetId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "particulars" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "paidInCash" BOOLEAN NOT NULL DEFAULT false,
    "advance" INTEGER NOT NULL DEFAULT 0,
    "paymentMode" TEXT,
    "notes" TEXT,
    "cleared" TEXT NOT NULL DEFAULT 'NOT_CLEARED',
    "vendorId" TEXT,
    "invoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClosingSheetLine_closingSheetId_fkey" FOREIGN KEY ("closingSheetId") REFERENCES "ClosingSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClosingSheetLine_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pan" TEXT,
    "gstin" TEXT,
    "gstApplicable" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "bankDetails" TEXT,
    "upiId" TEXT,
    "contact" TEXT,
    "poc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "closingSheetId" TEXT NOT NULL,
    "vendorId" TEXT,
    "category" TEXT,
    "projectName" TEXT,
    "shootDate" DATETIME,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "gstin" TEXT,
    "gstApplicable" BOOLEAN NOT NULL DEFAULT true,
    "gstAmount" INTEGER,
    "pan" TEXT,
    "paymentMode" TEXT,
    "upiEligible" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "validationIssues" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "sourceEmailId" TEXT,
    "fileUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_closingSheetId_fkey" FOREIGN KEY ("closingSheetId") REFERENCES "ClosingSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reimbursement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "closingSheetId" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "projectName" TEXT,
    "date" DATETIME,
    "description" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "paymentMode" TEXT NOT NULL DEFAULT 'UPI',
    "receiptUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "decidedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reimbursement_closingSheetId_fkey" FOREIGN KEY ("closingSheetId") REFERENCES "ClosingSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEntry_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LedgerEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dispatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchType" TEXT NOT NULL,
    "triggeredById" TEXT NOT NULL,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "includedSheetIds" TEXT NOT NULL,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_canonicalKey_key" ON "Project"("canonicalKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClosingSheet_projectId_key" ON "ClosingSheet"("projectId");
