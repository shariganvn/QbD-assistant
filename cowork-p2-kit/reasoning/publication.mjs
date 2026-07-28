import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateCohort, validateDecision, validateEvidenceLog, validateFactCards, validateLinearAttestation } from "./contracts.mjs";
import { ReasoningContractError } from "./errors.mjs";
import { assertRegeneratedMarkdown, renderEvidenceLogMarkdown, renderFormulaDecisionMarkdown } from "./markdown.mjs";
import { createPublicationReceipt, Step4PublicationError, validatePublicationReceipt } from "./publication-receipt.mjs";
import { validateSelectionEvaluation } from "./selection-contracts.mjs";

const artifactNames = [
  ["factCards", "fact-cards.json"],
  ["cohort", "cohort.json"],
  ["linearAttestation", "linear-attestation.json"],
  ["evidenceLog", "evidence-log.json"],
  ["decision", "formula-decision.json"],
];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalBytes(value) {
  return JSON.stringify(canonicalize(value), null, 2) + "\n";
}

export function publishArtifacts(artifacts, outputRoot, fileSystem = { mkdirSync, renameSync, rmSync, writeFileSync }) {
  const root = resolve(outputRoot);
  const temporary = [];
  const backups = [];
  const committed = [];
  try {
    fileSystem.mkdirSync(root, { recursive: true });
    for (const [key, name] of artifactNames) {
      const target = resolve(root, name);
      if (!target.startsWith(`${root}/`)) throw new ReasoningContractError("E_PUBLICATION_PATH", "artifact escapes the publication root");
      // A non-attested publication has no attestation artifact. If it replaces
      // a prior attested package, stage removal through the same backup/rollback
      // transaction so no unrelated attestation survives in the output set.
      if (artifacts[key] == null) {
        if (existsSync(target)) temporary.push({ temp: null, target, name });
        continue;
      }
      const temp = resolve(root, `.${name}.${randomUUID()}.tmp`);
      fileSystem.writeFileSync(temp, canonicalBytes(artifacts[key]), { flag: "wx" });
      temporary.push({ temp, target, name });
    }
    for (const entry of temporary) {
      if (existsSync(entry.target)) {
        const backup = resolve(root, `.${entry.name}.${randomUUID()}.bak`);
        fileSystem.renameSync(entry.target, backup);
        backups.push({ target: entry.target, backup });
      }
    }
    for (const entry of temporary) {
      if (entry.temp === null) continue;
      fileSystem.renameSync(entry.temp, entry.target);
      committed.push(entry.target);
    }
    for (const { backup } of backups) fileSystem.rmSync(backup, { force: true });
  } catch (error) {
    for (const target of committed) {
      try { fileSystem.rmSync(target, { force: true }); } catch { /* best effort rollback */ }
    }
    for (const { target, backup } of backups.reverse()) {
      try { fileSystem.renameSync(backup, target); } catch { /* best effort rollback */ }
    }
    for (const { temp } of temporary) {
      if (temp === null) continue;
      try { fileSystem.rmSync(temp, { force: true }); } catch { /* invocation-owned cleanup */ }
    }
    if (error instanceof ReasoningContractError) throw error;
    throw new ReasoningContractError("E_PUBLICATION_WRITE", `cannot publish reasoning artifacts: ${error.message}`, { cause: error });
  }
  return root;
}

const packageNames = ["cohort.json", "fact-cards.json", "evidence-log.json", "formula-decision.json", "selection-evaluation.json", "formula-decision.md", "evidence-log.md", "publication-receipt.json", "linear-attestation.json"];
const requiredPackageNames = packageNames.filter((name) => name !== "linear-attestation.json");
const packageCommitOrder = ["cohort.json", "fact-cards.json", "evidence-log.json", "linear-attestation.json", "selection-evaluation.json", "formula-decision.md", "evidence-log.md", "publication-receipt.json", "formula-decision.json"];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function binding(message) {
  throw new ReasoningContractError("E_REASONING_ARTIFACT_BINDING", message);
}

