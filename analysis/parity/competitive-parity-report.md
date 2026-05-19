# MasterScript Competitive Parity Matrix

Generated: 2026-04-12T07:27:47.274Z

## Scope

This is the initial implementation slice for parity analysis. It provides a normalized feature matrix and a measurable acceptance specification for each actionable gap.

## Summary

- Total normalized features: 33
- MasterScript present: 12
- MasterScript partial: 3
- MasterScript missing: 18
- Actionable parity gaps: 19
- By-design exclusions: 1

## Domain Status

| Domain | Total | Present | Partial | Missing | Actionable |
|---|---:|---:|---:|---:|---:|
| Budget | 1 | 0 | 0 | 1 | 1 |
| Catalog | 2 | 1 | 0 | 1 | 1 |
| Collaboration | 2 | 0 | 0 | 2 | 2 |
| General | 3 | 0 | 1 | 2 | 2 |
| ImportExport | 5 | 3 | 1 | 1 | 2 |
| Persistence | 2 | 1 | 0 | 1 | 0 |
| Planning | 1 | 1 | 0 | 0 | 0 |
| Production | 4 | 2 | 1 | 1 | 2 |
| Reporting | 2 | 0 | 0 | 2 | 2 |
| Revision | 3 | 1 | 0 | 2 | 2 |
| Storyboard | 1 | 0 | 0 | 1 | 1 |
| Writing | 7 | 3 | 0 | 4 | 4 |

## Canonical Matrix

The machine-readable matrix is available at analysis/parity/parity-matrix.csv and contains one row per feature per product (products x features).

## Actionable Gaps with 10 Measurable Points Each

### collaboration.realtime_coauthoring - Real-time co-authoring

- Domain: Collaboration
- MasterScript status: missing
- Severity: critical
- Confidence: high
- Competitor support: Celtx: supported | Kit Scenarist: supported | Final Draft: supported
- Dependencies: persistence.cloud_sync
- MasterScript evidence:
  - README.md (cloud sync intentionally out of scope)
  - src/types/screenplay.ts (no user/session collaborator model)

Measurable acceptance points:

1. Metric: Real-time co-authoring primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Real-time co-authoring data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Real-time co-authoring input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Real-time co-authoring error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Real-time co-authoring interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Real-time co-authoring accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Real-time co-authoring keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Real-time co-authoring cross-module integration integrity | Threshold: All impacted Collaboration integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Real-time co-authoring test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Real-time co-authoring operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### io.pdf_export - PDF export

- Domain: ImportExport
- MasterScript status: missing
- Severity: critical
- Confidence: high
- Competitor support: Celtx: supported | Kit Scenarist: supported | Final Draft: supported
- Dependencies: writing.page_layout_preview
- MasterScript evidence:
  - package.json (no PDF generation dependency)
  - electron/main.cjs (no PDF export IPC handler)

Measurable acceptance points:

1. Metric: PDF export primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: PDF export data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: PDF export input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: PDF export error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: PDF export interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: PDF export accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: PDF export keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: PDF export cross-module integration integrity | Threshold: All impacted ImportExport integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: PDF export test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: PDF export operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### production.call_sheet_generation - Call sheet generation

- Domain: Production
- MasterScript status: missing
- Severity: critical
- Confidence: high
- Competitor support: Celtx: supported | Kit Scenarist: not_evident | Final Draft: partial
- Dependencies: production.schedule_crud, catalog.auto_detection
- MasterScript evidence:
  - src/types/screenplay.ts (no call sheet model)
  - src/App.tsx (no call sheet generator/export action)

Measurable acceptance points:

1. Metric: Call sheet generation primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Call sheet generation data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Call sheet generation input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Call sheet generation error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Call sheet generation interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Call sheet generation accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Call sheet generation keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Call sheet generation cross-module integration integrity | Threshold: All impacted Production integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Call sheet generation test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Call sheet generation operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### budget.variance_tracking - Estimate versus actual variance tracking

