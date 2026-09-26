// A purpose-built form and matching draft builder, used to prove the strength rules on a shape that
// exists only for that purpose. Testing them against the department's current outline would tie the
// proof to whichever tables that outline happens to hold today; here the rule itself is what gets
// exercised, for any number of strengths.
//
// Kept out of a *.test.mjs file so the evidence scripts can import it without running a test suite.

import { GAP_PREFIX } from "../../../schemas/markers.mjs";

// Two group sizes, both of which occur in the department's reference document: one column per strength
// in the composition comparison, and a mass plus a per-cent column each in the final formula. Neither
// table declares its group size — the validator derives it.
export const STRENGTH_OUTLINE = {
  schemaVersion: "1.0",
  sections: [
    {
      id: "X.1",
      ctdReference: "3.2.X.1",
      headingVi: "Một cột mỗi hàm lượng",
      form: { headings: [], tables: [{ columns: ["Thành phần"], perStrength: true, rows: "variable" }] },
    },
    {
      id: "X.2",
      ctdReference: "3.2.X.2",
      headingVi: "Hai cột mỗi hàm lượng",
      form: { headings: [], tables: [{ columns: ["STT", "Tên thành phần"], perStrength: true, rows: "variable" }] },
    },
    {
      // A results table. This is the distinction the whole rule rests on: a composition is a declared
      // quantity, so proportion can supply it, while a result is measured on a batch that either
      // exists or does not.
      id: "X.3",
      ctdReference: "3.2.X.3",
      headingVi: "Kết quả đo theo hàm lượng",
      form: {
        headings: [],
        tables: [{ columns: ["Chỉ tiêu"], perStrength: true, measuredOnly: true, rows: "variable" }],
      },
    },
  ],
};

// A strength that was actually made carries a measurement; one derived by proportion carries a marker
// naming where the measurement would have to come from.
function measuredCell(label, strengths, derivedStrengths) {
  const named = strengths.filter((s) => label.includes(s)).sort((a, b) => b.length - a.length)[0];
  return derivedStrengths.includes(named)
    ? `${GAP_PREFIX} – CẦN BỔ SUNG] cần lô ${named} được bào chế thật`
    : "98,64";
}

export function strengthDraft(strengths, { groupLabels, group2Labels, derivedStrengths = [] } = {}) {
  const single = groupLabels ?? strengths;
  const paired = group2Labels ?? strengths.flatMap((s) => [`${s} (mg)`, `${s} (%)`]);
  return {
    schemaVersion: "1.0",
    meta: {
      productName: "Sản phẩm thử nghiệm quy tắc, viên nén bao phim",
      apiName: "Hoạt chất thử nghiệm",
      strengths,
      ...(derivedStrengths.length ? { derivedStrengths } : {}),
      sourceFiles: ["fixture.docx"],
      draftDate: "2026-09-24",
      assembledBy: "bộ kiểm quy tắc",
      extractionMethod: "xml-walk",
    },
    sections: [
      {
        id: "X.1",
        status: "covered",
        blocks: [{
          type: "table",
          headers: ["Thành phần", ...single],
          rows: [["Hoạt chất", ...single.map(() => "10,00")]],
        }],
      },
      {
        id: "X.2",
        status: "covered",
        blocks: [{
          type: "table",
          headers: ["STT", "Tên thành phần", ...paired],
          rows: [["1", "Hoạt chất", ...paired.map(() => "10,00")]],
        }],
      },
      {
        id: "X.3",
        status: "covered",
        blocks: [{
          type: "table",
          headers: ["Chỉ tiêu", ...single],
          rows: [
            ["Độ hòa tan", ...single.map((label) => measuredCell(label, strengths, derivedStrengths))],
            ["Độ cứng", ...single.map((label) => measuredCell(label, strengths, derivedStrengths))],
          ],
        }],
      },
    ],
  };
}
