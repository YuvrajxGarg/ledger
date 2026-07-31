import { PrismaClient } from "@prisma/client";
import { toPaise } from "../src/lib/money";

const db = new PrismaClient();

const R = (rupees: number) => toPaise(rupees);

async function main() {
  // --- Users (all four roles) ---
  const [admin, rishti, aditya, neha, accounts] = await Promise.all([
    db.user.upsert({
      where: { email: "yuvraj@revolio.in" },
      update: {},
      create: { name: "Yuvraj (you)", email: "yuvraj@revolio.in", role: "ADMIN" },
    }),
    db.user.upsert({
      where: { email: "rishti@revolio.in" },
      update: {},
      create: { name: "Rishti", email: "rishti@revolio.in", role: "SENIOR_PRODUCER" },
    }),
    db.user.upsert({
      where: { email: "aditya@revolio.in" },
      update: {},
      create: { name: "Aditya", email: "aditya@revolio.in", role: "PRODUCER" },
    }),
    db.user.upsert({
      where: { email: "neha@revolio.in" },
      update: {},
      create: { name: "Neha", email: "neha@revolio.in", role: "PRODUCER" },
    }),
    db.user.upsert({
      where: { email: "accounts@revolio.in" },
      update: {},
      create: { name: "Accounts Team", email: "accounts@revolio.in", role: "ACCOUNTS" },
    }),
  ]);

  // --- Vendors (a few, from the real sheet) ---
  const hsMedia = await db.vendor.upsert({
    where: { id: "seed-hsmedia" },
    update: {},
    create: {
      id: "seed-hsmedia",
      name: "HS Media",
      category: "Equipment",
      pan: "AAECH1234K",
      gstin: "27AAECH1234K1ZP",
      gstApplicable: true,
      contact: "98200 00001",
    },
  });
  const kgn = await db.vendor.upsert({
    where: { id: "seed-kgn" },
    update: {},
    create: { id: "seed-kgn", name: "KGN", category: "Prop", gstApplicable: false },
  });

  // --- Project + Closing Sheet: "District Manifesto" (the real reference sheet) ---
  const project = await db.project.upsert({
    where: { canonicalKey: "district-manifesto" },
    update: {},
    create: {
      name: "District Culture | Manifesto",
      canonicalKey: "district-manifesto",
      shootDate: new Date("2026-07-20"),
      finalBudget: R(80000),
      producerId: aditya.id,
    },
  });

  const existing = await db.closingSheet.findUnique({ where: { projectId: project.id } });
  if (!existing) {
    await db.closingSheet.create({
      data: {
        projectId: project.id,
        status: "SUBMITTED",
        submittedAt: new Date(),
        lines: {
          create: [
            { section: "PRODUCTION", name: "Hrishi Raj Sureka", particulars: "DOP", amount: R(10000), paymentMode: "NEFT" },
            { section: "PRODUCTION", name: "Kumeil", particulars: "Extra", amount: R(28500), paymentMode: "NEFT" },
            { section: "PRODUCTION", name: "Chandan", particulars: "Spot", amount: R(2000), paymentMode: "UPI" },
            { section: "PRODUCTION", name: "Rupesh", particulars: "Setting", amount: R(15000), paymentMode: "NEFT" },
            { section: "PRODUCTION", name: "HS Media", particulars: "Equipment", amount: R(20000), paymentMode: "NEFT", vendorId: hsMedia.id },
            { section: "PETTY_CASH", name: "KGN", particulars: "Props", amount: R(20000), paidInCash: true, paymentMode: "COMPANY_CARD", vendorId: kgn.id },
            { section: "PETTY_CASH", name: "Radhika Swiggy", particulars: "Food & refreshments", amount: R(3200), paidInCash: true, paymentMode: "COMPANY_CARD", notes: "company card" },
          ],
        },
      },
    });
  }

  // --- A second, empty draft for variety ---
  const proj2 = await db.project.upsert({
    where: { canonicalKey: "superyou-ipl-asset" },
    update: {},
    create: {
      name: "Superyou IPL Asset",
      canonicalKey: "superyou-ipl-asset",
      shootDate: new Date("2026-07-28"),
      finalBudget: R(120000),
      producerId: neha.id,
    },
  });
  const existing2 = await db.closingSheet.findUnique({ where: { projectId: proj2.id } });
  if (!existing2) {
    await db.closingSheet.create({ data: { projectId: proj2.id, status: "DRAFT" } });
  }

  // eslint-disable-next-line no-console
  console.log("Seeded:", {
    users: [admin.email, rishti.email, aditya.email, neha.email, accounts.email],
    projects: [project.name, proj2.name],
  });
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