function assertedRecordIds(recordIds, candidate, entriesById, candidates) {
  if (!candidates.has(candidate)) binding(`evaluation references a candidate outside the cohort: ${candidate}`);
  for (const recordId of recordIds) {
    const entry = entriesById.get(recordId);
    if (!entry || entry.candidate !== candidate) binding(`evaluation references unadmitted or cross-candidate record ${recordId}`);
  }
}

function validatePackageStore(store) {
  if (!store || typeof store !== "object" || Array.isArray(store)
    || !Buffer.isBuffer(store.bytes)) {
    throw new ReasoningContractError("E_STORE_INPUT", "package validation requires the supplied raw store bytes");
  }
  try {
    const records = Object.fromEntries(store.bytes.toString("utf8").trim().split("\n").filter(Boolean).map((line) => {
      const record = JSON.parse(line);
      return [record.id, record];
    }));
    return { records, bytes: store.bytes, sha256: sha256(store.bytes) };
  } catch (error) {
    throw new ReasoningContractError("E_STORE_INPUT", `cannot parse supplied store bytes: ${error.message}`, { cause: error });
  }
}

function validatePackageInputs(artifacts, store) {
  const suppliedStore = validatePackageStore(store);
  const cohort = validateCohort(artifacts.cohort);
  const decision = validateDecision(artifacts.decision);
  const evaluation = validateSelectionEvaluation(artifacts.evaluation);
  const factCards = validateFactCards(artifacts.factCards, { cohort, records: suppliedStore.records });
  const evidenceLog = validateEvidenceLog(artifacts.evidenceLog);
  const linearAttestation = artifacts.linearAttestation === null ? null : validateLinearAttestation(artifacts.linearAttestation);
  if (cohort.store_records_sha256 !== suppliedStore.sha256) {
    throw new ReasoningContractError("E_STORE_SHA256", "store SHA-256 does not match the cohort pin");
  }
  assertEvidenceLogBinding(evidenceLog, cohort, factCards, suppliedStore.records);
  assertDecisionPackageBindings({ decision, evaluation, cohort, factCards, evidenceLog, linearAttestation });
  return { decision, evaluation, cohort, factCards, evidenceLog, linearAttestation, store: suppliedStore };
}

export function assertEvidenceLogBinding(evidenceLog, cohort, factCards, records) {
  const code = "E_REASONING_ARTIFACT_BINDING";
  if (evidenceLog.cohort_id !== cohort.cohort_id) {
    throw new ReasoningContractError(code, "evidence log and cohort disagree on cohort_id");
  }
  const cardsById = new Map();
  for (const card of factCards.cards) {
    if (cardsById.has(card.id)) {
      throw new ReasoningContractError(code, `fact cards contain duplicate id ${card.id}`);
    }
    cardsById.set(card.id, card);
  }
  for (const entry of evidenceLog.entries) {
    const record = records[entry.record_id];
    const provenance = record?.provenance;
    if (!record || provenance?.file !== entry.provenance.file
      || provenance?.page !== entry.provenance.page
      || provenance?.char_start !== entry.provenance.char_start
      || provenance?.char_end !== entry.provenance.char_end
      || provenance?.quote !== entry.quote
      || cohort.provenance_candidate_map[entry.provenance.file] !== entry.candidate
    ) {
      throw new ReasoningContractError(code, `evidence log entry ${entry.record_id} does not bind the store record`);
    }
    for (const factCardId of entry.fact_card_ids) {
      const card = cardsById.get(factCardId);
      if (!card || card.record_id !== entry.record_id || card.candidate !== entry.candidate || card.provenance.file !== entry.provenance.file) {
        throw new ReasoningContractError(code, `evidence log entry ${entry.record_id} does not bind fact card ${factCardId}`);
      }
    }
  }
}

