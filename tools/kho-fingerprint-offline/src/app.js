(() => {
  'use strict';

  const VERSION = '1.0.0';
  const SHINGLE_WORDS = 8;
  const CASEFOLD = /*CASEFOLD_TABLE*/ {};
  const PDF_LIB_B64 = /*PDF_LIB_B64*/ '';
  const PDF_WORKER_B64 = /*PDF_WORKER_B64*/ '';

  const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const NS_RID = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const NS_WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const DRIVE_ID = /^[A-Za-z0-9_-]{33}$/;
  const WORD_RE = /[\p{L}\p{N}_]+/gu;
  const CLASSES = ['A', 'B', 'C', '?'];

  class Fail extends Error {
    constructor(code, detail = '') {
      super(detail ? `${code}: ${detail}` : code);
      this.code = code;
    }
  }

  // ---- SHA-256 (no crypto.subtle: it is not available on every file:// origin) ----
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const W = new Uint32Array(64);

  function sha256Hex(bytes) {
    const len = bytes.length;
    const total = (len + 9 + 63) & ~63;
    const data = new Uint8Array(total);
    data.set(bytes);
    data[len] = 0x80;
    const view = new DataView(data.buffer);
    view.setUint32(total - 8, Math.floor((len * 8) / 0x100000000), false);
    view.setUint32(total - 4, (len * 8) >>> 0, false);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const a = W[i - 15], b = W[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7]
      .map((x) => (x >>> 0).toString(16).padStart(8, '0'))
      .join('');
  }

  // ---- Shingles: the same definition as qbd_core egress_gate.fingerprint ----
  const encoder = new TextEncoder();
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  function casefold(word) {
    let out = '';
    for (const ch of word) {
      const folded = CASEFOLD[ch.codePointAt(0)];
      out += folded !== undefined ? folded : ch.toLowerCase();
    }
    return out;
  }

  function isWordCp(cp) {
    return /^[\p{L}\p{N}_]$/u.test(String.fromCodePoint(cp));
  }

  function words(text) {
    return (text.normalize('NFC').match(WORD_RE) || []).map(casefold);
  }

  function shingleHash(window, salt) {
    const prefix = salt ? `${salt}\0` : '';
    return sha256Hex(encoder.encode(prefix + window.join(' '))).slice(0, 16);
  }

  function shingles(text, salt = '') {
    const w = words(text);
    const out = new Set();
    for (let i = 0; i + SHINGLE_WORDS <= w.length; i++) {
      out.add(shingleHash(w.slice(i, i + SHINGLE_WORDS), salt));
    }
    return out;
  }

  async function shinglesAsync(text, salt = '') {
    const w = words(text);
    const out = new Set();
    for (let i = 0; i + SHINGLE_WORDS <= w.length; i++) {
      out.add(shingleHash(w.slice(i, i + SHINGLE_WORDS), salt));
      if (i % 20000 === 19999) await tick();
    }
    return out;
  }

  // ---- ZIP (docx, xlsx) ----
  async function inflateRaw(data) {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function openZip(buffer) {
    const u8 = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Fail('E_ZIP', 'no central directory');
    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const entries = new Map();
    for (let n = 0; n < count; n++) {
      if (p + 46 > u8.length || view.getUint32(p, true) !== 0x02014b50) throw new Fail('E_ZIP', 'bad entry');
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
      entries.set(name, {
        flags: view.getUint16(p + 8, true),
        method: view.getUint16(p + 10, true),
        size: view.getUint32(p + 20, true),
        offset: view.getUint32(p + 42, true),
      });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return {
      names: [...entries.keys()],
      has: (name) => entries.has(name),
      async read(name) {
        const entry = entries.get(name);
        if (!entry) throw new Fail('E_ZIP', 'missing member');
        if (entry.flags & 1) throw new Fail('E_ZIP', 'encrypted member');
        const at = entry.offset;
        if (view.getUint32(at, true) !== 0x04034b50) throw new Fail('E_ZIP', 'bad local header');
        const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
        const raw = u8.subarray(start, start + entry.size);
        if (entry.method === 0) return raw;
        if (entry.method === 8) return inflateRaw(raw);
        throw new Fail('E_ZIP', 'unsupported compression');
      },
    };
  }

  function parseXml(bytes) {
    const doc = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(bytes), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Fail('E_XML');
    return doc;
  }

  const textOf = (node, ns, tag) =>
    Array.from(node.getElementsByTagNameNS(ns, tag), (t) => t.textContent).join('');

  // ---- Owner's table (port of kho_loader.read_table) ----
  function cellsOf(row, strings) {
    const cells = {};
    for (const cell of row.children) {
      const column = /^[A-Z]+/.exec(cell.getAttribute('r') || '');
      if (!column) continue;
      let text;
      if (cell.getAttribute('t') === 'inlineStr') {
        text = textOf(cell, NS_MAIN, 't');
      } else {
        const value = Array.from(cell.children).find((c) => c.namespaceURI === NS_MAIN && c.localName === 'v');
        if (!value || value.textContent === null) continue;
        if (cell.getAttribute('t') === 's') {
          text = strings[parseInt(value.textContent, 10)];
          if (text === undefined) throw new Fail('E_TABLE_UNREADABLE', 'shared string');
        } else {
          text = value.textContent;
        }
      }
      cells[column[0]] = text;
    }
    return cells;
  }

  async function readTable(buffer) {
    let rows;
    try {
      const zip = openZip(buffer);
      const workbook = parseXml(await zip.read('xl/workbook.xml'));
      const rels = new Map();
      for (const r of parseXml(await zip.read('xl/_rels/workbook.xml.rels')).getElementsByTagNameNS(NS_REL, 'Relationship')) {
        rels.set(r.getAttribute('Id'), r.getAttribute('Target'));
      }
      const sheet = Array.from(workbook.getElementsByTagNameNS(NS_MAIN, 'sheet')).find((s) => s.getAttribute('name') === 'Manifest');
      const target = sheet && rels.get(sheet.getAttributeNS(NS_RID, 'id'));
      if (!target) throw new Fail('E_TABLE_UNREADABLE', 'sheet');
      let strings = [];
      if (zip.has('xl/sharedStrings.xml')) {
        const shared = parseXml(await zip.read('xl/sharedStrings.xml'));
        strings = Array.from(shared.getElementsByTagNameNS(NS_MAIN, 'si'), (si) => textOf(si, NS_MAIN, 't'));
      }
      const name = target.replace(/^\/+/, '');
      const doc = parseXml(await zip.read(name.startsWith('xl/') ? name : `xl/${name}`));
      rows = Array.from(doc.getElementsByTagNameNS(NS_MAIN, 'row'), (r) => cellsOf(r, strings));
    } catch (error) {
      throw new Fail('E_TABLE_UNREADABLE', error instanceof Fail ? error.code : 'unreadable');
    }
    const header = rows.find((r) => Object.values(r).includes('file_id'));
    if (!header) throw new Fail('E_TABLE_HEADER');
    const column = {};
    for (const [k, v] of Object.entries(header)) column[v] = k;
    if (!('file_id' in column && 'file_name' in column && 'nhom' in column)) throw new Fail('E_TABLE_HEADER');
    const table = [];
    for (const r of rows.slice(rows.indexOf(header) + 1)) {
      const fileId = r[column.file_id] || '';
      if (!fileId) continue;
      if (!DRIVE_ID.test(fileId)) throw new Fail('E_TABLE_ID', 'a file_id is not a Drive id');
      table.push({ fileId, fileName: r[column.file_name] || '', group: r[column.nhom] || '' });
    }
    const ids = table.map((t) => t.fileId);
    if (!table.length || new Set(ids).size !== ids.length) throw new Fail('E_TABLE_ID', 'empty table or repeated file_id');
    return table;
  }

  // ---- Manifest (port of egress_gate.manifest.try_load_manifest) ----
  const ENTRY_KEYS = new Set(['file_id', 'classification', 'approved_by', 'approved_on', 'shingles']);

  function parseManifest(text) {
    let raw;
    try { raw = JSON.parse(text.replace(/^﻿/, '')); } catch { return null; }
    const plain = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
    if (!plain(raw) || !Array.isArray(raw.entries)) return null;
    if (Object.keys(raw).some((k) => k !== 'entries' && k !== 'salt')) return null;
    if (raw.salt !== undefined && typeof raw.salt !== 'string') return null;
    const entries = [];
    for (const e of raw.entries) {
      if (!plain(e) || Object.keys(e).some((k) => !ENTRY_KEYS.has(k))) return null;
      if (typeof e.file_id !== 'string' || !e.file_id || !CLASSES.includes(e.classification)) return null;
      for (const k of ['approved_by', 'approved_on']) {
        if (e[k] !== undefined && e[k] !== null && typeof e[k] !== 'string') return null;
      }
      if (e.shingles !== undefined && !(Array.isArray(e.shingles) && e.shingles.every((s) => typeof s === 'string'))) return null;
      entries.push({
        file_id: e.file_id,
        classification: e.classification,
        approved_by: e.approved_by ?? null,
        approved_on: e.approved_on ?? null,
        shingles: [...new Set(e.shingles || [])].sort(),
      });
    }
    if (new Set(entries.map((e) => e.file_id)).size !== entries.length) return null;
    return { entries, salt: raw.salt || '' };
  }

  // ---- Text from the downloaded files (port of kho_loader.build_documents) ----
  let pdfjsPromise = null;

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function loadPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = (async () => {
        if (!PDF_LIB_B64 || !PDF_WORKER_B64) throw new Fail('E_TOOL_MISSING', 'pdf reader not built in');
        const lib = URL.createObjectURL(new Blob([b64ToBytes(PDF_LIB_B64)], { type: 'text/javascript' }));
        const worker = URL.createObjectURL(new Blob([b64ToBytes(PDF_WORKER_B64)], { type: 'text/javascript' }));
        const pdfjs = await import(lib);
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        return pdfjs;
      })();
    }
    return pdfjsPromise;
  }

  async function pdfPages(bytes) {
    const pdfjs = await loadPdfjs();
    try {
      const doc = await pdfjs.getDocument({
        data: bytes.slice(), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0,
      }).promise;
      const pages = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((it) => (it.str || '') + (it.hasEOL ? '\n' : '')).join(''));
        page.cleanup();
      }
      await doc.destroy();
      return pages;
    } catch {
      return [];
    }
  }

  async function docxPages(bytes) {
    try {
      const body = parseXml(await openZip(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)).read('word/document.xml'));
      const paragraphs = Array.from(body.getElementsByTagNameNS(NS_WORD, 'p'), (p) => textOf(p, NS_WORD, 't'));
      return [paragraphs.join('\n')];
    } catch {
      return [];
    }
  }

  const EXTRACTORS = { '.pdf': pdfPages, '.docx': docxPages };

  function suffixOf(name) {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot).toLowerCase() : '';
  }

  async function buildDocuments(files, table, known, groups, onProgress = () => {}) {
    for (const row of table) {
      if (known.get(row.fileId) !== row.group) throw new Fail('E_TABLE_MISMATCH', 'a row differs from the manifest');
    }
    const byName = new Map();
    for (const f of files) {
      const key = f.name.normalize('NFC');
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(f);
    }
    const documents = [];
    const skipped = new Map();
    const wanted = [...table].sort((a, b) => (a.fileId < b.fileId ? -1 : a.fileId > b.fileId ? 1 : 0)).filter((r) => groups.includes(r.group));
    let done = 0;
    for (const row of wanted) {
      onProgress(done++, wanted.length);
      const found = byName.get(row.fileName.normalize('NFC')) || [];
      if (found.length !== 1) { skipped.set(row.fileId, found.length ? 'ambiguous_name' : 'not_found'); continue; }
      const extract = EXTRACTORS[suffixOf(found[0].name)];
      if (!extract) { skipped.set(row.fileId, 'unsupported_type'); continue; }
      const pages = await extract(new Uint8Array(await found[0].arrayBuffer()));
      if (!pages.some((p) => p.trim())) { skipped.set(row.fileId, 'no_text'); continue; }
      documents.push({ file_id: row.fileId, classification: row.group, pages });
      await tick();
    }
    return { documents, skipped };
  }

  // ---- The fingerprint run (port of run.kho_fingerprint) ----
  const count = (items) => items.reduce((acc, x) => ((acc[x] = (acc[x] || 0) + 1), acc), {});
  const sortedObject = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : 1)));

  async function fingerprint({ folderFiles, tableFile, manifestFile, classes, salt, onProgress }) {
    if (classes.includes('A')) throw new Fail('REFUSED', 'class A files are not fingerprinted');
    if (!classes.length) throw new Fail('REFUSED', 'no class chosen');
    const manifest = manifestFile ? parseManifest(await manifestFile.text()) : null;
    if (!manifest) throw new Fail('REFUSED', 'the manifest is missing or unreadable');
    if (!tableFile) throw new Fail('E_TABLE_UNREADABLE', 'no table chosen');
    const known = new Map(manifest.entries.map((e) => [e.file_id, e.classification]));
    const table = await readTable(await tableFile.arrayBuffer());
    const loaded = await buildDocuments(folderFiles, table, known, classes, onProgress);
    const hashes = new Map();
    const pages = new Map();
    for (const d of loaded.documents) {
      hashes.set(d.file_id, [...(await shinglesAsync(d.pages.join(' '), salt))].sort());
      pages.set(d.file_id, d.pages);
    }
    const entries = manifest.entries.map((e) => ({
      file_id: e.file_id,
      classification: e.classification,
      approved_by: e.approved_by,
      approved_on: e.approved_on,
      shingles: hashes.has(e.file_id) ? hashes.get(e.file_id) : e.shingles,
    }));
    const text = `${JSON.stringify({ entries, salt }, null, 1)}\n`;
    const bytes = encoder.encode(text);
    const byClass = count([...hashes.keys()].map((id) => known.get(id)));
    const unmatched = table.filter((r) => classes.includes(r.group) && !hashes.has(r.fileId)).length;
    return {
      text,
      bytes,
      sha256: sha256Hex(bytes),
      manifest: { entries, salt },
      pages,
      report: {
        fingerprinted: hashes.size,
        byClass: sortedObject(byClass),
        empty: [...hashes.values()].filter((h) => !h.length).length,
        skipped: loaded.skipped.size,
        skippedReasons: sortedObject(count([...loaded.skipped.values()])),
        notFingerprinted: unmatched,
        wanted: table.filter((r) => classes.includes(r.group)).length,
      },
    };
  }

  // ---- Egress check (port of egress_gate.policy.check_egress, text and source rules) ----
  function checkEgress(manifest, destination, parts) {
    if (destination === 'local') return { allowed: true, reasons: [] };
    if (!manifest) return { allowed: false, reasons: [{ code: 'E_MANIFEST_MISSING' }] };
    const banned = new Set();
    for (const e of manifest.entries) if (e.classification !== 'A') for (const h of e.shingles) banned.add(h);
    const reasons = [];
    parts.forEach((part, index) => {
      if (part.kind === 'evidence') {
        const ids = part.source_ids || [];
        if (!ids.length) reasons.push({ code: 'E_PART_UNATTRIBUTED', part_index: index });
        for (const id of ids) {
          const entry = manifest.entries.find((e) => e.file_id === id);
          let code = null;
          if (!entry) code = 'E_SOURCE_UNKNOWN';
          else if (entry.classification !== 'A') code = 'E_SOURCE_RESTRICTED';
          else if (!(entry.approved_by && entry.approved_on)) code = 'E_SOURCE_UNAPPROVED';
          if (code) reasons.push({ code, part_index: index, source_id: id });
        }
      }
      for (const h of shingles(part.text, manifest.salt || '')) {
        if (banned.has(h)) { reasons.push({ code: 'E_RESTRICTED_TEXT', part_index: index }); break; }
      }
    });
    return { allowed: !reasons.length, reasons };
  }

  // ---- Leak trap built from the text just read ----
  const SAFE_LINES = [
    'Hôm nay trời nắng đẹp và chúng tôi đi dạo quanh hồ để bàn chuyện khác hoàn toàn khác biệt',
    'The quick brown fox jumps over the lazy dog while nobody is watching the quiet river bank',
    'Danh mục này liệt kê các hạng mục kiểm tra chung cho cuộc họp định kỳ của tuần sau đó',
  ];
  const KINDS = ['instruction', 'intake', 'evidence'];

  function trapPayloads(pages) {
    const flat = pages.join(' ');
    const w = (flat.normalize('NFC').match(WORD_RE) || []);
    if (w.length < SHINGLE_WORDS) return [];
    const slice = (from, n) => w.slice(from, from + n).join(' ');
    const mid = Math.max(0, Math.floor(w.length / 2) - 30);
    const traps = [
      ['window', slice(0, SHINGLE_WORDS)],
      ['long', slice(mid, 60)],
      ['embedded', `${SAFE_LINES[0]}. ${slice(Math.max(0, w.length - SHINGLE_WORDS), SHINGLE_WORDS)}. ${SAFE_LINES[1]}`],
      ['upper', slice(mid, 20).toUpperCase()],
      ['decomposed', slice(mid, 20).normalize('NFD')],
    ];
    for (let i = 0; i + 1 < pages.length; i++) {
      const left = (pages[i].normalize('NFC').match(WORD_RE) || []);
      const right = (pages[i + 1].normalize('NFC').match(WORD_RE) || []);
      if (left.length >= 4 && right.length >= 4) {
        traps.push(['cross_page', `${left.slice(-4).join(' ')} ${right.slice(0, 4).join(' ')}`]);
        break;
      }
    }
    return traps;
  }

  function controlPayloads(pages) {
    const w = (pages.join(' ').normalize('NFC').match(WORD_RE) || []);
    const controls = SAFE_LINES.map((t) => ['unrelated', t]);
    if (w.length >= SHINGLE_WORDS) controls.push(['reversed', w.slice(0, 40).reverse().join(' ')]);
    return controls;
  }

  function sourceForEvidence(manifest) {
    const a = manifest.entries.find((e) => e.classification === 'A' && e.approved_by && e.approved_on);
    return a ? a.file_id : null;
  }

  function partFor(kind, text, source) {
    return kind === 'evidence' ? { kind, text, source_ids: [source] } : { kind, text };
  }

  function runTrap(result) {
    const { manifest, pages } = result;
    const empty = { entries: manifest.entries.map((e) => ({ ...e, shingles: [] })), salt: manifest.salt };
    const source = sourceForEvidence(manifest);
    const kinds = source ? KINDS : KINDS.filter((k) => k !== 'evidence');
    const out = { traps: 0, blocked: 0, leaked: 0, controls: 0, controlsAllowed: 0, baselineLeaked: 0, noEvidenceSource: !source, docs: 0 };
    for (const [id, docPages] of pages) {
      const entry = manifest.entries.find((e) => e.file_id === id);
      if (!entry || entry.classification === 'A') continue;
      const traps = trapPayloads(docPages);
      if (!traps.length) continue;
      out.docs++;
      for (const [, text] of traps) {
        for (const kind of kinds) {
          const part = [partFor(kind, text, source)];
          const blocked = checkEgress(manifest, 'remote', part).reasons.some((r) => r.code === 'E_RESTRICTED_TEXT');
          const leakedInBaseline = !checkEgress(empty, 'remote', part).reasons.some((r) => r.code === 'E_RESTRICTED_TEXT');
          out.traps++;
          if (blocked) out.blocked++; else out.leaked++;
          if (leakedInBaseline) out.baselineLeaked++;
        }
      }
      for (const [, text] of controlPayloads(docPages)) {
        for (const kind of kinds) {
          out.controls++;
          if (!checkEgress(manifest, 'remote', [partFor(kind, text, source)]).reasons.some((r) => r.code === 'E_RESTRICTED_TEXT')) out.controlsAllowed++;
        }
      }
    }
    out.pass = out.traps > 0 && out.leaked === 0 && out.controlsAllowed === out.controls && out.baselineLeaked === out.traps;
    return out;
  }

  function trapReport(result, trap) {
    const r = result.report;
    const lines = [
      `Công cụ: kho-fingerprint-offline ${VERSION}`,
      `SHA-256 fingerprints.json: ${result.sha256}`,
      `Salt: ${result.manifest.salt ? 'có' : 'không'}`,
      `Đã băm: ${r.fingerprinted} tài liệu ${JSON.stringify(r.byClass)}, ${r.empty} rỗng (dưới ${SHINGLE_WORDS} từ)`,
      `Bỏ qua: ${r.skipped} ${JSON.stringify(r.skippedReasons)}`,
      `Dòng B/C trong bảng chưa có hash: ${r.notFingerprinted}/${r.wanted}`,
      `Bẫy: tổng ${trap.traps}, bị chặn ${trap.blocked}, rò rỉ ${trap.leaked} (trên ${trap.docs} tài liệu)`,
      `Đối chứng văn bản không liên quan: ${trap.controlsAllowed}/${trap.controls} được phép`,
      `Đối chứng băm rỗng: ${trap.baselineLeaked}/${trap.traps} bẫy lọt (phải bằng tổng bẫy)`,
      trap.noEvidenceSource ? 'Ghi chú: không có nguồn nhóm A đã duyệt, bỏ qua loại evidence' : 'Loại bẫy: instruction, intake, evidence',
      `Phạm vi: chỉ trùng nguyên văn từ ${SHINGLE_WORDS} từ trở lên; không bắt diễn đạt lại`,
      `Kết quả bẫy: ${trap.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}`,
      r.notFingerprinted ? `G-03 chưa đóng: còn ${r.notFingerprinted} dòng B/C chưa được băm` : 'Mọi dòng B/C trong bảng đã có hash',
    ];
    return `${lines.join('\n')}\n`;
  }

  // ---- Page ----
  function describe(error) {
    if (error instanceof Fail) return `${error.code}${error.message !== error.code ? ` (${error.message.replace(`${error.code}: `, '')})` : ''}`;
    return 'Lỗi không xác định';
  }

  function initPage() {
    const $ = (id) => document.getElementById(id);
    const state = { result: null, trap: null };
    const link = (id, name, data, type) => {
      const a = $(id);
      if (a.dataset.url) URL.revokeObjectURL(a.dataset.url);
      a.dataset.url = URL.createObjectURL(new Blob([data], { type }));
      a.href = a.dataset.url;
      a.download = name;
      a.hidden = false;
    };
    $('go').addEventListener('click', async () => {
      const status = $('status');
      $('dl-fp').hidden = true; $('dl-trap').hidden = true; $('trap-box').hidden = true; $('out').textContent = '';
      state.result = null;
      $('go').disabled = true;
      try {
        status.textContent = 'Đang xử lý…';
        const classes = $('classes').value.split(',').map((c) => c.trim()).filter(Boolean);
        const result = await fingerprint({
          folderFiles: Array.from($('folder').files),
          tableFile: $('table').files[0],
          manifestFile: $('manifest').files[0],
          classes,
          salt: $('salt').value,
          onProgress: (i, n) => { status.textContent = `Đang xử lý ${i + 1}/${n}…`; },
        });
        state.result = result;
        const r = result.report;
        $('out').textContent =
          `Đã băm ${r.fingerprinted} tài liệu ${JSON.stringify(r.byClass)}, ${r.empty} rỗng\n` +
          `Bỏ qua ${r.skipped} ${JSON.stringify(r.skippedReasons)}\n` +
          `Dòng trong bảng chưa có hash: ${r.notFingerprinted}/${r.wanted}\n` +
          `SHA-256 fingerprints.json: ${result.sha256}`;
        link('dl-fp', 'fingerprints.json', result.bytes, 'application/json');
        $('trap-box').hidden = false;
        status.textContent = 'Xong. Tải file hash xuống rồi chạy bẫy rò rỉ.';
      } catch (error) {
        status.textContent = `Dừng, không ghi gì: ${describe(error)}`;
      } finally {
        $('go').disabled = false;
      }
    });
    $('run-trap').addEventListener('click', () => {
      if (!state.result) return;
      state.trap = runTrap(state.result);
      const text = trapReport(state.result, state.trap);
      $('trap-out').textContent = text;
      link('dl-trap', 'g-03-trap-report.txt', text, 'text/plain');
    });
  }

  window.KhoFp = {
    VERSION, Fail, sha256Hex, casefold, isWordCp, words, shingles, shinglesAsync, openZip, readTable,
    parseManifest, buildDocuments, fingerprint, checkEgress, trapPayloads, runTrap, trapReport, loadPdfjs, pdfPages,
  };
  if (document.getElementById('go')) initPage();
})();
