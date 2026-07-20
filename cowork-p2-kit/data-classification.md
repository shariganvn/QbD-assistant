# Data Classification Convention

Two orthogonal axes per record. Every file entering ingest MUST be classified.

## Axis 1: Sensitivity Label

| Label | Meaning | Admission |
|-------|---------|-----------|
| `public` | Freely shareable, mock/synthetic data | ✅ MVP admits this only |
| `internal` | Company-confidential, not for LLM | ❌ Blocked at ingest |
| `internal-derived` | Derived from internal data | ❌ Blocked at ingest |

**Fail-closed rule:** unlabeled ⇒ `internal` (blocked). A file absent from `classification-manifest.json` is unlabeled.

## Axis 2: Citable Flag (trust axis)

Independent of sensitivity. A source can be `public` yet **not citable** (e.g. cross-drug reference docs).

| `citable` | Meaning |
|-----------|---------|
| `true` | May be cited in the dossier draft |
| `false` | Reference only; Layer B refuses to cite |

**Default:** đặt rõ `citable:false` cho tài liệu tham khảo, cross-drug, hoặc nguồn không được phép làm bằng chứng dossier.

## Classification Mechanism

`inputs/classification-manifest.json` maps each **generated `.docx` path** to its classification:

```json
{
  "inputs/trials/formulation-trial-01.docx": {
    "label": "public",
    "citable": true,
    "ocr_language": "vie"
  },
  "inputs/reference/some-ref.docx": {
    "label": "public",
    "citable": false,
    "ocr_language": "eng"
  }
}
```

### Required fields

- `label`: `public` | `internal` | `internal-derived`
- `citable`: `true` | `false`
- `ocr_language`: `vie` | `eng` (required, no default — liteparse `--ocr-language` defaults to `eng`, which produces garbage for Vietnamese pages)

### Enforcement

- Phase 2 admission gate reads the manifest before ingest.
- File absent from manifest ⇒ unlabeled ⇒ `internal` ⇒ **abort ingest**.
- Missing `ocr_language` ⇒ **abort ingest** (fail-closed, never silent `eng` default).
- `label ≠ public` ⇒ **abort ingest** (MVP admits public only).

## Store Record Shape

Each record persisted by Layer A carries:

```json
{
  "classification": {
    "label": "public",
    "citable": true
  }
}
```
