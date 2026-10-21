"""Print FORMAT tokens of a docx (fonts, sizes, colours, borders, margins, numbering, captions).

Never prints body text: any text shown is masked to its shape (letters -> a/A, digits -> 9).
Usage: python3 -I extract_format.py <file.docx>
"""

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
WP = "{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}"
KEEP_WORDS = {"Low", "Medium", "High", "Yes", "No", "NA", "ND", "Table", "Figure", "Comment"}


def parse(archive, name):
    data = archive.read(name)
    if b"<!DOCTYPE" in data[:2000] or b"<!ENTITY" in data[:5000]:
        raise SystemExit(f"refusing {name}: DOCTYPE or ENTITY declaration")
    return ET.fromstring(data)


def mask(text, limit=40):
    out = []
    for word in text[:limit].split(" "):
        out.append(word if word in KEEP_WORDS else re.sub(r"[0-9]", "9", re.sub(r"[a-zà-ỹ]", "a", re.sub(r"[A-ZÀ-Ỹ]", "A", word))))
    return " ".join(out)


def attr(el, name):
    return None if el is None else el.get(W + name)


def rpr(el):
    if el is None:
        return {}
    fonts = el.find(W + "rFonts")
    out = {}
    if fonts is not None:
        out["font"] = fonts.get(W + "ascii") or fonts.get(W + "hAnsi") or fonts.get(W + "asciiTheme")
    for tag, key in (("sz", "size_pt"), ("color", "color"), ("u", "underline")):
        child = el.find(W + tag)
        if child is not None:
            value = child.get(W + "val")
            out[key] = int(value) / 2 if key == "size_pt" and value and value.isdigit() else value
    for tag in ("b", "i", "caps", "smallCaps"):
        child = el.find(W + tag)
        if child is not None and child.get(W + "val") not in ("0", "false"):
            out[tag] = True
    return out


def ppr(el):
    if el is None:
        return {}
    out = {}
    sp = el.find(W + "spacing")
    if sp is not None:
        out["spacing"] = {k: sp.get(W + k) for k in ("before", "after", "line", "lineRule") if sp.get(W + k)}
    ind = el.find(W + "ind")
    if ind is not None:
        out["ind"] = {k: ind.get(W + k) for k in ("left", "hanging", "firstLine") if ind.get(W + k)}
    for tag in ("jc", "outlineLvl"):
        child = el.find(W + tag)
        if child is not None:
            out[tag] = child.get(W + "val")
    num = el.find(W + "numPr")
    if num is not None:
        out["numPr"] = {"ilvl": attr(num.find(W + "ilvl"), "val"), "numId": attr(num.find(W + "numId"), "val")}
    for tag in ("keepNext", "keepLines", "pageBreakBefore"):
        if el.find(W + tag) is not None:
            out[tag] = True
    return out


def text_of(el):
    return "".join(t.text or "" for t in el.iter(W + "t"))