- Domain: Budget
- MasterScript status: missing
- Severity: high
- Confidence: high
- Competitor support: Celtx: supported | Kit Scenarist: not_evident | Final Draft: partial
- Dependencies: production.schedule_crud
- MasterScript evidence:
  - src/types/screenplay.ts (BudgetItem has only category, description, amount)
  - src/App.tsx (budget module totals only)

Measurable acceptance points:

1. Metric: Estimate versus actual variance tracking primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Estimate versus actual variance tracking data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Estimate versus actual variance tracking input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Estimate versus actual variance tracking error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Estimate versus actual variance tracking interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Estimate versus actual variance tracking accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Estimate versus actual variance tracking keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Estimate versus actual variance tracking cross-module integration integrity | Threshold: All impacted Budget integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Estimate versus actual variance tracking test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Estimate versus actual variance tracking operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### collaboration.comments_mentions - Inline comments and mentions

- Domain: Collaboration
- MasterScript status: missing
- Severity: high
- Confidence: high
- Competitor support: Celtx: supported | Kit Scenarist: partial | Final Draft: supported
- Dependencies: collaboration.realtime_coauthoring
- MasterScript evidence:
  - src/types/screenplay.ts (no comment entity)
  - src/App.tsx (no comment UI)

Measurable acceptance points:

1. Metric: Inline comments and mentions primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Inline comments and mentions data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Inline comments and mentions input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Inline comments and mentions error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Inline comments and mentions interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Inline comments and mentions accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Inline comments and mentions keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Inline comments and mentions cross-module integration integrity | Threshold: All impacted Collaboration integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Inline comments and mentions test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Inline comments and mentions operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### io.docx_style_fidelity - DOCX style-fidelity roundtrip

- Domain: ImportExport
- MasterScript status: partial
- Severity: high
- Confidence: high
- Competitor support: Celtx: partial | Kit Scenarist: partial | Final Draft: partial
- Dependencies: io.docx_basic_roundtrip
- MasterScript evidence:
  - src/lib/adapters/docx.ts (normalization to block-level only)
  - src/lib/adapters/normalize.ts (warning-oriented lossy mapping)

Measurable acceptance points:

1. Metric: DOCX style-fidelity roundtrip primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: DOCX style-fidelity roundtrip data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: DOCX style-fidelity roundtrip input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: DOCX style-fidelity roundtrip error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: DOCX style-fidelity roundtrip interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: DOCX style-fidelity roundtrip accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: DOCX style-fidelity roundtrip keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: DOCX style-fidelity roundtrip cross-module integration integrity | Threshold: All impacted ImportExport integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: DOCX style-fidelity roundtrip test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: DOCX style-fidelity roundtrip operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### production.props_equipment_extraction - Automatic props and equipment extraction

- Domain: Production
- MasterScript status: partial
- Severity: high
- Confidence: high
- Competitor support: Celtx: supported | Kit Scenarist: partial | Final Draft: partial
- Dependencies: production.schedule_crud
- MasterScript evidence:
  - src/types/screenplay.ts (BreakdownKind includes prop and equipment)
  - src/lib/screenplay.ts (generateProductionBreakdown currently extracts cast and location only)

Measurable acceptance points:

1. Metric: Automatic props and equipment extraction primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Automatic props and equipment extraction data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Automatic props and equipment extraction input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Automatic props and equipment extraction error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Automatic props and equipment extraction interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Automatic props and equipment extraction accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Automatic props and equipment extraction keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Automatic props and equipment extraction cross-module integration integrity | Threshold: All impacted Production integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Automatic props and equipment extraction test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Automatic props and equipment extraction operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### reporting.analytics_dashboard - Script analytics dashboard

- Domain: Reporting
- MasterScript status: missing
- Severity: high
- Confidence: high
- Competitor support: Celtx: partial | Kit Scenarist: supported | Final Draft: partial
- Dependencies: writing.block_editing
- MasterScript evidence:
  - src/lib/screenplay.ts (basic stats only)
  - src/App.tsx (no dashboard tab)

Measurable acceptance points:

