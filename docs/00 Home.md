# 🎬 Revolio Accounting Automation — Vault Home

Map of Content (MOC) for the project. This vault is the long-term brain; [[../CLAUDE|CLAUDE.md]] is the fast-start.

## Start here
- [[Project Brief]] — what we're building and why
- [[Architecture]] — how the system is put together
- [[Structure]] — folder & file layout
- [[Data Model]] — entities and relationships
- [[Roadmap]] — phases & what's shipped

## Working notes (keep these alive)
- [[Decisions]] — ADR log (why we chose things)
- [[Learnings]] — non-obvious things discovered along the way
- [[Errors]] — bugs hit + fixes (so we don't repeat them)
- [[Conventions]] — code & naming rules
- [[Session Log]] — per-session handoff (what shipped, what's next) ← **resume here**

## Features
- [[Features/00 Features Index|Features Index]]

## Reference material
- `reference/Revolio Invoicing Details.pdf` — vendor invoice format (validation source of truth)
- `reference/Closing Sheet - District Manifesto.pdf` — closing sheet format

## Key facts
- **Client:** Revolio Media Pvt Ltd · GST `27AALCR9287L1ZC` · Bandra West, Mumbai
- **Why now:** Riya (previous PoC) has left; manual process broke → automating it
- **Notification recipients (current):** `rishti@revolio.in`, `yuvraj@revolio.in` (testing, remove later)
- **No TDS.** GST retained (calc rules TBD with accounts).
- **LLM brain:** muapi.ai (Claude API)
