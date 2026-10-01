# P.2 Draft Contract (Stage B)

This document defines the JSON shape a "P.2 draft" file must follow before `render/render.mjs`
(Stage C) can turn it into a `.docx`. It is validated structurally (shape only) by
`draft/validate-draft.mjs` — that validator cannot and does not judge whether a table was mapped
to the *correct* CTD section; that judgment call is made by whoever authors the draft (a human or
a live Claude session), following `draft/checklist.md`.

This contract is intentionally **not** shaped like `cowork-p2-kit/render/contract.mjs`'s
`validateDraft()` (no `citations`, `evidenceLink`, `classification`, `citable` fields). That
contract encodes the rationale pipeline's public-citation approval semantics, which a P.2 draft has
no use for: there is no approval state, no citable/public classification, and no evidence-host
allow-list.

Provenance here is simpler but still explicit. Trial data comes from exactly one supplied file,
named in `meta.sourceFiles`. Where a section additionally states something from a reference work
(excipient properties from a pharmacopoeial handbook, for example), every such work must be listed
in `meta.referenceSources` and cited in the section text; the renderer prints that list on the
cover page. A fact that is in neither the source file nor a declared reference source does not
belong in the draft — mark the section `gap` instead.

## Top-level shape

```jsonc
{
  "schemaVersion": "1.0",
  "meta": {
    "productName": "string — the product across every strength it covers",
    "apiName": "string — the active ingredient name",
    "strengths": ["string — REQUIRED; one entry per strength the document covers, no duplicates, no upper bound"],
    "derivedStrengths": ["string — optional; the subset of strengths that have no experimental source"],
    "sourceFiles": ["string — REQUIRED; one entry per experimental source docx, no duplicates, no upper bound"],
    "draftDate": "YYYY-MM-DD — the date of the LAST revision, not the date drafting started",
    "assembledBy": "string — REQUIRED; the tool or session that assembled the draft. NOT a signatory: it prints in the scope notice as provenance, and the sign-off table stays blank for people to sign",
    "extractionMethod": "xml-walk | liteparse — from Stage A's extracted.json",
    "referenceSources": ["string — optional; one entry per reference work a section quotes"],
    "decisionOwners": ["string — REQUIRED once the draft holds a decision marker; the roles that can settle one"],
    "quotedNumbering": ["string — optional; section numbers quoted from ANOTHER document's numbering, not references to ours"],
    "abbreviations": [["string — term", "string — explanation"], "optional; every declared term must appear in the document"]
  },
  "sections": [ /* see below — one entry per id in schemas/p2-outline.json, in that order */ ]
}
```

## `sections[]` — one entry per `schemas/p2-outline.json` id

```jsonc
{
  "id": "P.2.2.1.3",                 // must match an id in schemas/p2-outline.json exactly
  "status": "covered" | "gap",
  "gapReason": "string",             // REQUIRED iff status === "gap"; FORBIDDEN iff status === "covered"
  "blocks": [ /* ... */ ]            // REQUIRED (non-empty) iff status === "covered"; FORBIDDEN iff "gap"
}
```

Rules enforced by `validate-draft.mjs`:

1. `sections` must contain exactly one entry per id listed in `schemas/p2-outline.json`, no more,
   no fewer, no duplicates, no unknown ids.
2. `status: "gap"` → `gapReason` must be a non-empty string; `blocks` must be absent or empty.
3. `status: "covered"` → `blocks` must be a non-empty array; `gapReason` must be absent.
4. Every block's `type` must be one of: `heading2`, `heading3`, `paragraph`, `table`.

Rules **not** enforced by the validator (judgment calls — see `draft/checklist.md`):

- Whether a table was assigned to the *right* section.
- Whether `blocks` content is a verbatim copy of the source (vs. paraphrased or invented) — the
  checklist requires verbatim copying, but the validator cannot check this against the original
  docx automatically.

## The two markers

