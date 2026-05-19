import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const parityDir = path.join(root, "analysis", "parity");
const dataPath = path.join(parityDir, "parity-data.json");
const csvOutPath = path.join(parityDir, "parity-matrix.csv");
const mdOutPath = path.join(parityDir, "competitive-parity-report.md");

const severityOrder = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

const statusGapMap = {
  present: "none",
  partial: "incomplete",
  missing: "missing",
};

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const features = data.features;
const productKeys = data.metadata.productKeys;
const productLabels = data.metadata.productLabels;

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes("\"")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function summarizeSupport(competitorSupport) {
  return productKeys
    .map((k) => `${productLabels[k]}: ${competitorSupport[k]}`)
    .join(" | ");
}

function isActionable(feature) {
  if (feature.byDesign) {
    return false;
  }

  if (feature.masterscriptStatus === "present") {
    return false;
  }

  return productKeys.some((key) => {
    const status = feature.competitorSupport[key];
    return status === "supported" || status === "partial";
  });
}

function createCriteria(feature) {
  const name = feature.name;
  const domain = feature.domain;

  return [
    {
      metric: `${name} primary workflow completion rate`,
      threshold: ">= 95% success across 20 representative runs",
      validation: "Scripted integration test plus manual validation pack",
      pass: "At least 19 of 20 runs complete without blockers",
    },
    {
      metric: `${name} data persistence consistency`,
      threshold: "100% state retention across 50 save and reload cycles",
      validation: "Automated persistence regression suite",
      pass: "No data loss or corruption in any cycle",
    },
    {
      metric: `${name} input validation coverage`,
      threshold: "100% rejection of invalid required-field combinations",
      validation: "Negative-path unit and UI tests",
      pass: "All invalid payloads rejected with actionable messages",
    },
    {
      metric: `${name} error containment`,
      threshold: "0 uncaught exceptions across 200 stress operations",
      validation: "Soak test with error telemetry assertions",
      pass: "No renderer or process crash in stress run",
    },
    {
      metric: `${name} interaction latency (p95)`,
      threshold: "<= 150 ms for user-triggered operations",
      validation: "Performance harness in desktop and browser fallback modes",
      pass: "p95 latency remains within target envelope",
    },
    {
      metric: `${name} accessibility quality`,
      threshold: "0 critical WCAG 2.2 AA violations on feature surfaces",
      validation: "Automated axe checks plus keyboard-only QA",
      pass: "No blocking accessibility defects remain open",
    },
    {
      metric: `${name} keyboard and navigation efficiency`,
      threshold: "100% core actions operable without mouse",
      validation: "Keyboard path conformance checklist",
      pass: "All required actions mapped and operable by shortcut or tab flow",
    },
    {
      metric: `${name} cross-module integration integrity`,
      threshold: `All impacted ${domain} integrations pass regression tests`,
      validation: "Targeted regression matrix for upstream and downstream modules",
      pass: "No integration regressions introduced in dependent modules",
    },
    {
      metric: `${name} test coverage uplift`,
      threshold: ">= 90% line coverage in touched modules and >= 10 scenario tests",
      validation: "Coverage report plus scenario test run",
      pass: "Coverage threshold and scenario count both satisfied",
    },
    {
      metric: `${name} operational readiness`,
      threshold: "User docs, release notes, and troubleshooting updated before ship",
      validation: "Documentation QA and release checklist",
      pass: "All release checklist items marked complete",
    },
  ];
}

const actionableFeatures = features.filter(isActionable);
const sortedActionable = [...actionableFeatures].sort((a, b) => {
  const severityDelta = severityOrder[a.gapSeverity] - severityOrder[b.gapSeverity];
  if (severityDelta !== 0) {
    return severityDelta;
  }

  return a.id.localeCompare(b.id);
});

const csvHeaders = [
  "domain",
  "feature_id",
  "feature_name",
  "product",
  "support_status",
  "masterscript_status",
  "gap_type",
  "severity",
  "confidence",
  "actionable_gap",
  "by_design",
  "dependency",
  "evidence_source",
  "evidence_note",
  "measurable_points_count",
];

const csvRows = [csvHeaders.join(",")];

for (const feature of features) {
  const featureActionable = isActionable(feature);

  for (const key of productKeys) {
    const evidenceSources = feature.competitorEvidence?.[key] ?? data.metadata.productEvidenceDefaults[key] ?? [];

    const row = [
      feature.domain,
      feature.id,
      feature.name,
      productLabels[key],
      feature.competitorSupport[key],
      feature.masterscriptStatus,
      feature.byDesign ? "by_design" : statusGapMap[feature.masterscriptStatus],
      feature.gapSeverity,
      feature.confidence,
      featureActionable ? "true" : "false",
      feature.byDesign ? "true" : "false",
      (feature.dependencies ?? []).join("|"),
      evidenceSources.join("; "),
      (feature.masterEvidence ?? []).join(" | "),
      featureActionable ? "10" : "0",
    ];

    csvRows.push(row.map(csvEscape).join(","));
  }
}

