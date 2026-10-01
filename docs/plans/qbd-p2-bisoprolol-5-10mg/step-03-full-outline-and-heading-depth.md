# Step 03 — The full house outline and real heading nesting

Status: pass · Gate: G-03 · Blocks: step 04 · Closes: W-1, W-2, W-3

## Requirement

The outline holds 11 leaf sections and no parent headings. The rendered document jumps from
`3.2.P.2 PHÁT TRIỂN DƯỢC HỌC` straight to `3.2.P.2.1.1 DƯỢC CHẤT`, and `render/builder.mjs` emits
`h1()` for all eleven, so `3.2.P.2.1.1` sits at the same level as `3.2.P.2.3`. Word's navigation pane
and any generated table of contents come out flat. The house example's risk-assessment group, its
QTPP/CQA split and its dissolution-method breakdown have no home at all.

Bring the outline to the shape of `docs/raw/135-00-Pharmaceutical Development-example.docx` and derive
heading level from CTD depth.

## Target outline — 12 containers, 26 leaves

A **container** carries only a heading; a draft holds no entry for it.

| CTD | Kind | Section |
|---|---|---|
| 3.2.P.2.1 | container | Components of the drug product |
| 3.2.P.2.1.1 | container | Drug substance |
| 3.2.P.2.1.1.1 | leaf | Physicochemical properties — the 18-row General properties form |
| 3.2.P.2.1.1.2 | leaf | Biological properties |
| 3.2.P.2.1.2 | container | Excipients |
| 3.2.P.2.1.2.1 | leaf | Physicochemical properties |
| 3.2.P.2.1.2.2 | leaf | Drug substance–excipient compatibility |
| 3.2.P.2.2 | container | Drug product |
| 3.2.P.2.2.1 | container | Formulation development |
| 3.2.P.2.2.1.1 | leaf | Characterization of the reference product |
| 3.2.P.2.2.1.2 | container | Quality target product profile and CQAs |
| 3.2.P.2.2.1.2.1 | leaf | QTPP |
| 3.2.P.2.2.1.2.2 | leaf | CQAs and criticality reasoning |
| 3.2.P.2.2.1.3 | container | Formulation development study |
| 3.2.P.2.2.1.3.1 | leaf | Preliminary experiments |
| 3.2.P.2.2.1.3.2 | leaf | Initial risk assessment of formulation variables |
| 3.2.P.2.2.1.3.3 | leaf | Formulation development study |
| 3.2.P.2.2.1.3.4 | leaf | Updated risk assessment of formulation variables |
| 3.2.P.2.2.1.3.5 | leaf | Final formulation — per strength |
| 3.2.P.2.2.2 | leaf | Overages |
| 3.2.P.2.2.3 | container | Physicochemical and biological properties |
| 3.2.P.2.2.3.1 | container | Development of a dissolution method |
| 3.2.P.2.2.3.1.1 | leaf | Sink condition |
| 3.2.P.2.2.3.1.2 | leaf | Dissolution method |
| 3.2.P.2.2.3.1.3 | leaf | Discriminatory power |
| 3.2.P.2.2.3.1.4 | leaf | Comparative dissolution profile |
| 3.2.P.2.2.3.2 | leaf | Impurity profile of the tablets |
| 3.2.P.2.3 | container | Manufacturing process development |
| 3.2.P.2.3.1 | leaf | Initial risk assessment of the manufacturing process |
| 3.2.P.2.3.2 | container | Studies development |
| 3.2.P.2.3.2.1 | leaf | Process development |
| 3.2.P.2.3.2.2 | leaf | Updated risk assessment |
| 3.2.P.2.3.2.3 | leaf | Scale-up from lab to pilot and commercial scale |
| 3.2.P.2.4 | container | Container closure system |
| 3.2.P.2.4.1 | leaf | Primary packaging material |
| 3.2.P.2.4.2 | leaf | Secondary packaging material |
| 3.2.P.2.5 | leaf | Microbiological attributes |
| 3.2.P.2.6 | leaf | Compatibility |

The approved plan estimated "10 containers and 28 leaves". The exact figure from the source table of
contents is **12 and 26**; `gates.yaml` records the exact figure and this table is the authority.

## Two deviations from the source, both needing an FD signature

The house example's own numbering has two defects, recorded in `gates.yaml` under
`form_authority.known_defects`. They are not copied:

1. `3.2.P.2.2.3.1.2` is used twice — once for the dissolution method, once for discriminatory power.
   Renumbered here as `.1.1` sink condition, `.1.2` dissolution method, `.1.3` discriminatory power,
   `.1.4` comparative dissolution profile.
2. `3.2.P.2.2.3.1.1.3` is a depth-6 number sitting inside a depth-5 group; it becomes `.1.4` above.

A third point is a reading, not a defect: the source numbers only `3.2.P.2.2.1.2.1` explicitly, while
its parent heading names both QTPP and CQAs and its body carries the two as separate tables. Splitting
into `.2.1` and `.2.2` follows that body. Record all three for FD confirmation; do not present them as
settled.

## Files

- modify `tools/pharma-dev-draft/schemas/p2-outline.json`
- modify `tools/pharma-dev-draft/draft/validate-draft.mjs`
- modify `tools/pharma-dev-draft/render/builder.mjs`
- modify `tools/pharma-dev-draft/verify/verify.mjs`
- modify `tools/pharma-dev-draft/draft/tests/table-layout.test.mjs`

## Implementation

1. `container: true` on the twelve entries above. Each keeps `ctdReference` and `headingVi`; none
   carries `form`.
2. Validator: a draft entry for a container id fails `E_SECTION_CONTAINER_HAS_ENTRY`; the
   missing-section check covers leaves only.
3. Renderer: heading level is derived by counting the depth of `ctdReference` — `3.2.P.2` is the
   document's top level and each further component drops one level, clamped to what Word supports. A
   `heading2`/`heading3` block inside a section renders one level below that section's own level, so a
   section's sub-headings can never outrank their parent. **No id-to-level map anywhere**; such a map
   is the hard-coding this plan exists to remove, and it fails G-00.
4. Renderer: a container emits its heading and nothing else. The gap register iterates leaves only —
   a container has no data status to report and listing one would be a false row.
5. Verifier: extract the heading outline levels from `word/document.xml` in document order and assert
   no step increases by more than one. That is the machine test for W-1 and W-2, and it holds for any
   product's outline rather than for this one.
6. Move the `rowsFrom` target of the process risk matrix: the quality-attribute table moves from
   `P.2.2.1.2` to `P.2.2.1.2.1`, so the matrix must reference the new id. G-05 catches it if missed.

## Validation

- `node --check`; `npm run test:pharma-dev`.
- Render and run `verify.mjs`: XSD passes, no level skip, twelve container headings each once.
- Open the file and read Word's navigation pane — the CTD tree must nest. This is the one check the
  test suite cannot make for you.
- Gap register lists 26 rows, no container.

## Risks and rollback

Word supports a bounded number of built-in heading levels and the deepest leaf here is depth 5 below
the document title. Confirm the clamp lands on a real style rather than silently producing body text.

If the depth derivation cannot be made to work, revert to the flat form and reopen W-1/W-2 rather than
hand-maintaining a level map. A flat heading tree is a known, recorded deviation; a hand-kept map is a
new source of truth that will go stale on the next outline change.