export function assertDecisionPackageBindings({ decision, evaluation, cohort, factCards, evidenceLog, linearAttestation = null }) {
  if (decision.cohort_id !== cohort.cohort_id || decision.linear_attestation_id !== cohort.linear_attestation_id
    || decision.linear_attestation_sha256 !== cohort.linear_attestation_sha256 || decision.cohort_basis !== cohort.cohort_basis) {
    binding("decision and cohort bindings disagree");
  }
  if (evaluation.decision_id !== decision.decision_id || evaluation.decision_sha256 !== sha256(canonicalBytes(decision))
    || evaluation.cohort_id !== cohort.cohort_id || evaluation.rubric_sha256 !== decision.rubric_sha256) {
    binding("decision, evaluation, and cohort bindings disagree");
  }
  if (linearAttestation === null ? cohort.linear_attestation_id !== null : linearAttestation.attestation_id !== cohort.linear_attestation_id
    || sha256(canonicalBytes(linearAttestation)) !== cohort.linear_attestation_sha256) {
    binding("cohort and supplied linear attestation bindings disagree");
  }
  const cardsById = new Map(factCards.cards.map((card) => [card.id, card]));
  const expectedCardIds = [...cardsById.keys()].sort();
  if (cardsById.size !== factCards.cards.length || decision.fact_card_ids.length !== expectedCardIds.length
    || decision.fact_card_ids.some((id, index) => id !== expectedCardIds[index])) binding("decision fact_card_ids must be the sorted published card set");
  const entriesById = new Map(evidenceLog.entries.map((entry) => [entry.record_id, entry]));
  const candidates = new Set(cohort.candidates);
  for (const cell of evaluation.matrix_cells) {
    assertedRecordIds(cell.record_ids, cell.candidate, entriesById, candidates);
    for (const cardId of cell.fact_card_ids) {
      const card = cardsById.get(cardId);
      if (!card || card.candidate !== cell.candidate || !entriesById.has(card.record_id)) binding(`evaluation matrix cell references an unadmitted fact card ${cardId}`);
    }
  }
  for (const review of evaluation.candidate_reviews) {
    if (!candidates.has(review.candidate)) binding(`evaluation review references a candidate outside the cohort: ${review.candidate}`);
    for (const gate of review.hard_gates) assertedRecordIds(gate.record_ids, review.candidate, entriesById, candidates);
    for (const evidence of review.critical_evidence) {
      assertedRecordIds(evidence.cited_record_ids, review.candidate, entriesById, candidates);
      assertedRecordIds(evidence.uncited_results_record_ids, review.candidate, entriesById, candidates);
    }
  }
}

function assertPackageAllowlist(root, transientPaths = new Set()) {
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); }
  catch (error) { throw new Step4PublicationError("E_PUBLICATION_MISSING_FILE", `cannot read publication root: ${error.message}`, { cause: error }); }
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (!entry.isFile() || (!packageNames.includes(entry.name) && !transientPaths.has(path))) {
      throw new Step4PublicationError("E_PUBLICATION_SURPLUS_FILE", `unrecognized publication member: ${entry.name}`);
    }
  }
}

function assertPublicationDirectory(root) {
  try {
    const stat = lstatSync(root);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Step4PublicationError("E_PUBLICATION_PATH", "publication root must be a real directory");
  } catch (error) {
    if (error instanceof Step4PublicationError) throw error;
    throw new Step4PublicationError("E_PUBLICATION_MISSING_FILE", `cannot access publication root: ${error.message}`, { cause: error });
  }
}

function packagePath(root, name) {
  const path = resolve(root, name);
  if (!path.startsWith(`${root}/`)) throw new Step4PublicationError("E_PUBLICATION_PATH", "package member escapes publication root");
  return path;
}

function requiredFile(root, name) {
  const path = packagePath(root, name);
  if (!existsSync(path)) throw new Step4PublicationError("E_PUBLICATION_MISSING_FILE", `missing publication member: ${name}`);
  return path;
}

function readPackageJson(root, name) {
  try { return JSON.parse(readFileSync(requiredFile(root, name), "utf8")); }
  catch (error) {
    if (error instanceof ReasoningContractError || error instanceof Step4PublicationError) throw error;
    throw new Step4PublicationError("E_PUBLICATION_RECEIPT", `cannot read published ${name}: ${error.message}`, { cause: error });
  }
}

