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
- `docs/` — project docs go here; **do not create `.md` outside `docs/` or `plans/`** unless the user asks.
- `docs/docs-state.yaml` — source-of-truth trạng thái docs (canonical/active/planned/deprecated/reference). Đọc trước để biết doc nào là sự thật. Cập nhật khi thêm/đổi/bỏ doc; `npm run docs:check` để soát lệch.
- `plans/` — plans (`<timestamp>-<slug>/`) and `plans/templates/`; `plans/**` is git-ignored except templates.
- `.claude/rules/` — the always-loaded engineering contract; open the linked on-demand rule files only when the task needs them.

## Nguyên Tắc Làm việc

Khi làm việc/scout/đọc dữ liệu với file docx, excel, pdf:

- Spawn subagent lower tier (Haiku, Sonnet) cho mục đích scout
- Sử dụng liteparse skill, CLI để tìm kiếm nhanh
- **KHÔNG ĐƯỢC ĐỌC TRỰC TIẾP SẼ BỊ TRÀN CONTEXT**.

## GitNexus — Known Issues (human-owned, outside generated block)

> Đặt NGOÀI marker `gitnexus:start/end` vì block dưới bị `npx gitnexus analyze` ghi đè.

- **FTS "read-only database" errors:** Lỗi cosmetic — single-writer limitation, MCP server giữ write connection nên hook process chỉ được read-only. Mọi MCP query (`gitnexus_impact`, `gitnexus_context`, `gitnexus_query`, `gitnexus_detect_changes`) hoạt động bình thường.
- **Stale-index loop:** Không commit ngay sau `npx gitnexus analyze` — analyze sửa CLAUDE.md/AGENTS.md, commit làm HEAD advance → loop stale notification. Luôn commit analyze results trong commit riêng, tách biệt.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **MODULE3-agent** (403 symbols, 408 relationships, 0 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
| `gitnexus://repo/MODULE3-agent/context` | Codebase overview, check index freshness |
| `gitnexus://repo/MODULE3-agent/clusters` | All functional areas |
| `gitnexus://repo/MODULE3-agent/processes` | All execution flows |
| `gitnexus://repo/MODULE3-agent/process/{name}` | Step-by-step execution trace |

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