An unfinished spot carries a marker, never a blank: a blank cell reads as "not applicable" in a
document shaped like a dossier. Both labels are produced by `schemas/markers.mjs` and nowhere else.

| Marker | Means | Closed by |
|---|---|---|
| `[CHƯA CÓ DỮ LIỆU – CẦN BỔ SUNG]` | nobody has measured this yet | producing the data |
| `[CẦN QUYẾT ĐỊNH – CHƯA CHỐT]` | the data exists but two sources disagree, or an assumption is in use unapproved | somebody with the authority choosing |

Rules the validator enforces:

- One spot is one kind. A text carrying both labels is rejected (`E_MARKER_AMBIGUOUS`): it would be
  listed in both registers, and a reader could not tell what it waits for.
- A decision marker must say what has to be decided, and must name a role from `meta.decisionOwners`
  (`E_DECISION_MARKER_SHAPE`). A decision with no owner is not a task anybody picks up. The roles are
  declared in the draft rather than built into the checker, so a department that names its roles
  differently is not wrong.
- A cell in a `measuredOnly` table belonging to a `derivedStrengths` column must carry the **gap**
  marker. A decision marker there is rejected: nobody can decide a cell whose strength has no batch.

Each marker kind feeds its own annex at the end of the rendered document, both derived from the
draft. Filling one real value, or settling one decision, removes exactly its own row.

## Block types

```jsonc
{ "type": "heading2", "text": "string" }
{ "type": "heading3", "text": "string" }
{ "type": "paragraph", "text": "string", "italic": false, "bold": false }   // italic/bold optional, default false
{ "type": "figure",
  "kind": "flow" | "bars" | "process" | "profile",
  "fromTable": "ma-tran-rui-ro",       // id of a table in THIS section — a name, never an index
  "fromAxis": "columns" | "rows",      // flow only: which axis holds the steps; default "columns"
  "fromRow": "string",                 // bars only: the row label whose values are plotted
  "threshold": "80", "thresholdLabel": "Ngưỡng Q = 80%", "axisLabel": "…",   // bars and profile, optional
  "caption": "string" }                // required
{ "type": "image", "path": "assets/…png", "caption": "string", "widthPt": 320 }
{ "type": "table",
  "headers": ["string", "..."],
  "rows": [["string", "..."], "..."],
  "columnWidths": [520, 1680, "..."],          // optional, see below
  "columnAlign": ["center", "left", "..."] }   // optional, see below
```

### `figure` and `image`

A `figure` names its table with `fromTable`, which is the **id of a table in the same section** — not
an index. A table declares `id` only when a figure points at it, and two tables in one section may not
share one. The reference used to be positional, and a table moved or inserted ahead of a figure
silently redirected it three times; a name does not move when the table does. An index is refused
rather than accepted alongside the name.

Note the deliberate asymmetry with the outline: `form.tables[]` **is** positional, because it says
"the Nth table of this section must have this shape" — that is format, and a table inserted in the
middle should break it. A figure points at content, so it points by name.

A `figure` has four kinds. `flow` draws a left-to-right chain of unit operations from one axis of a
table; `bars` plots a named row; `process` draws unit operations down the page with the components
added at each one branching in from the left; `profile` draws a dissolution profile, described below.

A `process` figure's table must have **exactly three columns** — step number, components added, unit
operation — and that shape is required rather than derived, because `labelColumnCount` models
"ordinals plus one label column" and would put the components on the label side. In the components
column, `—` means the step deliberately adds nothing and no input branch is drawn; a blank cell is not
that, since a blank reads as "not applicable" everywhere else in this document. A gap marker in the
operation column refuses the figure: a process missing a step reads as a different process.

A `figure` **carries no numbers**. It names a table and a row already present in the same section, and
the renderer reads the values out at render time. Copying them into the block would put one
measurement in two places, and the two would disagree the first time one was corrected — the value
inventory would report it as the duplicate it is.

