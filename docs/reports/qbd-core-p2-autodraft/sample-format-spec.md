# Format-only specification from the finished P.2 sample

Source: Notion rendering of a Word P.2 of another company (about 2,200 lines, 46 tables, 29 figures). Used for FORMAT only. No data, names, limits or prose from it appear here. Statements marked certain are visible in the rendering; guess means a real .docx is needed.

## 0. What the rendering cannot tell us

Fonts, sizes, colours (including risk-matrix shading), borders, cell shading, page size and margins, header and footer, page numbers, table of contents (it would be a field and is not rendered), real figure images (the rendering shows a text transcription in a quote block instead of the image), text alignment, and whether numbers are typed or auto-numbered.

## 1. Heading scheme

| Level | Pattern | Notes |
|---|---|---|
| H1 | `P.2 Pharmaceutical Development` | Once. Only the chapter heading. |
| H2 | `P.2.n Title` | **No** trailing dot. |
| H3 to H4 (numbered) | `P.2.n.n. Title`, `P.2.n.n.n. Title` | **Trailing dot** from the third number on. |
| Numbered down to | `P.2.2.1.3.3.1.` (7 numbers) | Depth is wrapped to H4 in the rendering, which is a Notion limit. |
| Unnumbered sub-headings | short noun phrases, rendered as H4 | Used inside numbered sections. |

- Title case: first word capitalised, then mostly lower case. English only; there is no Vietnamese or bracketed bilingual form.
- The `3.2.` prefix is **not** in headings. It appears only in cross-references such as "section 3.2.P.2.2.1.4", and plain "section P.2.1.2.2" is also used. The two are mixed.
- Numbers are typed in the heading text (certain, as rendered). Whether Word auto-numbers them is unknown (guess: typed).
- Per-strength sections use the strength as the title, for example `P.2.3.3.1. <product> <strength> film coated tablets`.
- Study sections use `#1`, `#2` in the title.
- Order of strength sections is not constant, so do not infer it.

## 2. Document-level parts

Order as rendered:

1. A one-line header strip: `Product:` | `Module:` | `Issue date:` (bold labels separated by pipes).
2. H1 `P.2 ...`.
3. `LIST OF ABBREVIATIONS` as H2: a two-column table with **no header row**, term then expansion, alphabetical.
4. `P.2.1` to `P.2.6`.

Absent from the sample (certain): cover page, scope notice, status banner, product facts table, table of contents (not visible), reference list, appendices, sign-off or approval block, gap register. The document ends at the last body sentence of P.2.6. Cross-references to other modules appear as "(see Module 3.2.P.8.3)" or "(see 3.2.P.8)".

## 3. Tables

| Kind | Look |
|---|---|
| Property list (label : value) | Three columns: label, a literal `:`, value. No header row. Used for the substance identity block. |
| Two-column glossary | Term then definition, no header row. |
| Data / result table | Header row present. Often a second header row that holds sub-labels (for example Mean / Max / Min per strength, or mg / % per strength). First column holds a group label that is left blank in the following rows (visual merge by blank cell). |
| Risk matrix | First header cell `Drug Product CQAs` plus a spanning group label `Drug Substance Attributes` (or the formulation / process equivalent). Row labels are CQAs. Cells hold the word `Low`, `Medium` or `High`. Colour unknown. |
| Risk definition | Two columns, level then meaning. Rows Low, Medium, High. No header row. Sits **before** the matrix. |
| Justification table | Columns: `<attribute>` / `<CQA>` / `Justification`. Attribute label shown once, blank in following rows. One row per attribute x CQA pair. A CQA with the same reason as the row above is left blank. |
| QTPP | Columns `QTPP` / `Target` / `Justification`. |
| CQA | Columns: quality-attribute group, attribute (blank when the group is one attribute), `Target`, `CQA` (Yes / No), `Justification`. |
| Composition | `No.` / `Name of ingredient` / `Function`, then per strength `mg` and `%`. Total rows ("Total weight of core tablet", and core plus coating). Film-coat items carry `-` in `%`. Water as `q.s`. |
| Scale / stage | Rows are stage plus parameters; parameters stacked in one cell with line breaks. |

Captions:
- Pattern `Table N. <description>`, **bold**, a separate paragraph **above** the table, running number 1 to 46 across the whole document (not per section).
- Not every table has a caption: property lists, risk definition, composition at the final formula, and scale-up tables have none (certain).
- A sentence before the table refers to it as "in Table N" / "Table N and Table M".

Notes under tables:
- No "Ghi chú" or "Note" label. A plain paragraph directly under the table starts with a symbol or term, for example a footnote asterisk `\*` explained in a paragraph under the table.
- Evaluation text after tables starts with `Comment:` followed by prose (plain, not bold).
- A conclusion for a comparison is placed as a **last row** of the table (label cell `f2`, text in the merged remainder) when f2 cannot be computed.
- No source line under tables. Sources are in the prose.

## 4. Text conventions

