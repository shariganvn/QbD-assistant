import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateRationale } from "./claim-binding.mjs";
import { RationalePacketError } from "./errors.mjs";
import { validateRationalePacket } from "./packet.mjs";
import { assertRegeneratedRationaleMarkdown, renderRationaleMarkdown } from "./rationale-markdown.mjs";
import { canonicalBytes, sha256 } from "./rationale-contracts.mjs";
import { createRationalePublicationReceipt, RATIONALE_RECEIPT_ARTIFACTS, validateRationalePublicationReceipt } from "./rationale-receipt.mjs";

export const RATIONALE_PACKAGE_MEMBERS = ["rationale-packet.json", "rationale.json", "rationale.md", "rationale-receipt.json"];
const COMMIT_ORDER = ["rationale-packet.json", "rationale.md", "rationale-receipt.json", "rationale.json"];
const PLACEHOLDER = ".gitkeep";

function fail(code, message, options) {
  throw new RationalePacketError(code, message, options);
}

function packagePath(root, name) {
  const path = resolve(root, name);
  if (!path.startsWith(`${root}/`)) fail("E_RATIONALE_PUBLICATION_PATH", "rationale package member escapes its publication root");
  return path;
}

function assertRoot(root) {
  try {
    const stat = lstatSync(root);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail("E_RATIONALE_PUBLICATION_PATH", "rationale publication root must be a real directory");
  } catch (error) {
    if (error instanceof RationalePacketError) throw error;
    fail("E_RATIONALE_PUBLICATION_MISSING_FILE", `cannot access rationale publication root: ${error.message}`, { cause: error });
  }
}

function assertAllowlist(root, transientPaths = new Set()) {
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); }
  catch (error) { fail("E_RATIONALE_PUBLICATION_MISSING_FILE", `cannot read rationale publication root: ${error.message}`, { cause: error }); }
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (!entry.isFile() || (!RATIONALE_PACKAGE_MEMBERS.includes(entry.name) && !transientPaths.has(path))) {
      fail("E_RATIONALE_PUBLICATION_SURPLUS_FILE", `unrecognized rationale publication member: ${entry.name}`);
    }
  }
}

// The tracked first-publish placeholder is moved aside before the allowlist check, because a root
// that already carries a sealed rationale-packet.json must still publish. It joins the invocation's
// backup set, so a failed publish restores it and only a fully validated publish retires it.
function backupPlaceholder(root, fileSystem, backups) {
  const target = packagePath(root, PLACEHOLDER);
  let stat;
  try { stat = lstatSync(target); }
  catch { return; }
  // A placeholder that is not a regular file stays put and fails the allowlist as a surplus entry.
  if (!stat.isFile() || stat.isSymbolicLink()) return;
  const backup = packagePath(root, `.${PLACEHOLDER}.${randomUUID()}.bak`);
  const bytes = readFileSync(target);
  fileSystem.renameSync(target, backup);
  backups.push({ target, backup, bytes });
}

function readJson(root, name) {
  const path = packagePath(root, name);
  try {
    const bytes = readFileSync(path);
    const value = JSON.parse(bytes.toString("utf8"));
    if (!bytes.equals(Buffer.from(canonicalBytes(value), "utf8"))) fail("E_RATIONALE_PUBLICATION_RECEIPT", `${name} is not canonical JSON`);
    return value;
  } catch (error) {
    if (error instanceof RationalePacketError) throw error;
    fail("E_RATIONALE_PUBLICATION_RECEIPT", `cannot read published ${name}: ${error.message}`, { cause: error });
  }
}

function requiredFile(root, name) {
  const path = packagePath(root, name);
  let stat;
  try { stat = lstatSync(path); }
  catch { fail("E_RATIONALE_PUBLICATION_MISSING_FILE", `missing rationale publication member: ${name}`); }
  if (!stat.isFile() || stat.isSymbolicLink()) fail("E_RATIONALE_PUBLICATION_SURPLUS_FILE", `rationale publication member is not a regular file: ${name}`);
  return path;
}