export function validatePublishedDecisionPackage(outputRoot, { store, transientPaths = new Set() } = {}) {
  const root = resolve(outputRoot);
  const suppliedStore = validatePackageStore(store);
  assertPublicationDirectory(root);
  assertPackageAllowlist(root, transientPaths);
  const receipt = validatePublicationReceipt(readPackageJson(root, "publication-receipt.json"));
  const cohort = validateCohort(readPackageJson(root, "cohort.json"));
  const factCards = readPackageJson(root, "fact-cards.json");
  const evidenceLog = validateEvidenceLog(readPackageJson(root, "evidence-log.json"));
  const decision = validateDecision(readPackageJson(root, "formula-decision.json"));
  const evaluation = validateSelectionEvaluation(readPackageJson(root, "selection-evaluation.json"));
  const attestationPath = packagePath(root, "linear-attestation.json");
  const attestationPresent = existsSync(attestationPath);
  if ((cohort.linear_attestation_id !== null) !== attestationPresent) throw new Step4PublicationError("E_PUBLICATION_RECEIPT", "attestation file presence disagrees with cohort");
  const linearAttestation = attestationPresent ? validateLinearAttestation(readPackageJson(root, "linear-attestation.json")) : null;
  validateFactCards(factCards, { cohort, records: suppliedStore.records });
  if (cohort.store_records_sha256 !== suppliedStore.sha256) throw new ReasoningContractError("E_STORE_SHA256", "store SHA-256 does not match the cohort pin");
  assertEvidenceLogBinding(evidenceLog, cohort, factCards, suppliedStore.records);
  assertDecisionPackageBindings({ decision, evaluation, cohort, factCards, evidenceLog, linearAttestation });
  if (receipt.input_store_sha256 !== cohort.store_records_sha256) throw new Step4PublicationError("E_PUBLICATION_RECEIPT", "receipt store hash disagrees with cohort pin");
  for (const name of requiredPackageNames.filter((member) => member !== "publication-receipt.json")) {
    if (receipt.artifacts[name] !== sha256(readFileSync(requiredFile(root, name)))) throw new Step4PublicationError("E_PUBLICATION_RECEIPT", `receipt hash mismatch for ${name}`);
  }
  if (receipt.artifacts["linear-attestation.json"] !== (attestationPresent ? sha256(readFileSync(attestationPath)) : null)) throw new Step4PublicationError("E_PUBLICATION_RECEIPT", "receipt attestation hash disagrees with publication");
  assertRegeneratedMarkdown(root);
  return root;
}

function publishDecisionPackage(artifacts, root, { runId, inputStoreSha256, store, fileSystem = { mkdirSync, renameSync, rmSync, writeFileSync } } = {}) {
  const validated = validatePackageInputs(artifacts, store);
  if (inputStoreSha256 !== validated.store.sha256) throw new ReasoningContractError("E_STORE_SHA256", "receipt store SHA-256 must match the supplied store");
  const bytes = {
    "cohort.json": canonicalBytes(validated.cohort),
    "fact-cards.json": canonicalBytes(validated.factCards),
    "evidence-log.json": canonicalBytes(validated.evidenceLog),
    "formula-decision.json": canonicalBytes(validated.decision),
    "selection-evaluation.json": canonicalBytes(validated.evaluation),
    "formula-decision.md": renderFormulaDecisionMarkdown(validated.decision, validated.evaluation),
    "evidence-log.md": renderEvidenceLogMarkdown(validated.evidenceLog),
    "linear-attestation.json": validated.linearAttestation === null ? null : canonicalBytes(validated.linearAttestation),
  };
  const receiptHashes = Object.fromEntries(Object.entries(bytes).map(([name, value]) => [name, value === null ? null : sha256(value)]));
  bytes["publication-receipt.json"] = canonicalBytes(createPublicationReceipt({ runId, inputStoreSha256, artifacts: receiptHashes }));
  const temporary = [];
  const backups = [];
  const committed = [];
  try {
    fileSystem.mkdirSync(root, { recursive: true });
    assertPublicationDirectory(root);
    assertPackageAllowlist(root);
    for (const name of packageCommitOrder) {
      const target = packagePath(root, name);
      const value = bytes[name];
      if (value === null) { temporary.push({ name, target, temp: null }); continue; }
      const temp = resolve(root, `.${name}.${randomUUID()}.tmp`);
      fileSystem.writeFileSync(temp, value, { flag: "wx" });
      temporary.push({ name, target, temp });
    }
    for (const entry of temporary) {
      if (existsSync(entry.target)) {
        const backup = resolve(root, `.${entry.name}.${randomUUID()}.bak`);
        fileSystem.renameSync(entry.target, backup);
        backups.push({ target: entry.target, backup });
      }
    }
    for (const entry of temporary) {
      if (entry.temp === null) continue;
      fileSystem.renameSync(entry.temp, entry.target);
      committed.push(entry.target);
    }
    validatePublishedDecisionPackage(root, { store: validated.store, transientPaths: new Set(backups.map(({ backup }) => backup)) });
    for (const { backup } of backups) fileSystem.rmSync(backup, { force: true });
  } catch (error) {
    for (const target of committed.reverse()) {
      try { fileSystem.rmSync(target, { force: true }); } catch { /* best-effort rollback */ }
    }
    for (const { target, backup } of backups.reverse()) {
      try { fileSystem.renameSync(backup, target); } catch { /* best-effort rollback */ }
    }
    for (const { temp } of temporary) {
      if (temp !== null) try { fileSystem.rmSync(temp, { force: true }); } catch { /* invocation-owned cleanup */ }
    }
    if (error instanceof ReasoningContractError || error instanceof Step4PublicationError) throw error;
    throw new ReasoningContractError("E_PUBLICATION_WRITE", `cannot publish reasoning decision package: ${error.message}`, { cause: error });
  }
  return root;
}

