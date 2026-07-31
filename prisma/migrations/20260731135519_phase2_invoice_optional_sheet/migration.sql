-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "closingSheetId" TEXT,
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
    "sourceSubject" TEXT,
    "matchConfidence" INTEGER,
    "fileUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_closingSheetId_fkey" FOREIGN KEY ("closingSheetId") REFERENCES "ClosingSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("amount", "category", "closingSheetId", "createdAt", "fileUrl", "gstAmount", "gstApplicable", "gstin", "id", "isManual", "matchConfidence", "pan", "paymentMode", "projectName", "shootDate", "sourceEmailId", "sourceSubject", "status", "upiEligible", "validationIssues", "vendorId") SELECT "amount", "category", "closingSheetId", "createdAt", "fileUrl", "gstAmount", "gstApplicable", "gstin", "id", "isManual", "matchConfidence", "pan", "paymentMode", "projectName", "shootDate", "sourceEmailId", "sourceSubject", "status", "upiEligible", "validationIssues", "vendorId" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