- Citations: inline author-year in parentheses, no numbered brackets, no footnotes, **no reference list at the end** (certain for this sample, though one may sit outside it). Cross-references to own sections: "(see section P.2.x.x)".
- Lists: `-` bullets for enumerations (limits list, control strategy, studies). No numbered lists. No nested bullets seen.
- Emphasis: bold for captions of tables and for labels in header strip; italic for captions of figures. Body prose is plain, no bold, no underline.
- Not applicable: a sentence starting `Not applicable.` plus the reason, or "This section is not applicable since ...". The heading stays. Table cells use `NA`; `ND` for not detected; `-` for a blank numeric cell.
- Units: space between number and unit (`5 mg`, `900 mL`), `°C` with the degree sign, `µm`, `±` with spaces, ranges with an en dash and spaces (`a - b` style). Slash with a space after it in unit pairs (`g/ ml`).
- Decimal separator: **point**, no thousands separator in the plain tables. Percent sign sometimes with a space, sometimes not (inconsistent, guess: typed by hand).
- Mathematics and chemical formulae use subscripts and superscripts.

## 5. Figures

- Kinds: line charts of dissolution (several per section), thermograms, a bar-like comparison chart, a sampling schematic, a structural formula inside a table cell.
- Caption `Figure N. <description>`, **italic**, **below** the figure, running number 1 to 29 across the document.
- Placed right after the paragraph or table that discusses it, and before the next paragraph. Often followed by a table of the same data (table after figure) in the dissolution sections.

## 6. Comparison with `html_doc.py` (our HTML)

| # | Sample | Ours now | Suggested change | Confidence |
|---|---|---|---|---|
| 1 | H1 = chapter title, H2 = `P.2.n`, H3 = `P.2.n.n`, H4 = deeper | `level()` gives H3 for `P.2.n` (H2 skipped), H4 for everything deeper; in-section sub-heads are H5 and H6 | Make level = number of dots minus 1 (cap at 4), and render in-section `heading2/3` as H4 unnumbered | certain (the sample structure), cap is a design choice |
| 2 | Headings `P.2.n.n. Title`, English, no `3.2.` | `3.2.P.2.n.n Vietnamese (English)` | Keep CTD prefix for the department (the department form says CTD). Consider the trailing dot from level 3 | guess: the sample is another company |
| 3 | No cover, notice, facts table or sign-off | Banner, scope notice, facts table, and sign-off table around the body | Keep, because the SOP needs the draft label. Move them to a clearly separate front block and put `LIST OF ABBREVIATIONS` directly before P.2.1 | certain for position of abbreviations |
| 4 | Abbreviations table is first, 2 columns, no header, alphabetical | Abbreviations come from the draft as an ordinary section; table() always writes `<thead>` | Add a no-header option to `table()` for glossary, property list and risk definition tables | certain |
| 5 | Table captions `Table N.` bold, above, document-wide numbering | No captions at all | Add a `caption` field on table blocks, and number them in the renderer (one counter) | certain |
| 6 | Figure captions `Figure N.` italic, below | `block()` supports 4 kinds only; any other kind raises `E_BLOCK_UNSUPPORTED` | Add a figure block with `<figure><img><figcaption>` and a second counter (check how figure blocks currently reach the output before changing) | certain for caption; code path to verify |
| 7 | Notes: `Comment:` paragraph under the table, footnote symbol line | No note block | Plain paragraph is enough; a `Comment:` label is wording, not a renderer feature | certain |
| 8 | Label : value table with a literal colon column | Two-column table with a header `Thông tin / Giá trị` | Offer a three-column variant, no header | certain |
| 9 | Group label shown once, blank below (visual merge) | Every cell is written as given; blank cells are plain | Use `rowspan` for the repeated first column in matrices and justification tables | guess (Word likely merges cells) |
| 10 | Risk word `Low / Medium / High` in cells | Same text, no cell class | Add cell classes `risk-low/medium/high` for shading; colour values need the .docx | guess |
| 11 | Not applicable: sentence starting `Not applicable.` | Gap sections get a red bordered box | Keep our marker for gaps, but render a genuine not-applicable section as plain text | certain |
| 12 | No reference list; inline author-year | `referenceSources` listed in the facts table | Keep (we need traceability); add a closing `References` heading only if the department wants one | guess |
| 13 | Body in a serif-or-sans Word style, flat tables | Sans-serif page, 60rem width, sticky toolbar | Print CSS only: remove toolbar and notice colours; fonts and sizes wait for the .docx | guess |

## 7. Open questions for the real .docx

1. Fonts, sizes and line spacing for body, each heading level, table text and captions.
2. Heading numbering: typed text or Word multilevel list; style names (Heading 1..).
3. Page size, margins, orientation of wide tables, repeated header rows across pages.
4. Header and footer content, page numbering, document code and version fields, whether a title page exists.
5. Table borders, header row shading, risk-matrix cell colours, column widths, alignment of numbers.
6. Whether a table of contents exists and its depth; whether captions are Word caption fields.
7. Figure sizes and alignment; whether images are inline or floating.
8. Whether the sample was edited after the Notion export (the `Comment:` and caption conventions would be confirmed against Word styles).
