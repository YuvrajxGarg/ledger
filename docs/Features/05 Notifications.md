# 05 · Notifications (Email)

All notifications go via **email**. Central module `src/lib/notify.ts` — one function per trigger.
Dev transport = console/preview; prod = SMTP/SES.

## Current recipients
`rishti@revolio.in`, `yuvraj@revolio.in` (testing — remove later). Riya removed.

## Trigger matrix (PRODUCT_BRIEF §7)
1 submit→SrProd · 2 decision→Producer · 3 auto-match→Producer(digest) · 4 validation fail→Producer ·
5 ambiguous→Producer · 6 duplicate→SrProd · 7 reimb submit→SrProd · 8 reimb decision→Producer ·
9 reimb paid→Producer · 10 25th reminder→all · 11 mid-month batch→all producers · 12 dispatch→Accounts+SrProd ·
13 paid→Producer · 14 month-end pending→SrProd escalation.

## Design
Event-driven: each workflow transition calls its `notify*()`. Templated bodies. Adding a trigger = config, not
call-site surgery. Every send logged to `Notification`.