1. Metric: Script analytics dashboard primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Script analytics dashboard data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Script analytics dashboard input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Script analytics dashboard error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Script analytics dashboard interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Script analytics dashboard accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Script analytics dashboard keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Script analytics dashboard cross-module integration integrity | Threshold: All impacted Reporting integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Script analytics dashboard test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Script analytics dashboard operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### reporting.character_dialogue_report - Character and dialogue reports

- Domain: Reporting
- MasterScript status: missing
- Severity: high
- Confidence: medium
- Competitor support: Celtx: partial | Kit Scenarist: partial | Final Draft: supported
- Dependencies: catalog.auto_detection
- MasterScript evidence:
  - src/lib/screenplay.ts (no dialogue report utility)
  - src/App.tsx (no report export action for characters)

Measurable acceptance points:

1. Metric: Character and dialogue reports primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Character and dialogue reports data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Character and dialogue reports input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Character and dialogue reports error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Character and dialogue reports interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Character and dialogue reports accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Character and dialogue reports keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Character and dialogue reports cross-module integration integrity | Threshold: All impacted Reporting integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Character and dialogue reports test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Character and dialogue reports operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### revision.side_by_side_diff - Side-by-side revision diff

- Domain: Revision
- MasterScript status: missing
- Severity: high
- Confidence: high
- Competitor support: Celtx: partial | Kit Scenarist: not_evident | Final Draft: supported
- Dependencies: revision.snapshot_history
- MasterScript evidence:
  - src/App.tsx (single-document view only)
  - src/types/screenplay.ts (no diff snapshot model)

Measurable acceptance points:

1. Metric: Side-by-side revision diff primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Side-by-side revision diff data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Side-by-side revision diff input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Side-by-side revision diff error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Side-by-side revision diff interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Side-by-side revision diff accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Side-by-side revision diff keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Side-by-side revision diff cross-module integration integrity | Threshold: All impacted Revision integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Side-by-side revision diff test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Side-by-side revision diff operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### revision.snapshot_history - Dated revision snapshot history

- Domain: Revision
- MasterScript status: missing
- Severity: high
- Confidence: high
- Competitor support: Celtx: supported | Kit Scenarist: supported | Final Draft: partial
- Dependencies: persistence.local_autosave
- MasterScript evidence:
  - src/App.tsx (undo history only, no persisted snapshots)
  - src/types/screenplay.ts (no snapshot metadata)

Measurable acceptance points:

1. Metric: Dated revision snapshot history primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Dated revision snapshot history data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Dated revision snapshot history input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Dated revision snapshot history error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Dated revision snapshot history interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Dated revision snapshot history accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Dated revision snapshot history keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Dated revision snapshot history cross-module integration integrity | Threshold: All impacted Revision integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Dated revision snapshot history test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Dated revision snapshot history operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### storyboard.image_upload - Storyboard image upload and preview

- Domain: Storyboard
- MasterScript status: missing
- Severity: high
- Confidence: high
- Competitor support: Celtx: supported | Kit Scenarist: partial | Final Draft: supported
- Dependencies: storyboard.panel_crud
- MasterScript evidence:
  - src/types/screenplay.ts (StoryboardPanel has no image field)
  - src/App.tsx (storyboard UI text fields only)

Measurable acceptance points:

1. Metric: Storyboard image upload and preview primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Storyboard image upload and preview data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Storyboard image upload and preview input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Storyboard image upload and preview error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Storyboard image upload and preview interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Storyboard image upload and preview accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Storyboard image upload and preview keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Storyboard image upload and preview cross-module integration integrity | Threshold: All impacted Storyboard integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Storyboard image upload and preview test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Storyboard image upload and preview operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### writing.find_replace - Find and replace

- Domain: Writing
- MasterScript status: missing
- Severity: high
- Confidence: high
- Competitor support: Celtx: supported | Kit Scenarist: supported | Final Draft: supported
- Dependencies: writing.command_palette
- MasterScript evidence:
  - src/components/CommandPalette.tsx (search only, no replace)
  - src/App.tsx (no replace action path)

