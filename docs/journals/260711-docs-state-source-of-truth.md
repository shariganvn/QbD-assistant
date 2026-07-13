# Docs State Source-of-Truth

- Ngày: 2026-07-11
- Loại: feature (dev tooling / docs governance)

## Điều đã làm

Dựng registry theo dõi vòng đời docs cho spec-driven development. Trước đó docs phân tán 3 nơi (`docs/`, `docs/raw/`, `plans/reports/`), quan hệ canonical/derived chỉ nằm trong đầu, không ghi tập trung.

4 file:
- `docs/docs-state.yaml` — 10 docs, state enum `canonical | active | planned | deprecated | reference`.
- `scripts/check-docs-state.mjs` — drift-check (Node + js-yaml): bắt dangling, unregistered, invalid state, duplicate.
- `CLAUDE.md` — pointer trong `## Where things live` (state không inline).
- `package.json` — `npm run docs:check` + devDep `js-yaml`.

## Quyết định chính

- **YAML** thay Markdown/JSON: agent parse dễ, human sửa dễ, có comment.
- **Node** cho script (không phải Python) vì repo đã init npm, Python chưa setup → 0 runtime mới.
- **Scope**: docs/ + plans/reports/ + raw/ (docx/pdf) như `reference`.
- **Maintain**: agent cập nhật tay + drift-check chạy local; chưa gắn CI (YAGNI).
- Invariant: mọi entry path phải tồn tại trên disk → registry = file thật, không placeholder.

## Verified

- Happy path: `docs:check OK — 10 docs đồng bộ`.
- Negative: file lạ → `FAIL unregistered`; xóa → OK. Script bắt lệch thật.

## Trade-off / còn mở

- `plans/**` gitignore nhưng registry trỏ tới → dev tool local, không CI gate.
- State assignment là seed đoán, đặc biệt `blindspot-260709-hermes = deprecated` — chờ user xác nhận.
- Chưa có entry `planned`; thêm khi PRD spec doc ra đời.
