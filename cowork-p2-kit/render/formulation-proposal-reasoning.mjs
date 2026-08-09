const REASONING_HEADERS = ["Công thức", "Dẫn chứng theo quy tắc đề xuất", "Diễn giải"];

function fail(message) {
  throw new Error(`[E_FORMULATION_REASONING] ${message}`);
}

function numberValue(value, label) {
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) fail(`${label} must be numeric`);
  return parsed;
}

function decimal(value) {
  return numberValue(value, "value").toLocaleString("vi-VN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function scalar(value) {
  return numberValue(value, "value").toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  });
}

function tableMap(rows, label) {
  const map = new Map(rows.map((row) => [row[0], row]));
  if (map.size !== rows.length) fail(`${label} contains duplicate measures`);
  return map;
}

export function buildProposalReasoning({ evidenceRows, specificationRows, proposedSurvivor }) {
  if (!Array.isArray(evidenceRows) || evidenceRows.length !== 3) fail("three formula evidence rows are required");
  if (!Array.isArray(specificationRows) || specificationRows.length !== 3) fail("three specification rows are required");
  if (typeof proposedSurvivor !== "string" || proposedSurvivor.length === 0) fail("proposed survivor is required");

  const specs = tableMap(specificationRows, "specification rows");
  const dissolution = specs.get("Dissolution");
  const assaySpec = specs.get("Assay");
  const cu = specs.get("Content uniformity AV");
  if (!dissolution || !assaySpec || !cu) fail("required specification rows are missing");

  const dissolutionThreshold = numberValue(dissolution[2], "dissolution threshold");
  const cuThreshold = numberValue(cu[2], "CU threshold");
  const details = [];
  const rows = evidenceRows.map((row) => {
    if (!Array.isArray(row) || row.length < 5) fail("formula evidence row is incomplete");
    const formula = row[0];
    const label = formula.replace("formula-", "CT");
    const minimum = numberValue(row[1], `${formula} dissolution minimum`);
    const mean = numberValue(row[2], `${formula} dissolution mean`);
    const assay = numberValue(row[3], `${formula} assay`);
    const cuValue = numberValue(row[4], `${formula} CU AV`);
    const minimumPasses = minimum >= dissolutionThreshold;
    const assayPasses = assay >= 90 && assay <= 110;
    const cuPasses = cuValue < cuThreshold;
    details.push({
      formula,
      label,
      minimum,
      mean,
      assay,
      cuValue,
      dissolutionThreshold,
      cuThreshold,
      assayPasses,
      cuPasses,
    });
    const evidence = minimumPasses
      ? `Dissolution tối thiểu ${decimal(minimum)}% ≥ ${scalar(dissolutionThreshold)}%; trung bình ${decimal(mean)}%; assay ${decimal(assay)}%; CU AV ${decimal(cuValue)}.`
      : `Dissolution tối thiểu ${decimal(minimum)}% < ${scalar(dissolutionThreshold)}%.`;
    const rationale = minimumPasses
      ? `${label} đạt ngưỡng dissolution tối thiểu${assayPasses && cuPasses ? "; assay và CU AV cũng đạt giới hạn nêu trên" : ""}; chỉ được nêu như đề xuất kỹ thuật có điều kiện.`
      : `${label} không đạt ngưỡng dissolution tối thiểu và không được nêu là ứng viên đề xuất.`;
    return [label, evidence, rationale];
  });

  const summary = `Quy tắc đề xuất: dissolution tối thiểu ${dissolution[1]} ${scalar(dissolutionThreshold)}%; assay ${assaySpec[1]} (giới hạn bao gồm); CU AV ${cu[1]}${scalar(cuThreshold)}. Dissolution trung bình chỉ là chỉ số so sánh; dissolution tối đa chỉ mang tính chẩn đoán.`;
  const boundary = `Giới hạn reasoning: ${proposedSurvivor.replace("formula-", "CT")} chỉ được nêu có điều kiện từ các kiểm tra cơ học này. FD chưa xác nhận, nên chưa có quyết định hay khuyến nghị của FD.`;
  if (!rows.some((row) => row[0] === proposedSurvivor.replace("formula-", "CT"))) {
    fail("proposed survivor is absent from the evidence rows");
  }

  return { summary, rows, details, boundary };
}

export function buildProposalConclusion(reasoning) {
  const byFormula = new Map(reasoning.details.map((detail) => [detail.label, detail]));
  const ct01 = byFormula.get("CT01");
  const ct02 = byFormula.get("CT02");
  const ct03 = byFormula.get("CT03");
  if (!ct01 || !ct02 || !ct03) fail("CT01, CT02, and CT03 evidence are required for the conclusion");
  const assayText = ct03.assayPasses ? `assay ${decimal(ct03.assay)}% trong khoảng 90–110` : `assay ${decimal(ct03.assay)}% ngoài khoảng 90–110`;
  const cuText = ct03.cuPasses ? `CU AV ${decimal(ct03.cuValue)} < ${scalar(ct03.cuThreshold)}` : `CU AV ${decimal(ct03.cuValue)} không đạt < ${scalar(ct03.cuThreshold)}`;
  return `Nhận xét (REVIEW ONLY): Theo quy tắc đề xuất, CT01 không đạt dissolution tối thiểu (${decimal(ct01.minimum)}% < ${scalar(ct01.dissolutionThreshold)}%) và CT02 cũng không đạt (${decimal(ct02.minimum)}% < ${scalar(ct02.dissolutionThreshold)}%). CT03 đạt dissolution tối thiểu (${decimal(ct03.minimum)}% ≥ ${scalar(ct03.dissolutionThreshold)}%), ${assayText}, ${cuText}; vì vậy CT03 là ứng viên duy nhất còn lại theo quy tắc đề xuất. Đây là đề xuất kỹ thuật có điều kiện, không phải quyết định hay khuyến nghị của FD; FD approved: false.`;
}

export const PROPOSAL_REASONING_HEADERS = REASONING_HEADERS;
