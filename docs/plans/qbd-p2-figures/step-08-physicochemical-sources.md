# Step 08 — The drug substance's physicochemical values

Status: blocked · Gate: G-12

## Why nothing was written

The request was to fill the properties table from PubMed. Two things stopped that, and neither is
worked around.

**PubMed is the wrong database.** It indexes citations and abstracts. IUPAC name, melting point,
partition coefficient and dissociation constant live in PubChem, DrugBank or a pharmacopoeial
monograph.

**All of them are blocked.** `pubchem.ncbi.nlm.nih.gov` and `eutils.ncbi.nlm.nih.gov` answer HTTP 403
at the egress proxy — a policy denial, seen through `curl`, through the fetch tool, and in the proxy's
own rejection log. EMA, FDA accessdata, DrugBank and ChemicalBook are blocked the same way. Web search
still works, but it returns snippets and a summary rather than a record with a link to follow, and the
department asked for sources it can retrieve.

Writing a value from a snippet would repeat this document's own worst failure exactly: W-9, where a
value everyone "knows" sat in the draft through four passes stating the substance dissolves freely in
ethanol, while the certificate of analysis said methanol. The cells keep their markers, and each marker
names where the value would come from.

## What opening the network actually closes

Three of the eight empty cells: IUPAC name, melting point, partition coefficient — the last with
computed and experimentally determined values kept apart, since a predicted coefficient presented as
measured is the same class of error.

Not the other five. The forced-degradation rows are experimental results on the drug substance in use
here and belong to `3.2.S.7`; a published study on another manufacturer's material is not this batch's
stability data.

## To unblock

Environment settings, Network access: a broader access level, or those hosts added to the allowed list.
Then this step fetches the values with their compound identifier and retrieval URL, and pulls the 2D
structure image into `assets/` for the `image` block that is already waiting for it.
