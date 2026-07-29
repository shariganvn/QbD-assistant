import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { RationalePacketError } from "./errors.mjs";

const LITERAL_SAFE_ESCAPES = new Map([
  ["&", "\\u0026"], ["<", "\\u003c"], [">", "\\u003e"], ["`", "\\u0060"],
  ["#", "\\u0023"], ["-", "\\u002d"], ["+", "\\u002b"], ["*", "\\u002a"],
  ["_", "\\u005f"], ["[", "\\u005b"], ["]", "\\u005d"], ["(", "\\u0028"],
  [")", "\\u0029"], ["!", "\\u0021"], ["|", "\\u007c"],
]);

function literalSafeJson(value) {
  return JSON.stringify(value).replace(/[&<>`#\-+*_\[\]()!|]/g, (character) => LITERAL_SAFE_ESCAPES.get(character));
}

function headerValue(value) {
  return value === null ? "null" : String(value);
}

function renderCitations(cites) {
  return Object.entries(cites).map(([name, value]) => `${name}: ${literalSafeJson(value)}`);
}

function renderClaim(claim) {
  const lines = [
    `### ${claim.claim_id}`,
    `kind: ${claim.kind}`,
    `Text (literal-safe JSON string): ${literalSafeJson(claim.text)}`,
    "Citations (stored order):",
    ...renderCitations(claim.cites),
  ];
  if (claim.kind === "fact" && Array.isArray(claim.cites.quotes) && claim.cites.quotes.length > 0) {
    lines.push("Quoted evidence:", ...claim.cites.quotes.map((quote) => literalSafeJson(quote)));
  }
  return lines.join("\n");
}

export function renderRationaleMarkdown(rationale, packet) {
  const lines = [
    "# Rationale",
    "Internal only — not for external distribution.",
    "",
    "## Header",
    `rationale_id: ${headerValue(rationale.rationale_id)}`,
    `packet_id: ${headerValue(rationale.packet_id)}`,
    `packet_sha256: ${headerValue(rationale.packet_sha256)}`,
    `decision_id: ${headerValue(rationale.decision_id)}`,
    `decision_sha256: ${headerValue(rationale.decision_sha256)}`,
    `cohort_id: ${headerValue(rationale.cohort_id)}`,
    `run_id: ${headerValue(rationale.run_id)}`,
    `decision_status: ${headerValue(rationale.decision_status)}`,
    `winner: ${headerValue(rationale.winner)}`,
    `fd_action: ${headerValue(rationale.fd_action)}`,
    `display_state: ${headerValue(rationale.display_state)}`,
    `cohort_basis: ${headerValue(packet.cohort.cohort_basis)}`,
    `attestation_id: ${headerValue(packet.cohort.linear_attestation_id)}`,
    `attestation_sha256: ${headerValue(packet.cohort.linear_attestation_sha256)}`,
    "",
    "## Claims",
    ...rationale.claims.flatMap((claim, index) => (index === 0 ? [renderClaim(claim)] : ["", renderClaim(claim)])),
  ];
  return `${lines.join("\n")}\n`;
}

function publishedPaths(packageRootOrPaths) {
  if (typeof packageRootOrPaths === "string") {
    const root = resolve(packageRootOrPaths);
    return {
      rationalePath: resolve(root, "rationale.json"),
      packetPath: resolve(root, "rationale-packet.json"),
      markdownPath: resolve(root, "rationale.md"),
    };
  }
  if (packageRootOrPaths !== null && typeof packageRootOrPaths === "object") {
    const { rationalePath, packetPath, markdownPath } = packageRootOrPaths;
    if ([rationalePath, packetPath, markdownPath].every((path) => typeof path === "string")) return { rationalePath, packetPath, markdownPath };
  }
  throw new RationalePacketError("E_RATIONALE_MARKDOWN_REGENERATION", "published rationale paths are required");
}

export function assertRegeneratedRationaleMarkdown(packageRootOrPaths) {
  const { rationalePath, packetPath, markdownPath } = publishedPaths(packageRootOrPaths);
  const rationale = JSON.parse(readFileSync(rationalePath, "utf8"));
  const packet = JSON.parse(readFileSync(packetPath, "utf8"));
  const expected = Buffer.from(renderRationaleMarkdown(rationale, packet), "utf8");
  const actual = readFileSync(markdownPath);
  if (!actual.equals(expected)) throw new RationalePacketError("E_RATIONALE_MARKDOWN_REGENERATION", "rationale.md is not the byte-exact regenerated Markdown");
  return true;
}