Measurable acceptance points:

1. Metric: Find and replace primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Find and replace data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Find and replace input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Find and replace error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Find and replace interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Find and replace accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Find and replace keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Find and replace cross-module integration integrity | Threshold: All impacted Writing integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Find and replace test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Find and replace operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### writing.page_layout_preview - Page-aware screenplay preview

- Domain: Writing
- MasterScript status: missing
- Severity: high
- Confidence: high
- Competitor support: Celtx: supported | Kit Scenarist: supported | Final Draft: supported
- Dependencies: writing.block_editing
- MasterScript evidence:
  - src/App.tsx (single-column editor rendering)
  - src/components (no page preview component)

Measurable acceptance points:

1. Metric: Page-aware screenplay preview primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Page-aware screenplay preview data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Page-aware screenplay preview input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Page-aware screenplay preview error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Page-aware screenplay preview interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Page-aware screenplay preview accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Page-aware screenplay preview keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Page-aware screenplay preview cross-module integration integrity | Threshold: All impacted Writing integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Page-aware screenplay preview test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Page-aware screenplay preview operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### writing.scene_numbering - Automatic scene numbering

- Domain: Writing
- MasterScript status: missing
- Severity: high
- Confidence: medium
- Competitor support: Celtx: supported | Kit Scenarist: partial | Final Draft: supported
- Dependencies: writing.block_editing
- MasterScript evidence:
  - src/types/screenplay.ts (SceneSummary has no persistent number)
  - src/lib/screenplay.ts (extractScenes without scene index persistence)

Measurable acceptance points:

1. Metric: Automatic scene numbering primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Automatic scene numbering data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Automatic scene numbering input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Automatic scene numbering error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Automatic scene numbering interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Automatic scene numbering accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Automatic scene numbering keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Automatic scene numbering cross-module integration integrity | Threshold: All impacted Writing integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Automatic scene numbering test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Automatic scene numbering operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### catalog.character_profiles - Character profiles with attributes

- Domain: Catalog
- MasterScript status: missing
- Severity: medium
- Confidence: high
- Competitor support: Celtx: supported | Kit Scenarist: supported | Final Draft: partial
- Dependencies: catalog.auto_detection
- MasterScript evidence:
  - src/types/screenplay.ts (CatalogEntry has only kind, name, notes)
  - src/App.tsx (catalog table has no structured profile fields)

Measurable acceptance points:

1. Metric: Character profiles with attributes primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Character profiles with attributes data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Character profiles with attributes input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Character profiles with attributes error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Character profiles with attributes interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Character profiles with attributes accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Character profiles with attributes keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Character profiles with attributes cross-module integration integrity | Threshold: All impacted Catalog integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Character profiles with attributes test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Character profiles with attributes operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### general.scene_tagging - Scene tagging and filters

- Domain: General
- MasterScript status: missing
- Severity: medium
- Confidence: medium
- Competitor support: Celtx: supported | Kit Scenarist: partial | Final Draft: supported
- Dependencies: writing.scene_numbering
- MasterScript evidence:
  - src/types/screenplay.ts (no scene tag model)
  - src/App.tsx (no scene filter by custom tags)

Measurable acceptance points:

1. Metric: Scene tagging and filters primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Scene tagging and filters data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Scene tagging and filters input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Scene tagging and filters error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Scene tagging and filters interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Scene tagging and filters accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Scene tagging and filters keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Scene tagging and filters cross-module integration integrity | Threshold: All impacted General integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Scene tagging and filters test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Scene tagging and filters operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### writing.character_autocomplete - Character autocomplete from cast list

- Domain: Writing
- MasterScript status: missing
- Severity: medium
- Confidence: medium
- Competitor support: Celtx: partial | Kit Scenarist: partial | Final Draft: supported
- Dependencies: catalog.auto_detection
- MasterScript evidence:
  - src/App.tsx (character block editing has no suggestion source)

Measurable acceptance points:

