import { createHash } from "node:crypto";

import { ReasoningContractError } from "./errors.mjs";
import { canonicalBytes } from "./publication.mjs";
import { validateCohort, validateEvidenceLog, validateFactCards, validateLinearAttestation } from "./contracts.mjs";

const profileFields = ["api", "dosage_form", "product_target", "trial_context"];

function fail(code, message) {
  throw new ReasoningContractError(code, message);
}

function admitRecord(record) {
  if (record.confidence === "low") return "E_EVIDENCE_LOW_CONFIDENCE";
  if (record.extraction_status === "needs-ocr") return "E_EVIDENCE_NEEDS_OCR";
  return null;
}

function profileFor(candidate, candidateProfiles) {
  const profile = candidateProfiles[candidate];
  if (!profile || typeof profile.strength !== "string" || profile.strength.trim() === ""
    || profileFields.some((field) => typeof profile[field] !== "string" || profile[field].trim() === "")) {
    fail("E_COHORT_PROFILE_MISMATCH", `candidate ${candidate} has no complete identity profile`);
  }
  return profile;
}

function exclusion(scope, candidate, reason, recordId) {
  return { scope, candidate, record_id: recordId ?? null, reason };
}

function exclusionKey(entry) {
  return [entry.scope, entry.candidate, entry.record_id ?? "", entry.reason].join("\0");
}

/**
 * Deterministically creates the admitted comparison cohort and retained evidence log.
 * Candidate identity is resolved only through provenance.file -> candidateMap.
 */
