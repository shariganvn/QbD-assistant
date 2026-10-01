# Step 08 — The drug substance's physicochemical values

Status: pass · Gate: G-12

## What was blocking, and what changed

The request was to fill the properties table from PubMed. Two things stood in the way. PubMed is the
wrong database — it indexes citations and abstracts, while systematic name, melting point, partition
coefficient and dissociation constant live in PubChem, DrugBank or a pharmacopoeial monograph. And
every one of those was denied at the egress proxy.

The network policy was opened. PubChem answers now; EMA and FDA accessdata are still denied, and
DrugBank returns 403 from its own bot protection, which does not matter because PubChem carries
DrugBank's values with attribution.

## The finding that shaped every cell

**The salt has no experimental record.** CID 5281064 is bisoprolol fumarate — the drug substance —
and PubChem answers `PUGVIEW.NotFound` for its Experimental Properties. Melting point, partition
coefficient and dissociation constant all belong to the **free base**, CID 2405.

Attributing a free-base property to the salt without saying so is the same error as W-5, which is
still open in this document. So every filled cell names which species its value describes.

One exception matters: an HSDB record is annotated `/Bisoprolol hemifumarate/`. Hemifumarate, the 2:1
salt, *is* bisoprolol fumarate, so its 100 °C melting point speaks directly about the drug substance.
That is the only such value, and the cell distinguishes it from the free base's 100–103 °C.

## What went in

| Cell | Value | Species |
|---|---|---|
| Systematic name | the salt's name, **computed** by PubChem, not measured | salt |
| Melting point | 100 °C (hemifumarate) and 100–103 °C (free base), both stated | both, labelled |
| Partition coefficient | 2,2 and 1,87 — two published values, both stated | free base |
| Dissociation constant | 9,57 · 9,5 · 9,27 with 14,09 — replaces an unsourced "≈ 9,5" | free base |
| Structural formula | the 2D structure image, the first use of the `image` block | salt |

A new numbered source note carries the compound identifiers, the retrieval URLs and the date; which
value came from DrugBank, HMDB, HSDB or ChEMBL; and which descriptors PubChem computes rather than
measures.

**Nothing was chosen where the sources disagree.** Two partition coefficients and three dissociation
constants are all stated with their origins. Picking one silently would present a preference as a
finding, and it is FD's call against the applicable monograph.

**The solubility row was not touched.** It cites the batch certificate — very soluble in water, freely
soluble in methanol. HSDB says the hemifumarate is soluble in ethanol, which does not contradict it,
being a different solvent. But W-9 is precisely the story of ethanol displacing what the certificate
said, so ethanol appears only in the source note.

## What this does not close

**W-5 stays open.** DrugBank, HMDB, HSDB and ChEMBL are secondary aggregators; W-5 asks for
reconciliation against the monograph. The cells moved from unsourced to sourced-and-retrievable, which
is what G-12 asks, and no further.

**The five forced-degradation rows stay gaps.** They are experimental results on the substance in use
here and belong to `3.2.S.7`. No public database closes them, and opening the network did not change
that.

## A source found along the way, worth more than expected

Searching PubMed produced the FIP/WHO biowaiver monograph for bisoprolol fumarate itself — J Pharm Sci
2014;103(2):378–91, PMID 24382794, doi:10.1002/jps.23817, with Dressman, Polli, Shah, Kopp and
Langguth among the authors.

It closed a section that was not in this step's scope, and sharpened a request that was vague:

- `3.2.P.2.1.1.2` biological properties held nothing but a marker. It now states BCS Class I with the
  citation, and keeps a marker for what remains — measured permeability and absolute bioavailability
  for this material, and pH-dependent solubility, which is the first half of the classification and is
  not in the file.
- `3.2.P.2.2.3.1.4` asked only for "dissolution at several time points". The monograph states the
  conditions exactly: similarity at pH 1,2 · 4,5 · 6,8, or both products very rapidly dissolving. That
  is the only route by which the 5 mg strength avoids a bioequivalence study in people, so the document
  now names what that route requires. Because the data-request annex is read out of the markers, the
  request updated itself.
