# Project Brief

Short version. The canonical, exhaustive spec is [[../PRODUCT_BRIEF|PRODUCT_BRIEF.md]] at the repo root.

## Problem
Post-shoot, a producer collects invoices from vendors (equipment, DOP, spot, catering…), reconciles them on a
**closing sheet**, gets sign-off, and hands everything to accounts for payment. Today this is manual email +
spreadsheets. The PoC who ran it (Riya) has left. We're replacing the process with software.

## The core loop
1. Producer creates a **[[Features/01 Closing Sheet|closing sheet]]** per project (shoot name, date, budget).
2. App **[[Features/02 Invoice Collection|scans Gmail]]** and auto-attaches matching invoices.
3. App **[[Features/03 Validation Engine|validates]]** each invoice (GST, PAN, payment mode, cross-checks).
4. Producer submits → **[[Features/04 Approval Workflow|Senior Producer approves]]** (unlimited revisions).
5. Senior Producer **[[Features/07 Accounts Dispatch|dispatches]]** approved sheets to accounts (mid-month / month-end).
6. Accounts marks **[[Features/08 Payment Loop|paid]]** → producer notified.

## Roles
Producer · Senior Producer · Accounts (view + mark paid, no edit) · Admin (config + users).
See [[Data Model]] for the enum.

## Cross-cutting
- **[[Features/05 Notifications|Email notifications]]** on every workflow event (trigger matrix in PRODUCT_BRIEF §7).
- **[[Features/06 Search and Filter|Search & filter]]** across all entities.
- **[[Features/09 Vendor Registry|Vendor registry]]** accumulates from day one; reminder automation is Phase 2.
- **Audit trail** on every action.
