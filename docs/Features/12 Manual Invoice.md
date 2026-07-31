# 12 · Manual Invoice Generator

For daily-wage vendors who can't generate their own invoices.

## Fields
Name · amount · date · nature of work · project name · payment mode.

## Output
Clean PDF, auto-attached to the closing sheet as an `Invoice` with `isManual = true`.

## Note
- **No signature field** — confirmed not required (removed from original brief).
- PDF generated in `src/lib/pdf/`.
