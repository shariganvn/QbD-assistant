// Drift-check cho docs/docs-state.yaml.
// So sánh registry với file thật trên disk. Báo lệch, exit 1 nếu có.
// Chạy: npm run docs:check
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const STATE_FILE = "docs/docs-state.yaml";
const VALID_STATES = ["canonical", "active", "planned", "deprecated", "reference"];

// Thư mục quét và phần mở rộng coi là "doc" cần đăng ký.
const SCAN = [
  { dir: "docs", exts: [".md"] },
  { dir: "docs/raw", exts: [".md", ".docx", ".pdf", ".xlsx", ".pptx"] },
  { dir: "plans/reports", exts: [".md"] },
];

// Bỏ qua: journals là log theo session, không thuộc registry spec.
const EXCLUDE_PREFIXES = ["docs/journals/"];

function walk(dir, exts, out) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return;
  for (const name of readdirSync(abs)) {
    const full = join(abs, name);
    const rel = relative(ROOT, full);
    if (EXCLUDE_PREFIXES.some((p) => rel.startsWith(p))) continue;
    if (statSync(full).isDirectory()) {
      walk(rel, exts, out);
    } else if (exts.some((e) => name.toLowerCase().endsWith(e))) {
      out.add(rel);
    }
  }
}

function main() {
  const errors = [];

  const raw = readFileSync(join(ROOT, STATE_FILE), "utf8");
  const doc = yaml.load(raw);
  const entries = Array.isArray(doc?.docs) ? doc.docs : [];

  const registered = new Set();
  for (const [i, e] of entries.entries()) {
    const where = `docs[${i}]`;
    if (!e?.path) errors.push(`${where}: thiếu 'path'`);
    if (!e?.title) errors.push(`${where}: thiếu 'title'`);
    if (!VALID_STATES.includes(e?.state))
      errors.push(`${where} (${e?.path ?? "?"}): state '${e?.state}' không hợp lệ`);
    if (e?.path) {
      registered.add(e.path);
      if (!existsSync(join(ROOT, e.path)))
        errors.push(`dangling: '${e.path}' có trong registry nhưng file không tồn tại`);
    }
  }

  // Duplicate path.
  const seen = new Set();
  for (const e of entries) {
    if (e?.path && seen.has(e.path)) errors.push(`duplicate: '${e.path}' xuất hiện >1 lần`);
    if (e?.path) seen.add(e.path);
  }

  // File trên disk chưa đăng ký.
  const onDisk = new Set();
  for (const { dir, exts } of SCAN) walk(dir, exts, onDisk);
  onDisk.delete(STATE_FILE);
  for (const f of onDisk)
    if (!registered.has(f)) errors.push(`unregistered: '${f}' trên disk nhưng chưa có trong ${STATE_FILE}`);

  if (errors.length) {
    console.error(`docs:check FAIL — ${errors.length} vấn đề:`);
    for (const msg of errors) console.error(`  - ${msg}`);
    process.exit(1);
  }
  console.log(`docs:check OK — ${entries.length} docs đồng bộ với disk.`);
}

main();