function validateRationalePackage(outputRoot, transientPaths = new Set()) {
  const root = resolve(outputRoot);
  assertRoot(root);
  assertAllowlist(root, transientPaths);
  for (const name of RATIONALE_PACKAGE_MEMBERS) requiredFile(root, name);
  const packet = readJson(root, "rationale-packet.json");
  const rationale = readJson(root, "rationale.json");
  const receipt = validateRationalePublicationReceipt(readJson(root, "rationale-receipt.json"));
  validateRationalePacket(packet);
  validateRationale(rationale, packet);
  if (receipt.run_id !== packet.run_id || receipt.packet_sha256 !== sha256(canonicalBytes(packet))
    || receipt.source_publication_receipt_sha256 !== packet.source_publication_receipt_sha256) {
    fail("E_RATIONALE_PUBLICATION_RECEIPT", "rationale receipt does not bind the sealed packet");
  }
  for (const name of RATIONALE_RECEIPT_ARTIFACTS) {
    if (receipt.artifacts[name] !== sha256(readFileSync(requiredFile(root, name)))) {
      fail("E_RATIONALE_PUBLICATION_RECEIPT", `rationale receipt hash mismatch for ${name}`);
    }
  }
  assertRegeneratedRationaleMarkdown(root);
  return root;
}

export function validatePublishedRationalePackage(outputRoot) {
  return validateRationalePackage(outputRoot);
}

export function publishRationale({ packet, rationale, outputRoot, fileSystem = { mkdirSync, renameSync, rmSync, writeFileSync } }) {
  validateRationalePacket(packet);
  validateRationale(rationale, packet);
  const root = resolve(outputRoot);
  const markdown = renderRationaleMarkdown(rationale, packet);
  const bytes = {
    "rationale-packet.json": canonicalBytes(packet),
    "rationale.json": canonicalBytes(rationale),
    "rationale.md": markdown,
  };
  bytes["rationale-receipt.json"] = canonicalBytes(createRationalePublicationReceipt({
    runId: packet.run_id,
    packetSha256: sha256(bytes["rationale-packet.json"]),
    sourcePublicationReceiptSha256: packet.source_publication_receipt_sha256,
    artifacts: Object.fromEntries(RATIONALE_RECEIPT_ARTIFACTS.map((name) => [name, sha256(bytes[name])])),
  }));
  const temporary = [];
  const backups = [];
  const committed = [];
  try {
    fileSystem.mkdirSync(root, { recursive: true });
    assertRoot(root);
    backupPlaceholder(root, fileSystem, backups);
    assertAllowlist(root, new Set(backups.map(({ backup }) => backup)));
    for (const name of COMMIT_ORDER) {
      const target = packagePath(root, name);
      const temp = packagePath(root, `.${name}.${randomUUID()}.tmp`);
      fileSystem.writeFileSync(temp, bytes[name], { flag: "wx" });
      temporary.push({ name, target, temp });
    }
    for (const entry of temporary) {
      if (!existsSync(entry.target)) continue;
      const backup = packagePath(root, `.${entry.name}.${randomUUID()}.bak`);
      const bytes = readFileSync(entry.target);
      fileSystem.renameSync(entry.target, backup);
      backups.push({ target: entry.target, backup, bytes });
    }
    for (const entry of temporary) {
      fileSystem.renameSync(entry.temp, entry.target);
      committed.push(entry.target);
    }
    validateRationalePackage(root, new Set(backups.map(({ backup }) => backup)));
    for (const { backup } of backups) fileSystem.rmSync(backup, { force: true });
  } catch (error) {
    for (const target of committed.reverse()) {
      try { fileSystem.rmSync(target, { force: true }); } catch { /* best effort rollback */ }
    }
    for (const { target, backup, bytes } of backups.reverse()) {
      try {
        if (existsSync(backup)) fileSystem.renameSync(backup, target);
        else fileSystem.writeFileSync(target, bytes);
      } catch { /* best effort restore */ }
    }
    for (const { temp } of temporary) {
      try { fileSystem.rmSync(temp, { force: true }); } catch { /* invocation-owned cleanup */ }
    }
    if (error instanceof RationalePacketError) throw error;
    fail("E_RATIONALE_PUBLICATION_WRITE", `cannot publish rationale package: ${error.message}`, { cause: error });
  }
  return root;
}