export function buildCohortEvidence({
  records,
  candidateMap,
  candidateProfiles,
  rankingCandidates,
  cohortId,
  storeRecordsSha256,
  factCards,
  linearAttestation,
  linearAttestationPin,
} = {}) {
  // --- Input validation ---
  if (!Array.isArray(records) || records.length === 0) fail("E_COHORT_ENVELOPE", "records must be a non-empty array");
  if (!candidateMap || typeof candidateMap !== "object") fail("E_COHORT_ENVELOPE", "candidateMap must be an object");
  if (!candidateProfiles || typeof candidateProfiles !== "object") fail("E_COHORT_ENVELOPE", "candidateProfiles must be an object");
  if (!Array.isArray(rankingCandidates) || rankingCandidates.length === 0) fail("E_COHORT_ENVELOPE", "rankingCandidates must be a non-empty array");
  if (typeof cohortId !== "string" || cohortId.trim() === "") fail("E_COHORT_ENVELOPE", "cohortId must be a non-empty string");
  if (typeof storeRecordsSha256 !== "string" || !/^[0-9a-f]{64}$/.test(storeRecordsSha256)) {
    fail("E_STORE_SHA256", "storeRecordsSha256 must be a 64-lowercase-hex SHA-256");
  }

  // The requested comparison scope is authoritative only when every candidate
  // has an identity committed in the provenance map.  Do this before profile
  // or attestation handling so an uncommitted requested ID cannot be admitted
  // accidentally through a matching profile.
  const committedCandidates = new Set(Object.values(candidateMap));
  for (const candidate of rankingCandidates) {
    if (!committedCandidates.has(candidate)) {
      fail("E_COHORT_CANDIDATE_MAP", `ranking candidate ${candidate} has no committed candidateMap entry`);
    }
  }

  // validateFactCards deliberately accepts a plain ID-keyed object, matching the
  // publication boundary. Do not pass an internal Map across that contract.
  const recordsById = Object.fromEntries(records.map((record) => [record.id, record]));

  // --- Attestation validation and pin check ---
  let attestation = null;
  let hasAttestation = false;
  if (linearAttestation != null) {
    attestation = validateLinearAttestation(linearAttestation);
    if (linearAttestationPin == null) {
      fail("E_REASONING_ARTIFACT_BINDING", "non-null attestation requires a non-null pin");
    }
    if (typeof linearAttestationPin !== "string" || !/^[0-9a-f]{64}$/.test(linearAttestationPin)) {
      fail("E_REASONING_ARTIFACT_BINDING", "linearAttestationPin must be a 64-lowercase-hex SHA-256");
    }
    const computedPin = createHash("sha256").update(canonicalBytes(attestation)).digest("hex");
    if (computedPin !== linearAttestationPin) {
      fail("E_REASONING_ARTIFACT_BINDING", "attestation pin does not match canonical bytes");
    }
    // Validate attestation scope matches ranking candidates
    const expectedMembers = rankingCandidates.map((candidate) => {
      const profile = profileFor(candidate, candidateProfiles);
      return `${candidate}\0${profile.strength}`;
    }).sort();
    const actualMembers = attestation.members.map((m) => `${m.candidate}\0${m.strength}`).sort();
    if (expectedMembers.length !== actualMembers.length || expectedMembers.some((m, i) => m !== actualMembers[i])) {
      fail("E_LINEAR_ATTESTATION_INCOMPLETE", "attestation members must exactly match ranking candidates and their strengths");
    }
    // Validate common profile fields
    for (const candidate of rankingCandidates) {
      const profile = profileFor(candidate, candidateProfiles);
      for (const field of profileFields) {
        if (attestation[field] !== profile[field]) {
          fail("E_LINEAR_ATTESTATION_INCOMPLETE", `attestation ${field} does not match candidate ${candidate}`);
        }
      }
    }
    hasAttestation = true;
  } else if (linearAttestationPin != null) {
    fail("E_REASONING_ARTIFACT_BINDING", "null attestation requires a null pin");
  }

  // --- Candidate cohort formation ---
  const anchor = rankingCandidates[0];
  const anchorProfile = profileFor(anchor, candidateProfiles);
  const ranked = [];
  const exclusions = [];

  for (const candidate of rankingCandidates) {
    const profile = profileFor(candidate, candidateProfiles);
    const differs = profileFields.filter((field) => profile[field] !== anchorProfile[field]);
    if (differs.length > 0) {
      exclusions.push(exclusion("candidate", candidate, "E_COHORT_PROFILE_MISMATCH"));
      continue;
    }
    if (!hasAttestation && profile.strength !== anchorProfile.strength) {
      exclusions.push(exclusion("candidate", candidate, "E_COHORT_STRENGTH_MISMATCH"));
      continue;
    }
    ranked.push(candidate);
  }

  // --- Record admission ---
  const entries = [];
  for (const record of records) {
    const candidate = candidateMap[record.provenance?.file];
    if (!candidate) {
      exclusions.push(exclusion("record", "unmapped", "E_COHORT_CANDIDATE_MAP", record.id));
      continue;
    }
    const reason = admitRecord(record);
    if (reason) {
      exclusions.push(exclusion("record", candidate, reason, record.id));
      continue;
    }
    if (!ranked.includes(candidate)) continue;
    const provenance = record.provenance;
    entries.push({
      record_id: record.id,
      candidate,
      fact_card_ids: [],
      quote: provenance.quote,
      provenance: {
        file: provenance.file,
        page: provenance.page,
        char_start: provenance.char_start,
        char_end: provenance.char_end,
      },
    });
  }

  // Sort entries and exclusions deterministically
  entries.sort((a, b) => a.record_id.localeCompare(b.record_id));
  exclusions.sort((a, b) => exclusionKey(a).localeCompare(exclusionKey(b)));

  // --- Build cohort artifact ---
  const cohortBasis = hasAttestation
    ? `Cross-strength cohort under linear attestation ${attestation.attestation_id}.`
    : `Strength-specific cohort: ${ranked.map((c) => `${c}@${candidateProfiles[c].strength}`).join(", ")}`;

  const cohort = {
    schema_version: 2,
    cohort_id: cohortId,
    candidates: ranked,
    // Candidate identity remains a complete committed map, including candidates
    // outside this particular admitted cohort.
    provenance_candidate_map: { ...candidateMap },
    store_records_sha256: storeRecordsSha256,
    linear_attestation_id: hasAttestation ? attestation.attestation_id : null,
    linear_attestation_sha256: hasAttestation ? linearAttestationPin : null,
    cohort_basis: cohortBasis,
  };

  const evidenceLog = {
    schema_version: 2,
    cohort_id: cohortId,
    entries,
    exclusions,
  };

  // --- Validate fact cards and bind to entries ---
  if (factCards != null) {
    validateFactCards(factCards, { cohort, records: recordsById, minimumQuoteLength: 16 });
    // Map fact cards to entries
    for (const card of factCards.cards) {
      const entry = entries.find((e) => e.record_id === card.record_id && e.candidate === card.candidate);
      if (entry && !entry.fact_card_ids.includes(card.id)) {
        entry.fact_card_ids.push(card.id);
      }
    }
    // Sort fact_card_ids lexicographically
    for (const entry of entries) {
      entry.fact_card_ids.sort();
    }
  }

  // --- Final validation ---
  validateCohort(cohort);
  validateEvidenceLog(evidenceLog);

  return { cohort, evidenceLog };
}