The second thing that buys: a figure cannot be drawn from data that does not exist. `validate-draft`
resolves every figure against its table and rejects the draft with `E_FIGURE_SOURCE` when the table or
row is missing, when a plotted cell still holds a gap marker, or when a value is not a number. An empty
chart in a document shaped like a dossier reads as a measured result of zero, which is a stronger claim
than the blank it would replace.

`bars` reads the values as the source writes them — Vietnamese comma decimals — and prints them back
in that form. A column below `threshold` is drawn in a different colour.

`profile` reads the table's row labels as sampling times (the number a label starts with: "15 phút" is
15, unit "phút") and draws every value column as one line. It is refused (`E_FIGURE_SOURCE`) when a cell
is a marker or not a number, when the times do not increase or mix units, when there are fewer than two
time points, or when there are more than **three** series — three is how many reference-palette colours
stay apart under every colour-vision deficiency when all pairs can appear together, so a wider table is
split into one figure per medium or per strength. Colour is never the only identity: each series has
its own marker shape and is named in a legend and at the end of its line, and the table the figure was
read from sits directly above it. The block carries no number of its own, so correcting the table
redraws the line.

`image` is for a figure that cannot be derived, such as a structural formula. `path` must sit under
`assets/` with no parent-directory segment, and the file must exist: `E_IMAGE_PATH` and
`E_IMAGE_MISSING`. Only the width is declared; the renderer keeps the file's own proportions so a
supplied image is never silently stretched.

Both need a `caption`; figures are numbered across the document in render order.

**Rendering a figure needs Chromium.** There is no rasteriser in this environment, so the browser
Playwright installs draws the SVG. It must be `headless_shell`, not `chrome --headless`, which in this
container paints only box outlines and drops all text. A missing browser stops the render rather than
omitting the figure — a figure that silently disappears is evidence removed without anyone being told.
Point `PHARMA_DEV_HEADLESS_SHELL` at the binary if it lives somewhere unusual.

Every `rows[i]` must have the same length as `headers`. Cell values are always strings (format
numbers exactly as they appear in the source — e.g. `"98,64"` for Vietnamese comma-decimal, not
`98.64`).

A `\n` inside a cell value starts a new paragraph within that cell. A line that opens with `"- "`
becomes a real Word list item (the prefix is stripped and Word draws the bullet); any other line
renders plain. That mix is what lets one cell carry bulleted property lines around an unbulleted
lead-in, e.g. `"Giới hạn sử dụng:\n- Viên nén: 0,5 – 5,0%\n- Viên nang: 10 – 25%"`. Newlines are
only meaningful in cells — the validator rejects them in heading and paragraph text, where Word
would swallow them.

`columnWidths` and `columnAlign` are both optional and both must have exactly one entry per
header when present:

- `columnWidths` — positive integers in DXA units that must sum to `10000` (the renderer's page
  width budget). Omit it and the renderer gives the first column 34% and splits the rest evenly,
  which suits short label/number tables but not tables with several prose columns.
- `columnAlign` — `"left"`, `"center"` or `"justify"` per column. Omit it and the first column is
  left-aligned with the rest centred; centring is unreadable for long prose, so set it explicitly on
  any table with paragraph-length cells (`"justify"` matches how the department's reference tables
  set prose columns).

## The format reference is not a data source

A finished P.2 for this same product, written by a different company from a different formula, is used as
the authority on **structure and completeness**. It is authority on nothing else. Its formula shares one
excipient with ours out of seven, and every measurement in it was made on a tablet nobody here produced,
so a value taken from it is a fabricated result no matter how plausible it looks.

`verify/sample-boundary.mjs` enforces this on the draft and on the rendered document, from hashes in
`verify/format-reference-tokens.json` — hashes, so the blocklist is not itself a copy. Two rules:

- An **identifier** from the reference — a batch number, a supplier, a DMF id — fails on one occurrence.
  It names something another company made.