def main(path):
    z = zipfile.ZipFile(path)
    styles = parse(z, "word/styles.xml")
    doc = parse(z, "word/document.xml")
    report = {}

    d = styles.find(W + "docDefaults")
    report["docDefaults"] = {"rPr": rpr(d.find(f"{W}rPrDefault/{W}rPr")), "pPr": ppr(d.find(f"{W}pPrDefault/{W}pPr"))} if d is not None else {}

    used = Counter(attr(p.find(f"{W}pPr/{W}pStyle"), "val") or "(none)" for p in doc.iter(W + "p"))
    tbl_used = Counter(attr(t.find(f"{W}tblPr/{W}tblStyle"), "val") or "(none)" for t in doc.iter(W + "tbl"))
    defs = {}
    for s in styles.findall(W + "style"):
        sid = s.get(W + "styleId")
        defs[sid] = {"name": attr(s.find(W + "name"), "val"), "type": s.get(W + "type"), "basedOn": attr(s.find(W + "basedOn"), "val"), "rPr": rpr(s.find(W + "rPr")), "pPr": ppr(s.find(W + "pPr"))}
    report["paragraphStylesUsed"] = {k: {"count": v, **defs.get(k, {})} for k, v in used.most_common(14)}
    report["tableStylesUsed"] = {k: {"count": v, "name": defs.get(k, {}).get("name")} for k, v in tbl_used.most_common(5)}

    sects = []
    for sp in doc.iter(W + "sectPr"):
        size, mar = sp.find(W + "pgSz"), sp.find(W + "pgMar")
        sects.append(json.dumps({
            "page": {k: size.get(W + k) for k in ("w", "h", "orient") if size is not None and size.get(W + k)},
            "margins": {k: mar.get(W + k) for k in ("top", "bottom", "left", "right", "header", "footer") if mar is not None and mar.get(W + k)},
            "header": sorted({r.get(W + "type") for r in sp.findall(W + "headerReference")}),
            "footer": sorted({r.get(W + "type") for r in sp.findall(W + "footerReference")}),
            "titlePg": sp.find(W + "titlePg") is not None,
        }, sort_keys=True))
    report["sections"] = Counter(sects).most_common(5)

    parts = {}
    for name in sorted(n for n in z.namelist() if re.fullmatch(r"word/(header|footer)\d+\.xml", n)):
        root = parse(z, name)
        fields = sorted({(i.text or "").strip().split(" ")[0] for i in root.iter(W + "instrText")} | {(f.get(W + "instr") or "").strip().split(" ")[0] for f in root.iter(W + "fldSimple")})
        paras = root.findall(f".//{W}p")
        parts[name] = {"paragraphs": len(paras), "tables": len(root.findall(f".//{W}tbl")), "images": len(list(root.iter(A + "blip"))), "fields": fields, "maskedText": [mask(text_of(p)) for p in paras if text_of(p).strip()][:4], "firstParagraph": {"pPr": ppr(paras[0].find(W + "pPr")), "rPr": rpr(next(paras[0].iter(W + "rPr"), None))} if paras else {}}
    report["headersFooters"] = parts

    num = parse(z, "word/numbering.xml")
    nums = {n.get(W + "numId"): attr(n.find(W + "abstractNumId"), "val") for n in num.findall(W + "num")}
    abstract = {a.get(W + "abstractNumId"): a for a in num.findall(W + "abstractNum")}
    heads = {sid: d for sid, d in defs.items() if (d["name"] or "").lower().startswith("heading")}
    levels = {}
    for sid, d in sorted(heads.items(), key=lambda kv: kv[1]["name"]):
        info = {"name": d["name"], "rPr": d["rPr"], "pPr": d["pPr"], "paragraphs": used.get(sid, 0)}
        np = d["pPr"].get("numPr")
        if np and np.get("numId") in nums and nums[np["numId"]] in abstract:
            for lvl in abstract[nums[np["numId"]]].findall(W + "lvl"):
                if lvl.get(W + "ilvl") == (np.get("ilvl") or "0"):
                    info["autoNumber"] = {"numFmt": attr(lvl.find(W + "numFmt"), "val"), "lvlText": attr(lvl.find(W + "lvlText"), "val"), "suff": attr(lvl.find(W + "suff"), "val")}
        levels[sid] = info
    report["headingStyles"] = {k: v for k, v in levels.items() if v["paragraphs"]}
    typed = Counter()
    examples = []
    for p in doc.iter(W + "p"):
        if (attr(p.find(f"{W}pPr/{W}pStyle"), "val") or "") in heads and used.get(attr(p.find(f"{W}pPr/{W}pStyle"), "val"), 0):
            t = text_of(p).strip()
            typed["starts_with_P_number" if re.match(r"P\.?\d", t) else "starts_other"] += 1
            if len(examples) < 6:
                examples.append(mask(t, 30))
    report["headingText"] = {"typedPattern": dict(typed), "maskedExamples": examples}

    caps, seq = [], 0
    for p in doc.iter(W + "p"):
        t = text_of(p).strip()
        if re.match(r"(Table|Figure)\s*\d", t):
            runs = [rpr(r.find(W + "rPr")) for r in p.iter(W + "r")][:2]
            caps.append({"label": t.split(" ")[0], "style": attr(p.find(f"{W}pPr/{W}pStyle"), "val"), "pPr": ppr(p.find(W + "pPr")), "firstRuns": runs, "hasSEQ": any("SEQ" in (i.text or "") for i in p.iter(W + "instrText")) or any("SEQ" in (f.get(W + "instr") or "") for f in p.iter(W + "fldSimple")), "masked": mask(t, 25)})
    by = Counter(c["label"] for c in caps)
    report["captions"] = {"counts": dict(by), "samples": [next((c for c in caps if c["label"] == lab), None) for lab in by]}

    tables = list(doc.iter(W + "tbl"))
    fills, borders, header_rows, risk_fills, cellsz, cellfont, widths, layouts, mars, jcs = Counter(), Counter(), Counter(), Counter(), Counter(), Counter(), Counter(), Counter(), Counter(), Counter()
    for t in tables:
        pr = t.find(W + "tblPr")
        b = pr.find(W + "tblBorders") if pr is not None else None
        borders[json.dumps({e.tag.replace(W, ""): (e.get(W + "val"), e.get(W + "sz"), e.get(W + "color")) for e in b} if b is not None else {}, sort_keys=True)] += 1
        layouts[attr(pr.find(W + "tblLayout"), "val") if pr is not None else None] += 1
        cm = pr.find(W + "tblCellMar") if pr is not None else None
        mars[json.dumps({e.tag.replace(W, ""): e.get(W + "w") for e in cm} if cm is not None else {}, sort_keys=True)] += 1
        jcs[attr(pr.find(W + "jc"), "val") if pr is not None else None] += 1
        rows = t.findall(W + "tr")
        if rows:
            header_rows["repeatHeader" if rows[0].find(f"{W}trPr/{W}tblHeader") is not None else "noRepeat"] += 1
        for ri, tr in enumerate(rows):
            for tc in tr.findall(W + "tc"):
                shd = tc.find(f"{W}tcPr/{W}shd")
                txt = text_of(tc).strip()
                fill = shd.get(W + "fill") if shd is not None else None
                if fill and fill not in ("auto", "FFFFFF"):
                    fills[("firstRow" if ri == 0 else "body", fill)] += 1
                    if txt in ("Low", "Medium", "High"):
                        risk_fills[(txt, fill)] += 1
                elif txt in ("Low", "Medium", "High"):
                    risk_fills[(txt, "none")] += 1
                for r in tc.iter(W + "r"):
                    props = rpr(r.find(W + "rPr"))
                    if props.get("size_pt"):
                        cellsz[props["size_pt"]] += 1
                    if props.get("font"):
                        cellfont[props["font"]] += 1
        for g in t.findall(f"{W}tblGrid/{W}gridCol"):
            widths[len(t.findall(f"{W}tblGrid/{W}gridCol"))] += 0
    report["tables"] = {"count": len(tables), "borders": borders.most_common(4), "layout": dict(layouts), "cellMargins": mars.most_common(3), "alignment": dict(jcs), "headerRow": dict(header_rows), "fills": [[list(k), v] for k, v in fills.most_common(8)], "riskWordFills": [[list(k), v] for k, v in risk_fills.most_common(8)], "cellFontSizes": cellsz.most_common(5), "cellFonts": cellfont.most_common(3)}

    fonts, sizes, colors = Counter(), Counter(), Counter()
    for r in doc.iter(W + "r"):
        props = rpr(r.find(W + "rPr"))
        fonts[props.get("font")] += 1
        sizes[props.get("size_pt")] += 1
        colors[props.get("color")] += 1
    report["bodyRuns"] = {"fonts": fonts.most_common(4), "sizesPt": sizes.most_common(6), "colors": colors.most_common(5)}

    ext = Counter()
    anchors = {"inline": len(list(doc.iter(WP + "inline"))), "anchor": len(list(doc.iter(WP + "anchor")))}
    for e in doc.iter(WP + "extent"):
        ext[(round(int(e.get("cx")) / 360000, 1), round(int(e.get("cy")) / 360000, 1))] += 1
    report["figures"] = {"placement": anchors, "extentsCm_cx_cy": ext.most_common(6)}

    instr = Counter()
    for i in doc.iter(W + "instrText"):
        instr[(i.text or "").strip().split(" ")[0]] += 1
    for f in doc.iter(W + "fldSimple"):
        instr[(f.get(W + "instr") or "").strip().split(" ")[0]] += 1
    report["fields"] = dict(instr.most_common(8))
    report["pageBreaks"] = {"br_page": sum(1 for b in doc.iter(W + "br") if b.get(W + "type") == "page"), "pageBreakBefore": sum(1 for _ in doc.iter(W + "pageBreakBefore"))}
    print(json.dumps(report, ensure_ascii=False, indent=1, default=list))


main(sys.argv[1])