const cliFilePath = fileURLToPath(import.meta.url);
const defaultPublicationRoot = resolve(dirname(cliFilePath), "../../docs/reports/qbd-p4-reasoning-layer/decision");
const required = ["decision", "cohort", "fact-cards", "evidence-log", "store"];
const packageRequired = ["decision", "evaluation", "cohort", "fact-cards", "evidence-log", "store", "run-id", "output-root"];

function parseArguments(argv) {
  if (argv[0] !== "publish") throw new ReasoningContractError("E_INPUT_PATH", "Usage: cli.mjs publish --decision <file> --cohort <file> --fact-cards <file> [--linear-attestation <file>] --evidence-log <file> --store <records.jsonl> --output-root <absolute-directory>");
  const paths = {};
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || !value || paths[flag.slice(2)] !== undefined) throw new ReasoningContractError("E_INPUT_PATH", "CLI arguments must be unique option/value pairs");
    paths[flag.slice(2)] = value;
  }
  if (!required.every((key) => typeof paths[key] === "string") || typeof paths["output-root"] !== "string") throw new ReasoningContractError("E_INPUT_PATH", "all publication artifacts and --output-root are required");
  if (!isAbsolute(paths["output-root"])) throw new ReasoningContractError("E_PUBLICATION_PATH", "--output-root must be absolute");
  return paths;
}

function parsePackageArguments(argv) {
  if (argv[0] !== "publish-package") throw new ReasoningContractError("E_INPUT_PATH", "Usage: cli.mjs publish-package --decision <file> --evaluation <file> --cohort <file> --fact-cards <file> --evidence-log <file> --store <records.jsonl> --run-id <id> --output-root <absolute-directory> [--linear-attestation <file>]");
  const paths = {};
  const allowed = new Set([...packageRequired, "linear-attestation"]);
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    const key = flag?.startsWith("--") ? flag.slice(2) : null;
    if (!key || !allowed.has(key) || !value || paths[key] !== undefined) throw new ReasoningContractError("E_INPUT_PATH", "package CLI arguments must be unique declared option/value pairs");
    paths[key] = value;
  }
  if (!packageRequired.every((key) => typeof paths[key] === "string")) throw new ReasoningContractError("E_INPUT_PATH", "all package publication artifacts, run ID, and --output-root are required");
  if (!isAbsolute(paths["output-root"])) throw new ReasoningContractError("E_PUBLICATION_PATH", "--output-root must be absolute");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(paths["run-id"])) throw new ReasoningContractError("E_INPUT_PATH", "--run-id is invalid");
  return paths;
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { throw new ReasoningContractError("E_INPUT_JSON", `cannot read JSON artifact ${path}: ${error.message}`, { cause: error }); }
}