- **Measured values** are grouped by the reference table they came from. One value in common is a
  coincidence and passes; `minimumGroupMatch` or more from one group inside one section is a copied block.
  This is the reasoning that found the first copied results table in this project.

A value retyped with the other decimal separator hashes the same, so swapping a comma for a dot is not a
way past it. Retyping a value and changing a digit is: the check cannot see that, and `draft/checklist.md`
says so rather than implying a guarantee the code does not give.

What *may* be taken from the reference is the shape of a measurement — thirty tablets across three
batches, binary mixtures at 1:1, three dissolution media — because a method comes from a pharmacopoeia or
an ICH guideline and can be cited from the references this repo holds. What may **not** be taken is an
acceptance limit: a humidity ceiling, a hardness range, an impurity threshold. Those are decisions this
company has to make, so they become `[CẦN QUYẾT ĐỊNH – CHƯA CHỐT]`, never a borrowed number.

## What Stage C always adds regardless of the draft (not part of this contract)

`render/builder.mjs` unconditionally prepends a scope-notice box and appends a sign-off table —
these are fixed constants in the renderer, not settable through the draft JSON. See
`tools/pharma-dev-draft/README.md` for why this is non-negotiable.

## The P.2 form: `form` in `schemas/p2-outline.json`

Every product brings a different active substance, different excipients, different quality
attributes and, depending on the manufacturing method, a different set of unit operations. None of
that may be fixed anywhere. What must not vary is the shape of the department's P.2 document, so
each outline section may carry a `form` key that the validator enforces against **any** draft:

- `headings` — the `heading3` texts the section must have, in order. `[]` means the section takes
  no headings at all.
- `tables` — one entry per table the section must have, in order. Each entry may declare:
  - `columns` — exact header labels. `"*"` accepts any non-empty label, for a column whose title
    carries a product name (the reference product, the trial the criteria came from). `"..."` as
    the last entry accepts any number of further columns with any names — that is how the process
    risk matrix takes whichever unit operations the chosen method has.
  - `rows` — exact row labels, or `"variable"` when the product decides them (the excipient list,
    the quality attributes, the process steps).
  - `rowsFrom` — the id of another section whose first table supplies the row labels. The risk
    matrix uses this so it always scores exactly the attributes the product declared, rather than a
    list frozen into the schema.
  - `columnsFrom` — the id of another section whose first table supplies the columns. `columns`
    then declares only the fixed prefix and ends in `"..."`, which stands for **exactly** the source's
    columns after that prefix, in the same order. The updated risk matrix uses it to repeat the
    initial matrix's columns.
  - `columnsFromRows` — `{ "section": "<id>", "column": <n> }`: the columns are the cell `n` of each
    row of that section's first table. Used where the source lists the things down a column and this
    table lays them across — the process risk matrix takes its columns from the operation list in
    `P.2.3.2`, so it cannot score an operation the list does not have or omit one it does.
    Declaring both `columnsFrom` and `columnsFromRows` on one table is refused.
  - `headerless` — whether the printed header strip is suppressed, for label/value forms.
  - `perStrength` — the table reports per strength. `columns` then declares only the **fixed prefix**;
    after it the table must carry exactly one equal column group per entry in `meta.strengths`. The
    group size is **derived** by dividing the remaining columns by the strength count, never declared:
    the department's form uses one column per strength in the composition comparison and two (mass and
    per cent) in the final formula, and a size written into the schema would be one more number to
    keep in step with the table it describes. The first column of each group must name that group's
    strength, resolved by longest match so a 5 mg / 15 mg pair cannot be read in the wrong order.
    `perStrength` cannot be combined with `"..."` — they make opposite claims about the trailing
    columns.
  - `measuredOnly` — the table holds **measured results** (in-process and quality-control results,
    dissolution, hardness, disintegration, content uniformity, reference-product survey, stability).
    In such a table every cell in the column group of a strength listed in `meta.derivedStrengths`
    must carry the gap marker: proportion yields a mass, never a measurement, and a blank cell reads
    as "not applicable" rather than "not known". Violations report as
    `E_DERIVED_STRENGTH_HAS_RESULT`, naming the row, the column and the strength. A composition table
    is **not** `measuredOnly`, because a composition is a declared quantity that proportion can
    supply — that is the one place a derived strength may hold a number, and the section carrying it
    has to say the masses are calculated.

