import { readFileSync } from "node:fs";

import { Step4PublicationError } from "./publication-receipt.mjs";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function literal(value) {
  return value === null ? "null" : typeof value === "string" ? value : canonicalJson(value);
}

function section(label, value) {
  return `- ${label}: ${literal(value)}`;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderFormulaDecisionMarkdown(decision, evaluation) {
  const lines = ["# Formula decision", "", section("Decision ID", decision.decision_id), section("Status", decision.status), section("Winner", decision.winner), section("Cohort ID", decision.cohort_id), section("Cohort basis", decision.cohort_basis), section("Rubric SHA-256", decision.rubric_sha256), section("FD action", decision.fd_action), section("Attestation ID", decision.linear_attestation_id), section("Attestation SHA-256", decision.linear_attestation_sha256), "", "## Evaluation", "", section("Evaluation ID", evaluation.evaluation_id), section("Decision SHA-256", evaluation.decision_sha256), section("Outcome code", evaluation.outcome_code), "", "## Matrix cells", ""];
  for (const cell of evaluation.matrix_cells) lines.push(`- ${canonicalJson(cell)}`);
  lines.push("", "## Candidate reviews", "");
  for (const review of evaluation.candidate_reviews) lines.push(`- ${canonicalJson(review)}`);
  lines.push("", "## Sensitivity vectors", "");
  for (const vector of evaluation.sensitivity.vectors) lines.push(`- ${canonicalJson(vector)}`);
  return `${lines.join("\n")}\n`;
}

export function renderEvidenceLogMarkdown(evidenceLog) {
  const lines = ["# Evidence log", "", `- Cohort ID: ${evidenceLog.cohort_id}`, "", "## Entries", ""];
  for (const entry of evidenceLog.entries) {
    lines.push(`- Record ID: ${entry.record_id}`, `  - Candidate: ${entry.candidate}`, `  - Fact-card IDs: ${canonicalJson(entry.fact_card_ids)}`, `  - Provenance: ${canonicalJson(entry.provenance)}`, "  - Quote:", "<!-- qbd-verbatim-quote:start -->", escapeHtml(entry.quote), "<!-- qbd-verbatim-quote:end -->");
  }
  lines.push("", "## Exclusions", "");
  for (const exclusion of evidenceLog.exclusions) lines.push(`- ${canonicalJson(exclusion)}`);
  return `${lines.join("\n")}\n`;
}

function packagePaths(packageFiles) {
  if (typeof packageFiles === "string") {
    return {
      decision: `${packageFiles}/formula-decision.json`, evaluation: `${packageFiles}/selection-evaluation.json`,
      evidenceLog: `${packageFiles}/evidence-log.json`, decisionMarkdown: `${packageFiles}/formula-decision.md`, evidenceMarkdown: `${packageFiles}/evidence-log.md`,
    };
  }
  return packageFiles;
}

export function assertRegeneratedMarkdown(packageFiles) {
  const paths = packagePaths(packageFiles);
  const decision = JSON.parse(readFileSync(paths.decision, "utf8"));
  const evaluation = JSON.parse(readFileSync(paths.evaluation, "utf8"));
  const evidenceLog = JSON.parse(readFileSync(paths.evidenceLog, "utf8"));
  const actualDecision = readFileSync(paths.decisionMarkdown, "utf8");
  const actualEvidence = readFileSync(paths.evidenceMarkdown, "utf8");
  if (actualDecision !== renderFormulaDecisionMarkdown(decision, evaluation)
    || actualEvidence !== renderEvidenceLogMarkdown(evidenceLog)) {
    throw new Step4PublicationError("E_MARKDOWN_REGENERATION", "published Markdown does not match deterministic regeneration");
  }
}