1. Metric: Character autocomplete from cast list primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Character autocomplete from cast list data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Character autocomplete from cast list input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Character autocomplete from cast list error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Character autocomplete from cast list interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Character autocomplete from cast list accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Character autocomplete from cast list keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Character autocomplete from cast list cross-module integration integrity | Threshold: All impacted Writing integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Character autocomplete from cast list test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Character autocomplete from cast list operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

### general.light_theme_toggle - Light and dark theme toggle

- Domain: General
- MasterScript status: partial
- Severity: low
- Confidence: high
- Competitor support: Celtx: supported | Kit Scenarist: supported | Final Draft: supported
- Dependencies: none
- MasterScript evidence:
  - src/index.css and src/App.css (single cinematic dark styling path)
  - src/App.tsx (no theme preference control)

Measurable acceptance points:

1. Metric: Light and dark theme toggle primary workflow completion rate | Threshold: >= 95% success across 20 representative runs | Validation: Scripted integration test plus manual validation pack | Pass condition: At least 19 of 20 runs complete without blockers
2. Metric: Light and dark theme toggle data persistence consistency | Threshold: 100% state retention across 50 save and reload cycles | Validation: Automated persistence regression suite | Pass condition: No data loss or corruption in any cycle
3. Metric: Light and dark theme toggle input validation coverage | Threshold: 100% rejection of invalid required-field combinations | Validation: Negative-path unit and UI tests | Pass condition: All invalid payloads rejected with actionable messages
4. Metric: Light and dark theme toggle error containment | Threshold: 0 uncaught exceptions across 200 stress operations | Validation: Soak test with error telemetry assertions | Pass condition: No renderer or process crash in stress run
5. Metric: Light and dark theme toggle interaction latency (p95) | Threshold: <= 150 ms for user-triggered operations | Validation: Performance harness in desktop and browser fallback modes | Pass condition: p95 latency remains within target envelope
6. Metric: Light and dark theme toggle accessibility quality | Threshold: 0 critical WCAG 2.2 AA violations on feature surfaces | Validation: Automated axe checks plus keyboard-only QA | Pass condition: No blocking accessibility defects remain open
7. Metric: Light and dark theme toggle keyboard and navigation efficiency | Threshold: 100% core actions operable without mouse | Validation: Keyboard path conformance checklist | Pass condition: All required actions mapped and operable by shortcut or tab flow
8. Metric: Light and dark theme toggle cross-module integration integrity | Threshold: All impacted General integrations pass regression tests | Validation: Targeted regression matrix for upstream and downstream modules | Pass condition: No integration regressions introduced in dependent modules
9. Metric: Light and dark theme toggle test coverage uplift | Threshold: >= 90% line coverage in touched modules and >= 10 scenario tests | Validation: Coverage report plus scenario test run | Pass condition: Coverage threshold and scenario count both satisfied
10. Metric: Light and dark theme toggle operational readiness | Threshold: User docs, release notes, and troubleshooting updated before ship | Validation: Documentation QA and release checklist | Pass condition: All release checklist items marked complete

## Non-Actionable Features in This Slice

These features are tracked in the matrix but do not receive measurable-point expansion in this run because they are already present, intentionally out-of-scope, or not evidenced as competitor parity requirements.

- catalog.auto_detection (Automatic character and location detection) - already present
- general.plugin_system (Plugin and extension system) - insufficient competitor parity evidence
- io.docx_basic_roundtrip (Basic DOCX import and export) - already present
- io.fdx_basic_roundtrip (Basic FDX import and export) - already present
- io.fountain_export (Fountain export) - already present
- persistence.cloud_sync (Cloud sync and multi-device continuity) - by-design exclusion
- persistence.local_autosave (Local autosave and restore) - already present
- planning.story_templates (Story structure templates) - already present
- production.day_out_of_days (Day-out-of-days report generation) - already present
- production.schedule_crud (Production schedule CRUD) - already present
- revision.color_marks (Revision color markings) - already present
- writing.block_editing (Block-based screenplay editing) - already present
- writing.command_palette (Cross-module command palette) - already present
- writing.undo_redo (Undo and redo history) - already present

