"""Group body paragraphs by direct formatting; print masked samples only. python3 -I extract_paragraphs.py file.docx"""

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
KEEP = {"Low", "Medium", "High", "Table", "Figure", "Comment", "Not", "applicable", "Product", "Module", "Issue", "date"}


def parse(z, name):
    data = z.read(name)
    if b"<!DOCTYPE" in data[:2000] or b"<!ENTITY" in data[:5000]:
        raise SystemExit("refusing: DOCTYPE/ENTITY")
    return ET.fromstring(data)


def mask(text, limit=34):
    return " ".join(w if w in KEEP else re.sub(r"[0-9]", "9", re.sub(r"[a-zà-ỹ]", "a", re.sub(r"[A-ZÀ-Ỹ]", "A", w))) for w in text[:limit].split(" "))


def text_of(el):
    return "".join(t.text or "" for t in el.iter(W + "t"))


def val(el, name):
    child = el.find(W + name) if el is not None else None
    return None if child is None else child.get(W + "val")


def rsig(r):
    pr = r.find(W + "rPr")
    if pr is None:
        return ()
    sz = val(pr, "sz")
    fonts = pr.find(W + "rFonts")
    return tuple(sorted({
        "font=" + str(fonts.get(W + "ascii")) if fonts is not None else "font=-",
        "sz=" + str(int(sz) / 2 if sz and sz.isdigit() else None),
        *(k for k in ("b", "i", "caps") if pr.find(W + k) is not None and val(pr, k) not in ("0", "false")),
        *(["u"] if pr.find(W + "u") is not None else []),
        *(["color=" + val(pr, "color")] if val(pr, "color") not in (None, "auto", "000000") else []),
    }))


def main(path):
    z = parse and zipfile.ZipFile(path)
    doc = parse(z, "word/document.xml")
    body = doc.find(W + "body")
    sigs, samples, starts = Counter(), defaultdict(list), Counter()
    for p in body.findall(W + "p"):
        txt = text_of(p).strip()
        if not txt:
            continue
        pr = p.find(W + "pPr")
        sp = pr.find(W + "spacing") if pr is not None else None
        ind = pr.find(W + "ind") if pr is not None else None
        num = pr.find(W + "numPr") if pr is not None else None
        runs = [r for r in p.iter(W + "r") if text_of(r).strip()]
        sig = (
            val(pr, "jc"),
            tuple(sorted((k, sp.get(W + k)) for k in ("before", "after", "line") if sp is not None and sp.get(W + k))),
            tuple(sorted((k, ind.get(W + k)) for k in ("left", "hanging", "firstLine") if ind is not None and ind.get(W + k))),
            ("num", val(num, "numId"), val(num, "ilvl")) if num is not None else None,
            "keepNext" if pr is not None and pr.find(W + "keepNext") is not None else None,
            rsig(runs[0]) if runs else (),
        )
        key = json.dumps(sig, default=list)
        sigs[key] += 1
        if len(samples[key]) < 3:
            samples[key].append(mask(txt))
        starts[re.sub(r"[0-9]+", "9", txt[:12]) if re.match(r"P\.\d", txt) else "other"] += 1
    out = {"typedNumberPatterns": starts.most_common(8), "paragraphGroups": [{"count": c, "signature": json.loads(k), "samples": samples[k]} for k, c in sigs.most_common(14)]}

    num = parse(z, "word/numbering.xml")
    nums = {n.get(W + "numId"): n.find(W + "abstractNumId").get(W + "val") for n in num.findall(W + "num")}
    abstract = {a.get(W + "abstractNumId"): a for a in num.findall(W + "abstractNum")}
    wanted = sorted({sig[3][1] for sig in (json.loads(k) for k in sigs) if sig[3]}, key=lambda x: int(x))
    levels = {}
    for nid in wanted[:6]:
        a = abstract[nums[nid]]
        levels[nid] = [
            {"lvl": l.get(W + "ilvl"), "fmt": val(l, "numFmt"), "text": val(l, "lvlText"), "suff": val(l, "suff"), "ind": dict(l.find(f"{W}pPr/{W}ind").attrib) if l.find(f"{W}pPr/{W}ind") is not None else None}
            for l in a.findall(W + "lvl")[:5]
        ]
    out["numberingUsed"] = levels
    print(json.dumps(out, ensure_ascii=False, indent=1, default=list))


main(sys.argv[1])
