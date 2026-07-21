import { createHash } from "node:crypto";
import { relative, resolve, sep } from "node:path";
import { IngestError } from "./errors.mjs";
import { validateSchema } from "./schema-validation.mjs";

export function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !rel.includes(`${sep}..${sep}`));
}

export function canonicalRoot(root, fileOps, create = false) {
  const absolute = resolve(root);
  if (!fileOps.existsSync(absolute)) {
    if (!create) throw new IngestError("E_PATH_ESCAPE", `Configured root does not exist: ${absolute}`);
    fileOps.mkdirSync(absolute, { recursive: true });
  }
  const stat = fileOps.lstatSync(absolute);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new IngestError("E_SYMLINK", `Configured root is not a real directory: ${absolute}`, { details: { path: absolute } });
  }
  const canonical = fileOps.realpathSync(absolute);
  if (canonical !== absolute) {
    throw new IngestError("E_SYMLINK", `Configured root resolves through a symlink: ${absolute}`, { details: { path: absolute } });
  }
  return canonical;
}

export function snapshot(root, fileOps) {
  const entries = [];
  function visit(dir) {
    for (const entry of fileOps.readdirSync(dir, { withFileTypes: true })) {
      const file = resolve(dir, entry.name);
      if (entry.isSymbolicLink()) throw new IngestError("E_SYMLINK", `Symlink rejected: ${file}`);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) entries.push([file.slice(root.length + 1), createHash("sha256").update(fileOps.readFileSync(file)).digest("hex")]);
    }
  }
  visit(root);
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

export function validateJsonl(jsonl, schema) {
  if (!jsonl || !jsonl.endsWith("\n")) throw new IngestError("E_EMPTY_STORE", "Published JSONL must be non-empty and newline-terminated");
  const records = jsonl.trimEnd().split("\n").map((line, index) => {
    try { return JSON.parse(line); } catch (cause) {
      throw new IngestError("E_RECORD_SCHEMA", `Output line ${index + 1} is not JSON`, { cause });
    }
  });
  const errors = records.flatMap((record, index) => validateSchema(record, schema, `record[${index}]`));
  if (errors.length) throw new IngestError("E_RECORD_SCHEMA", `${errors.length} schema validation errors`, { details: { errors } });
  return records;
}

export function validRunId(runId) {
  return typeof runId === "string" && /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(runId);
}