function readRecords(path) {
  try {
    const bytes = readFileSync(path);
    return validatePackageStore({ bytes });
  } catch (error) {
    if (error instanceof ReasoningContractError) throw error;
    throw new ReasoningContractError("E_STORE_INPUT", `cannot read store records: ${error.message}`, { cause: error });
  }
}

function assertBinding(cohort, decision, linearAttestation) {
  const code = "E_REASONING_ARTIFACT_BINDING";
  if (cohort.cohort_id !== decision.cohort_id || cohort.linear_attestation_id !== decision.linear_attestation_id
    || cohort.linear_attestation_sha256 !== decision.linear_attestation_sha256 || cohort.cohort_basis !== decision.cohort_basis) {
    throw new ReasoningContractError(code, "cohort and decision bindings disagree");
  }
  if (cohort.linear_attestation_id !== null) {
    if (linearAttestation == null || cohort.linear_attestation_id !== linearAttestation.attestation_id
      || cohort.linear_attestation_sha256 !== sha256(canonicalBytes(linearAttestation))) {
      throw new ReasoningContractError(code, "cohort linear attestation binding disagrees");
    }
  } else if (linearAttestation != null) throw new ReasoningContractError(code, "non-attested cohort must not publish an unrelated linear attestation");
}

export function createReasoningCli({ publicationRoot = defaultPublicationRoot } = {}) {
  const declaredRoot = resolve(publicationRoot);
  return {
    main(argv) {
      if (argv[0] === "publish-package") {
        const paths = parsePackageArguments(argv);
        const outputRoot = resolve(paths["output-root"]);
        if (outputRoot !== declaredRoot) throw new ReasoningContractError("E_PUBLICATION_PATH", "publication must use the declared output root");
        const artifacts = {
          decision: validateDecision(readJson(paths.decision)), evaluation: validateSelectionEvaluation(readJson(paths.evaluation)),
          cohort: validateCohort(readJson(paths.cohort)), factCards: readJson(paths["fact-cards"]),
          linearAttestation: paths["linear-attestation"] === undefined ? null : validateLinearAttestation(readJson(paths["linear-attestation"])),
          evidenceLog: validateEvidenceLog(readJson(paths["evidence-log"])),
        };
        const store = readRecords(paths.store);
        if (store.sha256 !== artifacts.cohort.store_records_sha256) throw new ReasoningContractError("E_STORE_SHA256", "store SHA-256 does not match the cohort pin");
        validateFactCards(artifacts.factCards, { cohort: artifacts.cohort, records: store.records });
        assertBinding(artifacts.cohort, artifacts.decision, artifacts.linearAttestation);
        assertEvidenceLogBinding(artifacts.evidenceLog, artifacts.cohort, artifacts.factCards, store.records);
        assertDecisionPackageBindings(artifacts);
        return publishDecisionPackage(artifacts, declaredRoot, { runId: paths["run-id"], inputStoreSha256: store.sha256, store: { bytes: store.bytes } });
      }
      const paths = parseArguments(argv);
      const outputRoot = resolve(paths["output-root"]);
      if (outputRoot !== declaredRoot) throw new ReasoningContractError("E_PUBLICATION_PATH", "publication must use the declared output root");
      const artifacts = {
        decision: validateDecision(readJson(paths.decision)), cohort: validateCohort(readJson(paths.cohort)), factCards: readJson(paths["fact-cards"]),
        linearAttestation: paths["linear-attestation"] === undefined ? null : validateLinearAttestation(readJson(paths["linear-attestation"])),
        evidenceLog: validateEvidenceLog(readJson(paths["evidence-log"])),
      };
      const store = readRecords(paths.store);
      if (store.sha256 !== artifacts.cohort.store_records_sha256) throw new ReasoningContractError("E_STORE_SHA256", "store SHA-256 does not match the cohort pin");
      validateFactCards(artifacts.factCards, { cohort: artifacts.cohort, records: store.records });
      assertBinding(artifacts.cohort, artifacts.decision, artifacts.linearAttestation);
      assertEvidenceLogBinding(artifacts.evidenceLog, artifacts.cohort, artifacts.factCards, store.records);
      return publishArtifacts(artifacts, outputRoot);
    },
  };
}

export function main(argv) {
  return createReasoningCli().main(argv);
}