const totals = {
  all: features.length,
  present: features.filter((f) => f.masterscriptStatus === "present").length,
  partial: features.filter((f) => f.masterscriptStatus === "partial").length,
  missing: features.filter((f) => f.masterscriptStatus === "missing").length,
  actionable: actionableFeatures.length,
  byDesign: features.filter((f) => f.byDesign).length,
};

const domainCounts = new Map();
for (const feature of features) {
  const current = domainCounts.get(feature.domain) ?? {
    total: 0,
    present: 0,
    partial: 0,
    missing: 0,
    actionable: 0,
  };

  current.total += 1;
  current[feature.masterscriptStatus] += 1;
  if (isActionable(feature)) {
    current.actionable += 1;
  }

  domainCounts.set(feature.domain, current);
}

const now = new Date().toISOString();

let md = "";
md += `# ${data.metadata.title}\n\n`;
md += `Generated: ${now}\n\n`;
md += "## Scope\n\n";
md += "This is the initial implementation slice for parity analysis. It provides a normalized feature matrix and a measurable acceptance specification for each actionable gap.\n\n";

md += "## Summary\n\n";
md += `- Total normalized features: ${totals.all}\n`;
md += `- MasterScript present: ${totals.present}\n`;
md += `- MasterScript partial: ${totals.partial}\n`;
md += `- MasterScript missing: ${totals.missing}\n`;
md += `- Actionable parity gaps: ${totals.actionable}\n`;
md += `- By-design exclusions: ${totals.byDesign}\n\n`;

md += "## Domain Status\n\n";
md += "| Domain | Total | Present | Partial | Missing | Actionable |\n";
md += "|---|---:|---:|---:|---:|---:|\n";

for (const [domain, count] of [...domainCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  md += `| ${domain} | ${count.total} | ${count.present} | ${count.partial} | ${count.missing} | ${count.actionable} |\n`;
}

md += "\n## Canonical Matrix\n\n";
md += `The machine-readable matrix is available at analysis/parity/parity-matrix.csv and contains one row per feature per product (products x features).\n\n`;

md += "## Actionable Gaps with 10 Measurable Points Each\n\n";

for (const feature of sortedActionable) {
  const criteria = createCriteria(feature);

  md += `### ${feature.id} - ${feature.name}\n\n`;
  md += `- Domain: ${feature.domain}\n`;
  md += `- MasterScript status: ${feature.masterscriptStatus}\n`;
  md += `- Severity: ${feature.gapSeverity}\n`;
  md += `- Confidence: ${feature.confidence}\n`;
  md += `- Competitor support: ${summarizeSupport(feature.competitorSupport)}\n`;
  md += `- Dependencies: ${(feature.dependencies ?? []).length ? feature.dependencies.join(", ") : "none"}\n`;
  md += "- MasterScript evidence:\n";

  for (const ev of feature.masterEvidence ?? []) {
    md += `  - ${ev}\n`;
  }

  md += "\nMeasurable acceptance points:\n\n";

  criteria.forEach((item, index) => {
    md += `${index + 1}. Metric: ${item.metric} | Threshold: ${item.threshold} | Validation: ${item.validation} | Pass condition: ${item.pass}\n`;
  });

  md += "\n";
}

const excludedFeatures = features.filter((f) => !isActionable(f));
if (excludedFeatures.length > 0) {
  md += "## Non-Actionable Features in This Slice\n\n";
  md += "These features are tracked in the matrix but do not receive measurable-point expansion in this run because they are already present, intentionally out-of-scope, or not evidenced as competitor parity requirements.\n\n";

  for (const feature of excludedFeatures.sort((a, b) => a.id.localeCompare(b.id))) {
    const reason = feature.byDesign
      ? "by-design exclusion"
      : feature.masterscriptStatus === "present"
        ? "already present"
        : "insufficient competitor parity evidence";

    md += `- ${feature.id} (${feature.name}) - ${reason}\n`;
  }

  md += "\n";
}

fs.writeFileSync(csvOutPath, `${csvRows.join("\n")}\n`, "utf8");
fs.writeFileSync(mdOutPath, md, "utf8");

console.log(`Wrote ${csvOutPath}`);
console.log(`Wrote ${mdOutPath}`);
console.log(`Actionable gaps expanded: ${sortedActionable.length}`);
