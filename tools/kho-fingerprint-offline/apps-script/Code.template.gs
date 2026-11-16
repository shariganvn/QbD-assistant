/**
 * Kho fingerprint, Google Apps Script edition.
 *
 * Reads the class B and C files of the Kho from Drive, computes the same word-window hashes as
 * `python -m qbd_core kho-fingerprint` and the offline page, and writes them into a Drive folder.
 * Nothing is downloaded to a computer and the project holds no scope that can reach outside Google
 * (see appsscript.json: no external_request scope). Text of the files only lives in memory and in
 * temporary Google Docs that are deleted right after reading.
 *
 * Steps: see README.md next to this file. Run selfTest, pilot, then runBatch until it says done,
 * then finalize.
 */

const CONFIG = {
  TABLE_SHEET_ID: '', // Google Sheet made from kho-manifest-phan-loai.xlsx (sheet "Manifest")
  MANIFEST_FILE_ID: '', // docs/kho/manifest.json uploaded to Drive
  OUT_FOLDER_NAME: 'kho-fingerprints',
  CLASSES: ['B', 'C'],
  SALT: '',
  BATCH_SECONDS: 270,
  OCR_LANGUAGE: 'vi',
  MAX_BYTES: 50 * 1024 * 1024, // larger files are not sent to Google's converter: reason too_large
  RETRY_REASONS: ['unsupported_type', 'convert_failed', 'zip_limits'], // cleared by reprocess()
  ZIP_MAX_DEPTH: 3,
  ZIP_MAX_MEMBERS: 2000,
  ZIP_MAX_BYTES: 100 * 1024 * 1024, // total unpacked size of one archive
};

const SHINGLE_WORDS = 8;
const CASEFOLD = /*CASEFOLD_TABLE*/ {};
const DRIVE_ID = /^[A-Za-z0-9_-]{33}$/;
const WORD_RE = /[\p{L}\p{N}_]+/gu;
const CLASS_NAMES = ['A', 'B', 'C', '?'];
const TMP_PREFIX = '__kho_tmp__';
const MIME_DOC = 'application/vnd.google-apps.document';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// Converted by Google (PDF and images through OCR); the Office formats above are read directly.
const MIME_CONVERTIBLE = ['application/pdf', 'application/msword', 'image/png', 'image/jpeg'];
const MIME_ZIP = ['application/zip', 'application/x-zip-compressed', 'application/x-zip'];
const MIME_BINARY = ['application/vnd.ms-excel', 'application/octet-stream'];
const TEXT_EXT = ['txt', 'md', 'csv', 'tsv', 'json', 'xml', 'html', 'htm', 'css', 'js', 'r', 'rd',
  'rmd', 'py', 'bat', 'sh', 'ini', 'cfg', 'yml', 'yaml', 'log', 'tex', 'm', 'sql'];
// Not read inside archives: pictures, compiled code, fonts and data blobs carry no prose.
const SKIP_EXT = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'svg', 'exe', 'dll', 'so', 'dylib',
  'pyc', 'class', 'jar', 'o', 'obj', 'bin', 'dat', 'rds', 'rdata', 'mp3', 'mp4', 'woff', 'woff2',
  'ttf', 'otf'];
const MIME_BY_EXT = { pdf: 'application/pdf', doc: 'application/msword' };

class Fail_ extends Error {
  constructor(code, detail) {
    super(detail ? code + ': ' + detail : code);
    this.code = code;
  }
}

// ---- SHA-256 and shingles: the same definition as qbd_core egress_gate.fingerprint ----
const K_ = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const W_ = new Uint32Array(64);

