# 02 · Invoice Collection (Gmail)  — Phase 2

## What
Connect each producer's Gmail via OAuth (read-only), scan for invoice attachments, auto-attach to the right
closing sheet.

## Matching (primary → fallback)
1. Parse the Revolio subject/filename convention `<Category>_Invoice_<Project>_<Month Year>` → map Project via
   its `canonicalKey`. (See [[../Learnings]].)
2. Fallback: client name + shoot name in subject/body.
3. LLM assist (muapi.ai) for fuzzy cases.

## Ambiguity
Multiple/revised invoices with similar names or amounts → mark `AMBIGUOUS`, notify producer (§7 #5) to pick one.

## Dependencies
Google Cloud OAuth creds (user-supplied). Gmail read scope. Real login = [[04 Approval Workflow]] auth swap.

## Notes
Riya's inbox was the old collection point; now each producer has their own email — may still want a shared
`accounts@`/`rishti@` inbox as a source. Open item.
