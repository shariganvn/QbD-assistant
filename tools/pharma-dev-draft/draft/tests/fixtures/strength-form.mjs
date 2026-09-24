// A purpose-built form and matching draft builder, used to prove the strength rules on a shape that
// exists only for that purpose. Testing them against the department's current outline would tie the
// proof to whichever tables that outline happens to hold today; here the rule itself is what gets
// exercised, for any number of strengths.
//
// Kept out of a *.test.mjs file so the evidence scripts can import it without running a test suite.

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
  ],
};

export function strengthDraft(strengths, { groupLabels, group2Labels } = {}) {
  const single = groupLabels ?? strengths;
  const paired = group2Labels ?? strengths.flatMap((s) => [`${s} (mg)`, `${s} (%)`]);
  return {
    schemaVersion: "1.0",
    meta: {
      productName: "Sản phẩm thử nghiệm quy tắc, viên nén bao phim",
      apiName: "Hoạt chất thử nghiệm",
      strengths,
      sourceFile: "fixture.docx",
      draftDate: "2026-09-24",
      preparer: "bộ kiểm quy tắc",
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
    ],
  };
}