function utf8Bytes_(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.codePointAt(i);
    if (c > 0xffff) i++;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function sha256Hex_(bytes) {
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
    for (let i = 0; i < 16; i++) W_[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const a = W_[i - 15], b = W_[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      W_[i] = (W_[i - 16] + s0 + W_[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K_[i] + W_[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(function (x) { return (x >>> 0).toString(16).padStart(8, '0'); })
    .join('');
}

function casefold_(word) {
  let out = '';
  for (const ch of word) {
    const folded = CASEFOLD[ch.codePointAt(0)];
    out += folded !== undefined ? folded : ch.toLowerCase();
  }
  return out;
}

function words_(text) {
  return (text.normalize('NFC').match(WORD_RE) || []).map(casefold_);
}

function shinglesOf_(text, salt) {
  const w = words_(text);
  const prefix = salt ? salt + '\0' : '';
  const out = {};
  for (let i = 0; i + SHINGLE_WORDS <= w.length; i++) {
    out[sha256Hex_(utf8Bytes_(prefix + w.slice(i, i + SHINGLE_WORDS).join(' '))).slice(0, 16)] = 1;
  }
  return Object.keys(out).sort();
}

// ---- Inputs: the owner's table and the manifest ----
function parseManifest_(text) {
  let raw;
  try { raw = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { return null; }
  const plain = function (x) { return x !== null && typeof x === 'object' && !Array.isArray(x); };
  if (!plain(raw) || !Array.isArray(raw.entries)) return null;
  if (Object.keys(raw).some(function (k) { return k !== 'entries' && k !== 'salt'; })) return null;
  const keys = ['file_id', 'classification', 'approved_by', 'approved_on', 'shingles'];
  const entries = [];
  const seen = {};
  for (const e of raw.entries) {
    if (!plain(e) || Object.keys(e).some(function (k) { return keys.indexOf(k) < 0; })) return null;
    if (typeof e.file_id !== 'string' || !e.file_id || CLASS_NAMES.indexOf(e.classification) < 0) return null;
    if (seen[e.file_id]) return null;
    seen[e.file_id] = 1;
    entries.push({
      file_id: e.file_id,
      classification: e.classification,
      approved_by: e.approved_by === undefined ? null : e.approved_by,
      approved_on: e.approved_on === undefined ? null : e.approved_on,
      shingles: (e.shingles || []).slice().sort(),
    });
  }
  return entries;
}

function tableRows_(values) {
  const header = values.find(function (r) { return r.indexOf('file_id') >= 0; });
  if (!header) throw new Fail_('E_TABLE_HEADER');
  const col = {};
  header.forEach(function (v, i) { col[v] = i; });
  if (!('file_id' in col && 'file_name' in col && 'nhom' in col)) throw new Fail_('E_TABLE_HEADER');
  const rows = [];
  for (const r of values.slice(values.indexOf(header) + 1)) {
    const fileId = r[col.file_id] || '';
    if (!fileId) continue;
    if (!DRIVE_ID.test(fileId)) throw new Fail_('E_TABLE_ID', 'a file_id is not a Drive id');
    rows.push({ fileId: fileId, fileName: r[col.file_name] || '', group: r[col.nhom] || '' });
  }
  const ids = rows.map(function (r) { return r.fileId; });
  const unique = {};
  ids.forEach(function (i) { unique[i] = 1; });
  if (!rows.length || Object.keys(unique).length !== ids.length) {
    throw new Fail_('E_TABLE_ID', 'empty table or repeated file_id');
  }
  return rows;
}

function loadInputs_() {
  if (!CONFIG.TABLE_SHEET_ID || !CONFIG.MANIFEST_FILE_ID) {
    throw new Fail_('REFUSED', 'fill TABLE_SHEET_ID and MANIFEST_FILE_ID in CONFIG');
  }
  if (CONFIG.CLASSES.indexOf('A') >= 0 || !CONFIG.CLASSES.length) {
    throw new Fail_('REFUSED', 'class A files are not fingerprinted');
  }
  const entries = parseManifest_(DriveApp.getFileById(CONFIG.MANIFEST_FILE_ID).getBlob().getDataAsString('UTF-8'));
  if (!entries) throw new Fail_('REFUSED', 'the manifest is missing or unreadable');
  const sheet = SpreadsheetApp.openById(CONFIG.TABLE_SHEET_ID).getSheetByName('Manifest');
  if (!sheet) throw new Fail_('E_TABLE_UNREADABLE', 'sheet Manifest');
  const rows = tableRows_(sheet.getDataRange().getValues().map(function (r) {
    return r.map(function (v) { return String(v); });
  }));
  const known = {};
  entries.forEach(function (e) { known[e.file_id] = e.classification; });
  rows.forEach(function (r) {
    if (known[r.fileId] !== r.group) throw new Fail_('E_TABLE_MISMATCH', 'a row differs from the manifest');
  });
  return { entries: entries, rows: rows, known: known };
}

// ---- Text from Drive ----
function convertBlob_(blob, tag, tmpFolderId, fileId) {
  // Google converts the blob to a Google Doc (PDF and pictures through OCR). When a first attempt
  // fails it is repeated without the language hint, and for a Drive file through a plain copy.
  const resource = { name: TMP_PREFIX + tag, mimeType: MIME_DOC, parents: [tmpFolderId] };
  const attempts = [
    function () { return Drive.Files.create(resource, blob, { ocrLanguage: CONFIG.OCR_LANGUAGE }); },
    function () { return Drive.Files.create(resource, blob, {}); },
  ];
  if (fileId) attempts.push(function () { return Drive.Files.copy(resource, fileId); });
  let lastError = null;
  for (const attempt of attempts) {
    let tmpId = null;
    try {
      tmpId = attempt().id;
      return DocumentApp.openById(tmpId).getBody().getText();
    } catch (e) {
      lastError = e;
    } finally {
      if (tmpId) {
        try { Drive.Files.remove(tmpId); } catch (e) { /* cleanupTemp removes leftovers */ }
      }
    }
  }
  throw lastError;
}

function convertAndRead_(file, tmpFolderId) {
  return convertBlob_(file.getBlob(), file.getId(), tmpFolderId, file.getId());
}

// ---- Office files read straight from their XML (no Google conversion) ----
function xmlText_(raw) {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, function (m, t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); })
    .replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, function (m, e) {
      if (e === 'amp') return '&';
      if (e === 'lt') return '<';
      if (e === 'gt') return '>';
      if (e === 'quot') return '"';
      if (e === 'apos') return "'";
      return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    });
}

// Text of every <ns:p> paragraph in document order; a paragraph holds the text of all <ns:t>
// below it, nested paragraphs included, as an XML tree walk would give.
function paragraphs_(xml, ns) {
  const token = new RegExp('<(/?)' + ns + ':(p|t)(?=[\\s/>])[^>]*?(/?)>', 'g');
  const out = [];
  const open = [];
  let inText = false, start = 0, m;
  const addText = function (txt) { open.forEach(function (i) { out[i] += txt; }); };
  while ((m = token.exec(xml)) !== null) {
    if (inText) { addText(xmlText_(xml.slice(start, m.index))); inText = false; }
    const closing = m[1] === '/', selfClosing = m[3] === '/';
    if (m[2] === 'p') {
      if (closing) open.pop();
      else {
        out.push('');
        if (!selfClosing) open.push(out.length - 1);
      }
    } else if (!closing && !selfClosing) {
      inText = true;
      start = token.lastIndex;
    }
  }
  return out;
}

function zipMembers_(blob) {
  const parts = {};
  Utilities.unzip(blob.setContentType('application/zip')).forEach(function (b) {
    parts[b.getName()] = b;
  });
  return parts;
}

function numbered_(names, re) {
  return names.filter(function (n) { return re.test(n); }).sort(function (a, b) {
    return parseInt(a.match(/(\d+)\.xml$/)[1], 10) - parseInt(b.match(/(\d+)\.xml$/)[1], 10);
  });
}

function docxText_(blob) {
  const parts = zipMembers_(blob);
  if (!parts['word/document.xml']) throw new Fail_('E_NO_BODY');
  return paragraphs_(parts['word/document.xml'].getDataAsString('UTF-8'), 'w').join('\n');
}

function pptxText_(blob) {
  const parts = zipMembers_(blob);
  const names = Object.keys(parts);
  const pages = numbered_(names, /^ppt\/slides\/slide\d+\.xml$/).map(function (n) {
    return paragraphs_(parts[n].getDataAsString('UTF-8'), 'a').join('\n');
  });
  const notes = numbered_(names, /^ppt\/notesSlides\/notesSlide\d+\.xml$/).map(function (n) {
    return paragraphs_(parts[n].getDataAsString('UTF-8'), 'a').join('\n');
  });
  return pages.concat(notes).join('\n');
}

function xlsxText_(blob) {
  const parts = zipMembers_(blob);
  const texts = [];
  const strings = parts['xl/sharedStrings.xml'];
  if (strings) {
    (strings.getDataAsString('UTF-8').match(/<si\b[\s\S]*?<\/si>/g) || []).forEach(function (si) {
      const t = (si.match(/<t(?=[\s>])[^>]*>[\s\S]*?<\/t>/g) || []).map(function (x) {
        return xmlText_(x.replace(/^<t[^>]*>/, '').replace(/<\/t>$/, ''));
      });
      texts.push(t.join(''));
    });
  }
  numbered_(Object.keys(parts), /^xl\/worksheets\/sheet\d+\.xml$/).forEach(function (n) {
    (parts[n].getDataAsString('UTF-8').match(/<is>[\s\S]*?<\/is>/g) || []).forEach(function (is) {
      texts.push((is.match(/<t(?=[\s>])[^>]*>[\s\S]*?<\/t>/g) || []).map(function (x) {
        return xmlText_(x.replace(/^<t[^>]*>/, '').replace(/<\/t>$/, ''));
      }).join(''));
    });
  });
  return texts.join('\n');
}

// Printable runs of a binary file (Word 97 text, Excel add-ins, executables): 8-bit runs of six or
// more characters first, then UTF-16LE runs whose characters are in the Latin-1 range. The result
// is lower fidelity than a real parser and is reported as method "strings".
function stringsText_(blob) {
  const raw = blob.getDataAsString('ISO-8859-1');
  const eight = raw.match(/[\x20-\x7e\xa1-\xff\t]{6,}/g) || [];
  const wide = (raw.match(/(?:[\x20-\x7e\xa1-\xff]\x00){6,}/g) || []).map(function (r) {
    return r.replace(/\x00/g, '');
  });
  return eight.concat(wide).join('\n');
}

function extOf_(name) {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

function memberText_(m, ext, tmpFolderId, depth, budget) {
  if (TEXT_EXT.indexOf(ext) >= 0) return m.getDataAsString('UTF-8');
  if (SKIP_EXT.indexOf(ext) >= 0) return '';
  try {
    if (ext === 'docx') return docxText_(m);
    if (ext === 'pptx') return pptxText_(m);
    if (ext === 'xlsx') return xlsxText_(m);
    if (ext === 'zip') return zipText_(m, tmpFolderId, depth + 1, budget);
    if (MIME_BY_EXT[ext]) {
      return convertBlob_(m.setContentType(MIME_BY_EXT[ext]), 'z' + budget.n++, tmpFolderId, null);
    }
    return stringsText_(m);
  } catch (e) {
    if (e instanceof Fail_) throw e;
    budget.failed++;
    return '';
  }
}

function zipText_(blob, tmpFolderId, depth, budget) {
  if (depth > CONFIG.ZIP_MAX_DEPTH) throw new Fail_('zip_limits', 'depth');
  const members = Utilities.unzip(blob.setContentType('application/zip'));
  budget.members += members.length;
  if (budget.members > CONFIG.ZIP_MAX_MEMBERS) throw new Fail_('zip_limits', 'members');
  const out = [];
  members.forEach(function (m) {
    budget.bytes += m.getBytes().length;
    if (budget.bytes > CONFIG.ZIP_MAX_BYTES) throw new Fail_('zip_limits', 'bytes');
    const ext = extOf_(m.getName());
    budget.ext[ext] = (budget.ext[ext] || 0) + 1;
    out.push(memberText_(m, ext, tmpFolderId, depth, budget));
  });
  return out.join('\n');
}

function newBudget_() {
  return { bytes: 0, members: 0, failed: 0, n: 0, ext: {} };
}

function extractText_(file, tmpFolderId) {
  // Returns { text, how } or null for a type that is not read.
  const mime = file.getMimeType();
  if (mime === MIME_DOC) {
    return { text: DocumentApp.openById(file.getId()).getBody().getText(), how: 'docs' };
  }
  if (mime === MIME_DOCX) {
    try { return { text: docxText_(file.getBlob()), how: 'xml' }; } catch (e) {
      return { text: convertAndRead_(file, tmpFolderId), how: 'converted' };
    }
  }
  if (mime === MIME_PPTX) return { text: pptxText_(file.getBlob()), how: 'xml' };
  if (mime === MIME_XLSX) return { text: xlsxText_(file.getBlob()), how: 'xml' };
  if (mime === 'application/msword') {
    try { return { text: convertAndRead_(file, tmpFolderId), how: 'converted' }; } catch (e) {
      return { text: stringsText_(file.getBlob()), how: 'strings' };
    }
  }
  if (MIME_CONVERTIBLE.indexOf(mime) >= 0) {
    return { text: convertAndRead_(file, tmpFolderId), how: 'converted' };
  }
  if (MIME_ZIP.indexOf(mime) >= 0) {
    return { text: zipText_(file.getBlob(), tmpFolderId, 1, newBudget_()), how: 'zip' };
  }
  if (MIME_BINARY.indexOf(mime) >= 0) return { text: stringsText_(file.getBlob()), how: 'strings' };
  return null;
}

// ---- Leak trap on the text just read: the same shapes as the offline page ----
const SAFE_LINES_ = [
  'Hôm nay trời nắng đẹp và chúng tôi đi dạo quanh hồ để bàn chuyện khác hoàn toàn khác biệt',
  'The quick brown fox jumps over the lazy dog while nobody is watching the quiet river bank',
  'Danh mục này liệt kê các hạng mục kiểm tra chung cho cuộc họp định kỳ của tuần sau đó',
];

function trapPayloads_(text) {
  const w = text.normalize('NFC').match(WORD_RE) || [];
  if (w.length < SHINGLE_WORDS) return [];
  const slice = function (from, n) { return w.slice(from, from + n).join(' '); };
  const mid = Math.max(0, Math.floor(w.length / 2) - 30);
  return [
    slice(0, SHINGLE_WORDS),
    slice(mid, 60),
    SAFE_LINES_[0] + '. ' + slice(Math.max(0, w.length - SHINGLE_WORDS), SHINGLE_WORDS) + '. ' + SAFE_LINES_[1],
    slice(mid, 20).toUpperCase(),
    slice(mid, 20).normalize('NFD'),
  ];
}

function runTrap_(text, hashes, salt) {
  const own = {};
  hashes.forEach(function (h) { own[h] = 1; });
  const blocks = function (payload) {
    return shinglesOf_(payload, salt).some(function (h) { return own[h]; });
  };
  const traps = trapPayloads_(text);
  const blocked = traps.filter(blocks).length;
  const controls = SAFE_LINES_.length;
  const allowed = SAFE_LINES_.filter(function (t) { return !blocks(t); }).length;
  return { traps: traps.length, blocked: blocked, controls: controls, allowed: allowed };
}

// ---- Output folder and progress ----
function outFolder_() {
  const found = DriveApp.getFoldersByName(CONFIG.OUT_FOLDER_NAME);
  return found.hasNext() ? found.next() : DriveApp.createFolder(CONFIG.OUT_FOLDER_NAME);
}

function replaceFile_(folder, name, text) {
  const old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  return folder.createFile(name, text, 'application/json');
}

function loadProgress_(folder) {
  const found = folder.getFilesByName('progress.json');
  return found.hasNext() ? JSON.parse(found.next().getBlob().getDataAsString('UTF-8')) : {};
}

function fingerprintOne_(row, ctx) {
  let file;
  try { file = DriveApp.getFileById(row.fileId); } catch (e) { return { s: 'skip', r: 'not_found' }; }
  if (file.getName().normalize('NFC') !== row.fileName.normalize('NFC')) return { s: 'skip', r: 'name_differs' };
  if (file.getSize() > CONFIG.MAX_BYTES) return { s: 'skip', r: 'too_large' };
  let got;
  try {
    got = extractText_(file, ctx.folder.getId());
  } catch (e) {
    if (e instanceof Fail_ && e.code === 'zip_limits') return { s: 'skip', r: 'zip_limits' };
    return { s: 'skip', r: 'convert_failed' };
  }
  if (got === null) return { s: 'skip', r: 'unsupported_type' };
  const text = got.text;
  if (!/\S/.test(text)) return { s: 'skip', r: 'no_text' };
  const hashes = shinglesOf_(text, CONFIG.SALT);
  if (ctx.dryRun) {
    return { s: 'ok', n: hashes.length, words: words_(text).length, chars: text.length, h: got.how };
  }
  replaceFile_(ctx.folder, row.fileId + '.json', JSON.stringify({
    file_id: row.fileId, classification: row.group, shingles: hashes,
  }));
  const trap = runTrap_(text, hashes, CONFIG.SALT);
  return { s: 'ok', n: hashes.length, h: got.how, t: trap.traps, b: trap.blocked, c: trap.controls, a: trap.allowed };
}

// ---- Entry points ----
function selfTest() {
  const text = 'Quy trình nội bộ mô tả bước nghiền trộn bột siêu mịn trước khi dập viên Straße ﬁne';
  const plain = shinglesOf_(text, '');
  const salted = shinglesOf_(text, 'k');
  const checks = [
    ['sha256(abc)', sha256Hex_(utf8Bytes_('abc')) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['windows', plain.length === 11],
    ['hash 1', plain.slice(0, 3).join() === /*EXPECT_PLAIN*/ ''],
    ['hash salt', salted.slice(0, 3).join() === /*EXPECT_SALT*/ ''],
    ['casefold', words_('Straße ﬁne ΣΑΣ').join(' ') === 'strasse fine σασ'],
  ];
  checks.forEach(function (c) { Logger.log((c[1] ? 'OK   ' : 'FAIL ') + c[0]); });
  if (checks.some(function (c) { return !c[1]; })) throw new Error('selfTest failed');
  Logger.log('selfTest passed');
}

function pilot() {
  // Three class A rows, nothing written: shows that conversion works and how long it takes.
  const inputs = loadInputs_();
  const ctx = { folder: outFolder_(), dryRun: true };
  inputs.rows.filter(function (r) { return r.group === 'A'; }).slice(0, 3).forEach(function (row) {
    const t0 = Date.now();
    const result = fingerprintOne_(row, ctx);
    Logger.log(JSON.stringify(result) + ' ' + (Date.now() - t0) + ' ms');
  });
}

function runBatch() {
  const t0 = Date.now();
  const inputs = loadInputs_();
  const folder = outFolder_();
  const ctx = { folder: folder, dryRun: false };
  const progress = loadProgress_(folder);
  const todo = inputs.rows.filter(function (r) {
    return CONFIG.CLASSES.indexOf(r.group) >= 0 && !progress[r.fileId];
  });
  let handled = 0;
  for (const row of todo) {
    if (Date.now() - t0 > CONFIG.BATCH_SECONDS * 1000) break;
    progress[row.fileId] = fingerprintOne_(row, ctx);
    replaceFile_(folder, 'progress.json', JSON.stringify(progress));
    handled++;
  }
  Logger.log('handled ' + handled + ', left ' + (todo.length - handled));
  Logger.log(summary_(inputs, progress));
  if (todo.length === handled) Logger.log('done: run finalize');
}

function summary_(inputs, progress) {
  const wanted = inputs.rows.filter(function (r) { return CONFIG.CLASSES.indexOf(r.group) >= 0; });
  const ok = [], reasons = {}, methods = {};
  let traps = 0, blocked = 0, controls = 0, allowed = 0;
  wanted.forEach(function (r) {
    const p = progress[r.fileId];
    if (!p) return;
    if (p.s === 'ok') {
      ok.push(r);
      methods[p.h || 'earlier'] = (methods[p.h || 'earlier'] || 0) + 1;
      traps += p.t || 0; blocked += p.b || 0; controls += p.c || 0; allowed += p.a || 0;
    } else {
      reasons[p.r] = (reasons[p.r] || 0) + 1;
    }
  });
  return [
    'fingerprinted ' + ok.length + '/' + wanted.length + ', skipped ' + JSON.stringify(reasons),
    'methods ' + JSON.stringify(methods),
    'trap: total ' + traps + ', blocked ' + blocked + ', leaked ' + (traps - blocked)
      + '; controls allowed ' + allowed + '/' + controls,
  ].join('\n');
}

function finalize() {
  const inputs = loadInputs_();
  const folder = outFolder_();
  const progress = loadProgress_(folder);
  const missing = inputs.rows.filter(function (r) {
    return CONFIG.CLASSES.indexOf(r.group) >= 0 && !progress[r.fileId];
  }).length;
  if (missing) throw new Fail_('REFUSED', missing + ' rows still to process: run runBatch');
  const entries = inputs.entries.map(function (e) {
    const p = progress[e.file_id];
    let shingles = e.shingles;
    if (p && p.s === 'ok') {
      shingles = JSON.parse(folder.getFilesByName(e.file_id + '.json').next().getBlob().getDataAsString('UTF-8')).shingles;
    }
    return {
      file_id: e.file_id, classification: e.classification,
      approved_by: e.approved_by, approved_on: e.approved_on, shingles: shingles,
    };
  });
  const text = JSON.stringify({ entries: entries, salt: CONFIG.SALT }, null, 1) + '\n';
  const report = summary_(inputs, progress);
  replaceFile_(folder, 'report.txt', report + '\n');
  if (text.length > 45 * 1024 * 1024) {
    throw new Fail_('REFUSED', 'fingerprints.json would be about ' + Math.round(text.length / 1048576)
      + ' MB, too large for one Drive write: use the per-file shards in the folder');
  }
  replaceFile_(folder, 'fingerprints.json', text);
  Logger.log(report);
  Logger.log('fingerprints.json written, ' + Math.round(text.length / 1024) + ' KB');
}

function reprocess() {
  // Forget earlier skips of the kinds in CONFIG.RETRY_REASONS so that runBatch tries them again,
  // for example after the script learned a new file type. Files already fingerprinted are kept.
  const folder = outFolder_();
  const progress = loadProgress_(folder);
  let cleared = 0;
  Object.keys(progress).forEach(function (id) {
    const p = progress[id];
    if (p.s === 'skip' && CONFIG.RETRY_REASONS.indexOf(p.r) >= 0) {
      delete progress[id];
      cleared++;
    }
  });
  replaceFile_(folder, 'progress.json', JSON.stringify(progress));
  Logger.log('cleared ' + cleared + ' skipped rows; run runBatch, then finalize');
}

function inspect() {
  // Discovery for the rows still skipped: counts only, never file names or text.
  const folder = outFolder_();
  const progress = loadProgress_(folder);
  Object.keys(progress).forEach(function (id) {
    const p = progress[id];
    if (p.s !== 'skip' || CONFIG.RETRY_REASONS.indexOf(p.r) < 0) return;
    let file;
    try { file = DriveApp.getFileById(id); } catch (e) { return; }
    const mime = file.getMimeType();
    const line = { reason: p.r, mime: mime, bytes: file.getSize() };
    try {
      if (MIME_ZIP.indexOf(mime) >= 0) {
        const budget = newBudget_();
        Utilities.unzip(file.getBlob().setContentType('application/zip')).forEach(function (m) {
          budget.members++;
          budget.bytes += m.getBytes().length;
          const ext = extOf_(m.getName());
          budget.ext[ext] = (budget.ext[ext] || 0) + 1;
        });
        line.members = budget.members;
        line.unpacked = budget.bytes;
        line.ext = budget.ext;
      } else if (MIME_BINARY.indexOf(mime) >= 0 || mime === 'application/msword') {
        const raw = file.getBlob().getDataAsString('ISO-8859-1');
        const eight = raw.match(/[\x20-\x7e\xa1-\xff\t]{6,}/g) || [];
        const wide = raw.match(/(?:[\x20-\x7e\xa1-\xff]\x00){6,}/g) || [];
        const longest = function (runs) {
          return runs.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
        };
        line.runs8 = eight.length;
        line.chars8 = eight.reduce(function (n, r) { return n + r.length; }, 0);
        line.longest8 = longest(eight);
        line.runs16 = wide.length;
        line.chars16 = wide.reduce(function (n, r) { return n + r.length / 2; }, 0);
        line.longest16 = longest(wide) / 2;
      }
    } catch (e) {
      line.error = String(e.message || e).slice(0, 80);
    }
    Logger.log(JSON.stringify(line));
  });
}

function cleanupTemp() {
  const found = DriveApp.searchFiles("title contains '" + TMP_PREFIX + "' and trashed = false");
  let n = 0;
  while (found.hasNext()) { Drive.Files.remove(found.next().getId()); n++; }
  Logger.log('temporary conversions removed: ' + n);
}

function installTrigger() {
  ScriptApp.newTrigger('runBatch').timeBased().everyMinutes(10).create();
  Logger.log('runBatch will run every 10 minutes; delete the trigger when done');
}
