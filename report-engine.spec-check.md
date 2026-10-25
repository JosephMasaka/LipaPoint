# Report engine safeguards

Keep the gap-analysis workbook (`lipapoint-reports-gap-analysis.xlsx`) authoritative. The spec-check
assertion below is run as the last step of any report consolidation so that workbook drift is caught early.

## Guardrails built into this project

1. **Workbook structure is pinned** — `report-engine.spec-check.js` asserts:
   - Two sheets exist: `Report Status`, `Summary`.
   - The `Report Status` header row matches the expected columns exactly.
   - All 58 required report names are present across the 10 sections.
   - Every status value is one of `Confirmed | Partial | Not Confirmed`.
   - The `Report Status` totals (Confirmed=58, Partial=0, Not Confirmed=0, Total=58) match the `Summary` sheet.
   - The `Summary` section table lists exactly the 10 expected sections and its grand totals match both the
     per-status counts and the sum of section totals.

2. **ERP feature completeness is recorded next to the code that claims it** — the same workbook is the single
   source of truth for report coverage, so any new report endpoint should be reflected there, and any gap closure
   should be reflected back.

3. **Industry-standard report set is not reduced without intent** — the sections in the workbook (Sales,
   Customer, Cash/Bank/Cashier, Stock, Supplier, Finance, Maintenance, Payroll, Asset, eTIMS) match the
   report groups that a Kenyan SMB/ERP is expected to produce. New sections are added only when a real
   module/requirement demands it, never by accident.

## How the comparison was made

1. Read the workbook with `xlsx` and dump `Report Status` and `Summary`.
2. Cross-referenced the `Report Status` list against `lipapoint-reports-spec.md` and the current codebase to
   classify each report as Confirmed / Partial / Not Confirmed.
3. Verified the status totals and section breakdown against the `Summary` sheet.
4. Confirmed the build is clean before treating the workbook as validated.

## Maintenance rules

- Statuses live in `report-engine.reconcile.js`. After a report lands (or a gap closes), update its row there and
  re-run `node report-engine.reconcile.js` to regenerate the workbook, then bump `EXPECTED_SUMMARY_TOTAL_ROWS`
  in `report-engine.spec-check.js` and re-run `node report-engine.spec-check.js`.
- When a report becomes real (route + export + spec match), move it from `Not Confirmed` to `Confirmed` or
  `Partial` in the workbook and re-run `node report-engine.spec-check.js`.
- When a requirement is deferred, keep it in the workbook with the current status and a note; do not delete rows.
- Do not rename or split sections without updating both sheets and re-running the check.

### Status meanings

- **Confirmed** — the report is built: a `ReportDefinition` row plus a registered query, filterable by date range
  and exportable through the shared renderer (`lipapoint-reports-spec.md` §1), with a write path for its data.
- **Partial** — the report is built and exportable, but nothing writes its data yet, so it renders empty.
- **Not Confirmed** — a catalog row exists but returns `501 not_implemented`, blocked on a schema/data-model gap.

As of the last reconciliation every one of the 58 spec reports is **Confirmed**: the two flows that had no writer
(stock transfers, physical stock-take) shipped alongside their reports, which is why the pinned totals are 58/0/0
rather than the earlier 51/2/5.