Omit `headings` or `tables` to leave that aspect unconstrained; omit `form` entirely for a section
with no fixed shape. Violations report as `E_FORM_HEADINGS`, `E_FORM_TABLE_COUNT`,
`E_FORM_COLUMNS`, `E_FORM_ROWS`, `E_FORM_HEADERLESS` and `E_FORM_STRENGTH_COLUMNS`, each naming the
section, the table and the label that differs. A malformed `meta.strengths` or `meta.derivedStrengths`
reports as `E_META_STRENGTHS`.

`validateDraft(draft, outline)` takes the outline as an optional second argument so a test can prove a
form rule against a purpose-built form rather than only against whichever shape the department's
current outline happens to have. The CLI and the renderer pass nothing and get the real outline, so
normal use has one source of truth.

### Risk assessments: `riskAssessment` and `riskScale`

A section whose `form` declares `riskAssessment: { "kind": "initial" | "updated", "pairs": "<id>" }`
holds a **risk matrix** as its first table (rows are quality attributes, columns are the factors that
could threaten them) and a **justification table** as its second. `riskScale` at the top of the outline
is the ordered list of levels a matrix cell may hold, lowest first; it is the department's form, taken
from the format reference, and **not confirmed by FD or regulatory affairs**.

- Every matrix cell is a level of `riskScale` or a marker. Anything else — "khá thấp", a number —
  cannot be compared with the initial assessment and is refused (`E_RISK_CELL_INVALID`).
- An `updated` section names the `initial` one it revises in `pairs`. Its rows and columns repeat the
  initial matrix's through `rowsFrom` and `columnsFrom` (`E_FORM_ROWS` / `E_FORM_COLUMNS`). A `pairs`
  that does not name an initial assessment is an outline error (`E_OUTLINE_RISK_PAIR`).
- A cell scored **lower** than the same cell in the initial matrix is a claim that something was
  learned, so the updated section's justification table needs a row for it: first cell
  `"<row label> × <column label>"`, last cell either a cross-reference to the section of the study that
  lowered it or a marker saying that study is not attached yet (`E_RISK_LOWERED_NO_EVIDENCE`). The
  reference must be to a section that exists, which the ordinary cross-reference check already
  enforces.
- A justification row for a cell that was **not** lowered is refused as stale
  (`E_RISK_JUSTIFICATION_ORPHAN`). A row whose first cell is itself a marker is a placeholder and is
  exempt.
- A cell holding a marker, in either matrix, has no level, so nothing is compared.

What this does **not** check: whether the cited study supports the lower score. That is a judgement for
the reviewer; the rule only guarantees there is something to go and read. Only lowering is enforced —
raising a cell needs no row, although a reviewer will want to know why.

### The operation list: `operationList`, `developsOperations` and `meta.notApplicableSections`

The process section `P.2.3.2` holds the one table in the document that lists the manufacturing
operations. The risk matrix columns, the matrix's justification rows and the flow diagram all read from
it, so the document cannot describe the process two ways. Its `form` declares
`operationList: { "developmentColumn": n }`, and the sections that report the development of an
operation (blending, compression, coating) declare `developsOperations: true`.

- Cell `n` of every operation row points at the section that develops it — a section reference such as
  `3.2.P.2.3.2.3` — or carries a marker saying it has no development study yet. An operation pointing at
  no development section, or at one that does not develop operations, reports
  `E_PROCESS_DEVELOPMENT_UNKNOWN`; pointing at two reports `E_PROCESS_DEVELOPMENT_MULTIPLE`.
