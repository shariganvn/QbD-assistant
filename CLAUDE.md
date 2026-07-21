# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Phong Thái Làm Việc

**Luôn duy trì:** Tích cực · Vui vẻ · Hòa hợp · Tự tin 🤝

- Gặp lỗi → nhận diện bình tĩnh, đề xuất hướng mới — không drama, không lặp lại cùng hướng sai 🔧
- Session mới = năng lượng sạch, không mang "nợ" từ session cũ ⚡
- Làm việc như đồng đội thực sự — chủ động, không thụ động chờ lệnh từng bước 🚀
- Khi nhận ra pattern lỗi lặp: DỪNG → nhìn nhận → đề xuất cách tiếp cận khác 💡
- **Dùng emoji thoải mái** trong responses để tạo không khí vui vẻ — KHÔNG dùng trong code hoặc file doc kỹ thuật

---

## Nguyên Tắc Phản Hồi (Naval Framework)

Mọi phản hồi cho HUMAN tuân theo 5 nguyên tắc:

- **Dense, not long** — Súc tích: mỗi câu mang thông tin, không lan man.
- **Clear, not simplistic** — Rõ ràng nhưng không cắt bớt sắc thái quan trọng.
- **Complete, not bloated** — Đủ ý, không thừa chữ.
- **Useful, not performative** — Hữu ích thật, không màu mè để "trông có vẻ" đang làm việc.
- **Respect the reader's time** — Tôn trọng thời gian người đọc, đi thẳng vào điều quan trọng.

---

## ⛔ CONTEXT OVERFLOW RECOVERY

**Khi context đầy hoặc mất phương hướng trong session dài:**

1. Re-read `CLAUDE.md` (file này) — nắm lại project identity & phase.

## Where things live

- `docs/raw/` — source of example file to work with.
- `docs/` — project docs, active plans, and reports live here. Do not create project Markdown
  outside `docs/` except the root workflow pointers named below.
- `baton state` — quản lý workflow state, handoff, và evidence qua agent-baton CLI. Dùng `baton state startup` để nạp context và `baton state validate` để kiểm tra ledger khi workflow state thay đổi.
- `IMPLEMENTATION_PLAN.md` — pointer to the single canonical active plan; never duplicate status here.
- `docs/plans/<workstream>/` — active plan package. Read `plan.md`, then only the current step.
- `docs/reports/<workstream>/` — current evidence and review artifacts.
- `docs/plans/OUTDATED/`, `docs/reports/OUTDATED/` — historical quarantine. **Do not scan or read
  these directories unless the user explicitly requests historical investigation.**
- `.claude/rules/` — the always-loaded engineering contract; open the linked on-demand rule files only when the task needs them.

## Session handoff discipline (baton)

- **Two-phase commit:** commit work + closeout artifacts trước (C1) → `HEAD_C1=$(git rev-parse HEAD)` → `baton handoff --expected-git-head "$HEAD_C1" ...` → `baton reconcile`. Chỉ khi kết quả clean/benign mới commit C2 = riêng `session-handoff.yaml` + `docs/.session-state.md`. Không gộp C1/C2 vào một commit.
- **Critical/DA review bắt buộc trước khi đóng session** nếu diff chạm: auth, schema/migration, đường dẫn security-sensitive, `baton verdict` báo warning/fail, quyết định kiến trúc mới, hoặc scope vượt plan đã duyệt. Các trường hợp khác có thể bỏ qua.
- **Exit-3 / handoff conflict:** KHÔNG BAO GIỜ `git reset` hay `git commit --amend` để xử lý — orphan commit mà `git_head` đang trỏ tới, gây lặp stale-loop ở session sau. Dùng `baton reconcile --repair` (forward-repoint, tự refuse nếu có content drift thật), rồi commit tiếp bình thường.

## Nguyên Tắc Làm việc

Khi làm việc/scout/đọc dữ liệu với file docx, excel, pdf:

- Spawn subagent lower tier (Haiku, Sonnet) cho mục đích scout
- Sử dụng liteparse skill, CLI để tìm kiếm nhanh
- **KHÔNG ĐƯỢC ĐỌC TRỰC TIẾP SẼ BỊ TRÀN CONTEXT**.

Khi chuyển từ brainstorm --> plan, đọc rule `.claude/rules/RULE-BRAINSTORM-PLAN.md`

## qbd_core module boundaries (Phase 2 — proposed, xem ADR)

> Áp dụng cho `qbd_core/` (Phase 2 roadmap, Python, chưa bắt đầu code). **Không áp dụng cho
> `cowork-p2-kit/`** (Phase 1 MVP, giữ nguyên layer A/B/C như hiện tại).

- Monolith, chia module theo **nghiệp vụ** (không theo layer kỹ thuật), 5–7 module.
- Mỗi module: `SPEC.md` (nguồn sự thật) + `service.py` + `models.py` (bảng DB riêng) +
  `api.py` (cổng vào/ra duy nhất) + `tests/`. Module khác chỉ được gọi qua `api.py`.
- DB dùng chung được. `shared/` chỉ chứa thứ thật sự dùng chung (auth, db connection) —
  không chứa business logic. Chia sẻ file ngoài `api.py`/`shared/` phải khai permission
  trong `SPEC.md` của module bị đọc.
- SDD: đổi hành vi = đổi `SPEC.md` trước, code sau. Review phải đối chiếu **spec-diff**
  với code-diff, không chỉ đọc code-diff.
- Chi tiết đầy đủ + module list đề xuất + thứ tự implement:
  `docs/architecture/ADR-qbd-core-module-boundaries.md` (draft, chờ confirm).

## GitNexus — Known Issues (human-owned, outside generated block)

> Đặt NGOÀI marker `gitnexus:start/end` vì block dưới bị `npx gitnexus analyze` ghi đè.

- **FTS "read-only database" errors:** Lỗi cosmetic — single-writer limitation, MCP server giữ write connection nên hook process chỉ được read-only. Mọi MCP query (`gitnexus_impact`, `gitnexus_context`, `gitnexus_query`, `gitnexus_detect_changes`) hoạt động bình thường.
- **Stale-index loop:** Không commit ngay sau `npx gitnexus analyze` — analyze sửa CLAUDE.md/AGENTS.md, commit làm HEAD advance → loop stale notification. Luôn commit analyze results trong commit riêng, tách biệt.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **QbD-assistant** (736 symbols, 753 relationships, 0 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/QbD-assistant/context` | Codebase overview, check index freshness |
| `gitnexus://repo/QbD-assistant/clusters` | All functional areas |
| `gitnexus://repo/QbD-assistant/processes` | All execution flows |
| `gitnexus://repo/QbD-assistant/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
