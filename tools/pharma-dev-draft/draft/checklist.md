# Stage B authoring checklist

This is the repeatable procedure a human or a live Claude session follows to turn Stage A's
`extracted.json` into a Stage B draft (`draft.json`), for a new trial file. `validate-draft.mjs`
only checks structural shape — it cannot check whether you followed these rules, so follow them
deliberately.

## Steps

1. **Read `extracted.json` fully.** Look at every paragraph and every table's headers/rows.
2. **Read `schemas/p2-outline.json`.** Each entry's `description` tells you what kind of content
   belongs in that CTD section.
3. **For every table/paragraph in `extracted.json`, decide which outline section it answers.**
   A composition table + IPC/QC results table from a formulation-screening trial almost always
   belongs in `P.2.2.1.3` ("Nghiên cứu phát triển công thức"). A drug-substance property table
   belongs in `P.2.1.1`. If a table's purpose is unclear, prefer marking the section `gap` with a
   reason like "dữ liệu có trong nguồn nhưng không rõ thuộc mục nào — cần FD xác nhận" rather than
   guessing.
4. **Copy content verbatim.** Table cell values, numbers, and units go into `blocks` exactly as
   extracted — do not round, reformat, or "clean up" numbers. Keep the source's decimal notation
   (e.g. Vietnamese `"98,64"`, not `"98.64"`).
5. **Never invent.** If `p2-outline.json`'s description names something not present anywhere in
   `extracted.json` (RMP characterization, a specific dissolution apparatus/medium, a process step,
   a packaging material, a microbiology result, a QTPP target not actually stated) — mark that
   section (or note within a `covered` section, via a `paragraph` block) that this specific piece
   is `[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG]`. This applies even to well-known public facts (e.g. an
   API's CAS number or molecular weight) — if you supply such a value from general/pharmacopeial
   knowledge rather than from `extracted.json`, say so explicitly in the text ("nguồn: kiến thức
   tham khảo phổ biến — cần đối chiếu dược điển gốc") so a reviewer knows it wasn't in the source.
   Prefer a reference document the repo actually holds over recalled knowledge: excipient
   properties and use concentrations come from the Handbook of Pharmaceutical Excipients PDF in
   `docs/raw/`, cited by monograph name and printed page (see P.2.1.2 in `example-draft.json`). When
   the reference has no entry for a property, write "HPE không nêu" rather than filling it from
   elsewhere.
6. **Every outline id must appear exactly once**, `covered` or `gap` — never omit one just because
   nothing seemed to fit. An empty CTD section is itself information (a real gap for FD to close).
7. **Name every strength the document covers** in `meta.strengths`, and list in
   `meta.derivedStrengths` any strength that has no trial data of its own — one whose composition you
   worked out by proportion from a strength that was actually made. A proportion gives you a mass. It
   does not give you a dissolution percentage, a hardness, a disintegration time or a content-uniformity
   result, so every measured value for such a strength stays marked. The validator enforces this; the
   reason it does is that nobody reading the finished Word file can tell a calculated number from a
   measured one.
8. **Fill `meta` completely**, including `extractionMethod` copied from `extracted.json` and a
   `preparer` field that's honest about who/what did the interpretation (e.g. "Claude, phiên làm
   việc <ngày>" or a person's name) — this draft is not attributable to "the system."
9. **Add a figure only where the section already holds the data.** A figure block names a table and a
   row rather than carrying numbers, so the chart and the table cannot disagree, and a row still full
   of markers refuses to be plotted. Do not "fill in" a chart for a section whose table is empty —
   that is the same invention rule as everywhere else, in picture form.
10. **Run `node draft/validate-draft.mjs draft.json`** before rendering. Fix every reported error;
   the validator will not catch a wrong section mapping, only a malformed shape.

## What you are NOT trying to do

You are not trying to produce a submission-ready dossier section. You are producing an internal,
gap-flagged working draft that makes clear what the one supplied trial file does and does not
establish, for an FD reviewer to build on. See `tools/pharma-dev-draft/README.md` and
`docs/decisions/D20260825-pharma-dev-draft-tool-boundary.md` for why that boundary matters here.