- One section may serve several operations (three mixing steps, one blending study). The reverse is the
  error: a section that develops operations and is pointed at by none reports
  `E_PROCESS_DEVELOPMENT_UNUSED`.
- The form cannot drop a development section a product does not need — an uncoated tablet still has the
  coating section. The draft declares `meta.notApplicableSections: ["<section id>"]` instead. Such a
  section is exempt from being pointed at, and being pointed at while declared not applicable is
  `E_PROCESS_DEVELOPMENT_CONTRADICTION`. Naming a section that does not develop operations is
  `E_META_NOT_APPLICABLE`. The declaration says that the section does not apply; why is for the
  section's own text.
- An outline that marks developing sections but declares no operation list is
  `E_OUTLINE_PROCESS_DEVELOPMENT`.

What this does not check: whether a development section actually studies the operations that point at
it. It guarantees that the pointing exists and is consistent, not that the study is any good.

### Sections that report one strength: `strengthIndex` and `{strength}`

Some sections report a single strength — the physico-chemical characteristics, the breakability test
and the scale-up of each strength. A section declares which one in its `form`:
`strengthIndex: n` is the strength at position `n` (from 0) in `meta.strengths`. The order is the
draft's own, not the order of any reference document. An outline `headingVi` may hold `{strength}`,
which every printed list of the section — the document heading, the gap register, the data requests and
the decisions — replaces with that strength's name (`schemas/headings.mjs`); a position past the end of
`meta.strengths` prints "không áp dụng".

Sections under the same parent form a family, one per position. The outline is a fixed list while the
number of strengths has no upper bound, so:

- More strengths than a family has sections is refused (`E_STRENGTH_SECTIONS_MISSING`) rather than
  papered over: the outline has to gain a section for each. This is a real limit of a fixed outline,
  not something the validator can supply.
- Fewer strengths than sections leaves a section with no strength. The draft lists it in
  `meta.notApplicableSections` (the same list the operation sections use); leaving it out is
  `E_STRENGTH_SECTION_ORPHAN`, and listing a section whose strength the draft does declare is
  `E_STRENGTH_SECTION_CONTRADICTION`. Positions that skip or repeat are `E_OUTLINE_STRENGTH_SECTION`.

**A strength with no batch holds no measurement.** For a section whose strength is in
`meta.derivedStrengths`, Stage B refuses (`E_DERIVED_SECTION_HAS_RESULT`) any table value cell that is
not a gap marker — a decision marker too, since nobody can decide a cell for a batch that does not
exist — and any paragraph holding a token that reads as a measurement: a number followed by a unit, or a
number with two or more decimals, once the strength names themselves ("5 mg") are set aside.

This is a heuristic, and it is meant to stop the common failure — a hardness or a percentage typed into
the wrong strength's section — not every one. A measurement written in words, or a bare number with no
unit, gets past it, and so does a measurement in a section the outline does not bind to a strength.
Reading the section is still the author's job. Method statements that need a number (how many tablets,
how many batches) belong in the parent section, where the design is shared and the strengths are not.

### The similarity table: `similarity` and f2

A section whose `form` declares `similarity: true` compares dissolution profiles, and its second table is
the f2 statement: column 1 the medium and pair compared, column 2 f2, column 3 the condition under which
f2 does not apply. The table needs at least one row (`E_F2_MISSING`), and every row holds exactly one of

- an f2 value between 0 and 100 (`E_F2_CELL_INVALID` otherwise);
- a marker, meaning the comparison is still to be done;
- "không áp dụng" together with the condition that makes it so — at least six words, not itself a
  bare "không áp dụng" (`E_F2_UNCONDITIONAL`). A condition that is itself a marker is accepted as
  pending.

Anything else in the f2 cell is `E_F2_CELL_INVALID`. This makes the equivalence conclusion impossible to
leave unsaid, and an exemption impossible to claim with nothing to check it against. It does **not**
recompute f2 from the profiles and does not judge whether a stated condition is true or sufficient; a
reviewer still has to test the condition against the data.

