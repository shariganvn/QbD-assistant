// Runs apps-script/Code.gs in node with in-memory stand-ins for the Google services.
//   node run-appsscript.mjs <json args>
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(here, '..', 'apps-script', 'Code.gs'), 'utf8');
const args = JSON.parse(process.argv[2] || '{}');

const logs = [];
const disk = new Map(); // id -> {name, text, mime}
const trashed = new Set();
let nextId = 1;
const tmpCreated = [];
const tmpRemoved = [];

const blobOf = (text) => ({ getDataAsString: () => text, getBytes: () => Buffer.from(text) });
const fileObj = (id) => {
  const f = disk.get(id);
  if (!f) throw new Error('not found');
  return {
    getId: () => id, getName: () => f.name, getMimeType: () => f.mime,
    getBlob: () => blobOf(f.text), setTrashed: (v) => { if (v) trashed.add(id); disk.delete(id); },
  };
};
const folders = new Map();
const folderObj = (name) => {
  if (!folders.has(name)) folders.set(name, { id: `folder-${name}`, files: new Map() });
  const fo = folders.get(name);
  return {
    getId: () => fo.id,
    getFilesByName: (n) => {
      const hit = fo.files.has(n) && disk.has(fo.files.get(n)) ? [fo.files.get(n)] : [];
      return { hasNext: () => hit.length > 0, next: () => fileObj(hit.shift()) };
    },
    createFile: (n, text, mime) => {
      const id = `gen${nextId++}`;
      disk.set(id, { name: n, text, mime });
      fo.files.set(n, id);
      return fileObj(id);
    },
  };
};

for (const f of args.files || []) disk.set(f.id, { name: f.name, text: f.text ?? '', mime: f.mime });
const manifestText = args.manifestText ?? JSON.stringify({ entries: args.entries });
disk.set('manifest-file', { name: 'manifest.json', text: manifestText, mime: 'application/json' });

const context = {
  console, Logger: { log: (s) => logs.push(String(s)) }, Date, JSON, Math, Object, Array, String, Error,
  Uint32Array, Uint8Array, DataView, RegExp,
  DriveApp: {
    getFileById: (id) => fileObj(id),
    getFoldersByName: (name) => ({ hasNext: () => folders.has(name), next: () => folderObj(name) }),
    createFolder: (name) => folderObj(name),
    searchFiles: () => ({ hasNext: () => false }),
  },
  SpreadsheetApp: {
    openById: () => ({ getSheetByName: (n) => (n === 'Manifest' ? { getDataRange: () => ({ getValues: () => args.table }) } : null) }),
  },
  DocumentApp: { openById: (id) => ({ getBody: () => ({ getText: () => disk.get(id).text }) }) },
  Drive: {
    Files: {
      create: (res, blob) => {
        if (args.convertFails) throw new Error('conversion refused');
        const id = `tmp${nextId++}`;
        disk.set(id, { name: res.name, text: blob.getDataAsString(), mime: 'application/vnd.google-apps.document' });
        tmpCreated.push(id);
        return { id };
      },
      remove: (id) => { tmpRemoved.push(id); disk.delete(id); },
    },
  },
  ScriptApp: {},
};
vm.createContext(context);
vm.runInContext(code + '\n;globalThis.__api = { shinglesOf_, words_, sha256Hex_, utf8Bytes_, CONFIG, selfTest, runBatch, finalize, pilot, parseManifest_, tableRows_ };', context);
const api = context.__api;
Object.assign(api.CONFIG, args.config || {});

const result = { error: null };
try {
  if (args.vectors) result.shingles = args.vectors.map(([t, s]) => api.shinglesOf_(t, s));
  if (args.sha) result.sha = args.sha.map((s) => api.sha256Hex_(api.utf8Bytes_(s)));
  if (args.selfTest) api.selfTest();
  for (const step of args.steps || []) api[step]();
} catch (e) {
  result.error = String(e.message || e);
}
result.logs = logs;
result.tmpCreated = tmpCreated.length;
result.tmpRemoved = tmpRemoved.length;
result.outputs = {};
for (const [name, fo] of folders) {
  result.outputs[name] = Object.fromEntries([...fo.files].filter(([, id]) => disk.has(id)).map(([n, id]) => [n, disk.get(id).text]));
}
console.log(JSON.stringify(result));
