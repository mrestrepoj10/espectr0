import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const EXPECTED_MUNICIPALITY_COUNT = 1_123;
const EXPECTED_RAW_ROW_COUNT = 1_124;
const EXPECTED_PDF_SHA256 =
  "47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0";
const EXPECTED_PDF_PAGE_COUNT = 206;
const EXPECTED_AA_AV_PROJECTION_SHA256 =
  "34a9b7e54703037884eb44baf36c4626891b50f80ea9a50bce6b2e95fc331f14";
const APPENDIX_FIRST_PAGE = 171;
const APPENDIX_LAST_PAGE = 192;
const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
// Appendix A-4 uses one ruled table. These grid edges are stable under the
// pinned PDF hash; all glyph-dependent geometry below is measured from text.
const TABLE_GRID_LEFT_POINTS = 82.02;
const TABLE_GRID_RIGHT_POINTS = 529.92;
const ROW_VERTICAL_PADDING_POINTS = 1.1;
const VALUE_HORIZONTAL_PADDING_POINTS = 1.2;
const VALUE_VERTICAL_PADDING_POINTS = 0.8;
const GEOMETRY_EPSILON = 1e-9;

// Clause and table regions are pinned to the same immutable PDF as the
// municipality rows. The generator re-extracts each transcription from these
// normalized rectangles and asserts the coefficient-bearing tokens below.
const NORMATIVE_CITATION_DEFINITIONS = [
  {
    id: "a3.0-gravity-mass",
    reference: "A.3.0",
    pageNumber: 55,
    rect: { left: 0.05, top: 0.36, width: 0.9, height: 0.152 },
    requiredTokens: ["9.8", "M se expresa en kg"],
  },
  {
    id: "a3.4.2.1-fhe-applicability",
    reference: "A.3.4.2.1",
    pageNumber: 61,
    rect: { left: 0.05, top: 0.27, width: 0.9, height: 0.18 },
    requiredTokens: ["20 niveles", "60 m", "6 niveles", "18 m", "2T"],
  },
  {
    id: "a3.4.2.2-dynamic-required",
    reference: "A.3.4.2.2",
    pageNumber: 61,
    rect: { left: 0.05, top: 0.465, width: 0.9, height: 0.225 },
    requiredTokens: ["20 niveles", "60 m", "1aA", "5 niveles", "20 m", "D, E o F", "2T"],
  },
  {
    id: "a4.2.2-period-ceiling",
    reference: "Ecuación A.4.2-2",
    pageNumber: 80,
    rect: { left: 0.05, top: 0.235, width: 0.9, height: 0.115 },
    requiredTokens: ["1.75", "1.2A F", "menor de 1.2"],
  },
  {
    id: "a4.2.3-approximate-period",
    reference: "Ecuación A.4.2-3 y Tabla A.4.2-1",
    pageNumber: 80,
    rect: { left: 0.05, top: 0.365, width: 0.9, height: 0.38 },
    requiredTokens: [
      "0.047",
      "0.9",
      "0.072",
      "0.8",
      "0.073",
      "0.75",
      "0.049",
    ],
  },
  {
    id: "a4.3.1-base-shear",
    reference: "Ecuación A.4.3-1",
    pageNumber: 81,
    rect: { left: 0.05, top: 0.17, width: 0.9, height: 0.135 },
    requiredTokens: ["V S g M", "fracción de la de la gravedad"],
  },
  {
    id: "a4.3.2-force-distribution",
    reference: "Ecuaciones A.4.3-2 y A.4.3-3",
    pageNumber: 81,
    rect: { left: 0.05, top: 0.315, width: 0.9, height: 0.235 },
    requiredTokens: ["0.5", "2.5", "0.75", "0.5T", "2.0"],
  },
  {
    id: "a5.4.5-dynamic-minimum",
    reference: "A.5.4.5",
    pageNumber: 86,
    rect: { left: 0.05, top: 0.595, width: 0.9, height: 0.09 },
    requiredTokens: ["80 por ciento", "90 por ciento"],
  },
];

function round(value) {
  return Number(value.toFixed(10));
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const pdfFile = resolve(repositoryRoot, "public/nsr10-titulo-a-2017.pdf");
const municipalitiesFile = resolve(
  repositoryRoot,
  "lib/nsr10/data/municipios.json",
);
const manifestFile = resolve(
  repositoryRoot,
  "lib/nsr10/evidence/manifest.json",
);
const overridesFile = resolve(scriptDirectory, "nsr10-evidence-overrides.json");
const oracleFile = resolve(repositoryRoot, "lib/nsr10/data/oracle.json");
const oracleInputFile = resolve(
  repositoryRoot,
  "lib/nsr10/data/oracle-input.json",
);
const checkOnly = process.argv.includes("--check");
const reportJson = process.argv.includes("--report-json");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function runOracleGenerator() {
  const candidates =
    process.platform === "win32"
      ? [["py", "-3"], ["python"], ["python3"]]
      : [["python3"], ["python"]];
  let lastError;

  for (const [command, ...prefix] of candidates) {
    try {
      execFileSync(
        command,
        [
          ...prefix,
          resolve(scriptDirectory, "generate-nsr10-oracle.py"),
          ...(checkOnly ? ["--check"] : []),
        ],
        { cwd: repositoryRoot, stdio: "pipe" },
      );
      return;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      lastError = error;
    }
  }

  throw lastError ?? new Error("Python 3 is required for the NSR-10 oracle");
}

function assertOracleCaseInputs(municipalities, oracleInput) {
  const byLocation = new Map(
    municipalities.map((municipality) => [
      `${municipality.departamento}\u0000${municipality.municipio}`,
      municipality,
    ]),
  );
  for (const oracleCase of oracleInput.cases) {
    const municipality = byLocation.get(
      `${oracleCase.departamento}\u0000${oracleCase.municipio}`,
    );
    invariant(municipality, `Unknown oracle location ${oracleCase.id}`);
    invariant(
      municipality.aa === Number(oracleCase.aa) &&
        municipality.av === Number(oracleCase.av),
      `Oracle Aa/Av input changed for ${oracleCase.id}`,
    );
  }
}

async function assertOracleSourceLocks(oracle) {
  const sourceHashes = {};
  for (const [id, source] of Object.entries(oracle.sources)) {
    const bytes = await readFile(resolve(repositoryRoot, source.path));
    const actual = sha256(bytes);
    invariant(
      actual === source.sha256,
      `Oracle source ${id} changed: expected ${source.sha256}, found ${actual}`,
    );
    sourceHashes[id] = actual;
  }
  return sourceHashes;
}

async function assertOracleProgramLock(oracleInput) {
  const program = oracleInput.generator;
  const actual = sha256(await readFile(resolve(repositoryRoot, program.path)));
  invariant(
    actual === program.sha256,
    `Oracle program changed: expected ${program.sha256}, found ${actual}`,
  );
  return actual;
}

function glyphBounds(item) {
  const left = item.transform[4] / PDF_PAGE_WIDTH;
  const top =
    (PDF_PAGE_HEIGHT - (item.transform[5] + item.height)) / PDF_PAGE_HEIGHT;
  return {
    left,
    top,
    right: left + item.width / PDF_PAGE_WIDTH,
    bottom: top + item.height / PDF_PAGE_HEIGHT,
  };
}

function combinedGlyphBounds(items) {
  const bounds = items.map(glyphBounds);
  return {
    left: Math.min(...bounds.map(({ left }) => left)),
    top: Math.min(...bounds.map(({ top }) => top)),
    right: Math.max(...bounds.map(({ right }) => right)),
    bottom: Math.max(...bounds.map(({ bottom }) => bottom)),
  };
}

function normalizeExtractedText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function itemCenter(item) {
  const bounds = glyphBounds(item);
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
}

function pointInRect({ x, y }, rect) {
  return (
    x >= rect.left &&
    x <= rect.left + rect.width &&
    y >= rect.top &&
    y <= rect.top + rect.height
  );
}

async function extractNormativeCitations(pdfBytes) {
  const pdf = await getDocument({
    data: new Uint8Array(pdfBytes),
    disableWorker: true,
    verbosity: 0,
  }).promise;
  const citations = [];

  for (const definition of NORMATIVE_CITATION_DEFINITIONS) {
    const page = await pdf.getPage(definition.pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    invariant(
      viewport.width === PDF_PAGE_WIDTH && viewport.height === PDF_PAGE_HEIGHT,
      `Unexpected dimensions on physical page ${definition.pageNumber}`,
    );

    const { items } = await page.getTextContent();
    const expectedPrintedPage = `A-${definition.pageNumber - 14}`;
    const printedPages = items.filter((item) => item.str === expectedPrintedPage);
    invariant(
      printedPages.length === 1,
      `Expected printed page ${expectedPrintedPage} for ${definition.id}`,
    );

    const transcription = normalizeExtractedText(
      items
        .filter(
          (item) => item.str.trim() && pointInRect(itemCenter(item), definition.rect),
        )
        .map((item) => item.str)
        .join(" "),
    );
    invariant(transcription, `Empty normative citation ${definition.id}`);
    for (const token of definition.requiredTokens) {
      invariant(
        transcription.includes(token),
        `Normative citation ${definition.id} is missing token ${token}`,
      );
    }

    citations.push({
      id: definition.id,
      reference: definition.reference,
      pageNumber: definition.pageNumber,
      printedPage: expectedPrintedPage,
      rect: definition.rect,
      transcription,
    });
  }

  await pdf.destroy();
  return citations;
}

function coefficientAtBaseline(items, baseline, minimumX, maximumX, label) {
  const matches = items.filter(
    (item) =>
      /^0\.\d{2}$/.test(item.str) &&
      item.transform[4] >= minimumX &&
      item.transform[4] < maximumX &&
      Math.abs(item.transform[5] - baseline) < 0.2,
  );

  invariant(matches.length === 1, `Expected one ${label} value at y=${baseline}`);
  return {
    value: Number(matches[0].str),
    glyph: glyphBounds(matches[0]),
  };
}

async function extractSourceRows(pdfBytes) {
  const pdf = await getDocument({
    data: new Uint8Array(pdfBytes),
    disableWorker: true,
    verbosity: 0,
  }).promise;
  invariant(
    pdf.numPages === EXPECTED_PDF_PAGE_COUNT,
    `Expected ${EXPECTED_PDF_PAGE_COUNT} PDF pages, found ${pdf.numPages}`,
  );
  const rows = [];

  for (
    let pageNumber = APPENDIX_FIRST_PAGE;
    pageNumber <= APPENDIX_LAST_PAGE;
    pageNumber += 1
  ) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    invariant(
      viewport.width === PDF_PAGE_WIDTH && viewport.height === PDF_PAGE_HEIGHT,
      `Unexpected dimensions on physical page ${pageNumber}`,
    );

    const { items } = await page.getTextContent();
    const printedPages = items.filter((item) => /^A-\d+$/.test(item.str));
    const expectedPrintedPage = `A-${pageNumber - 14}`;
    invariant(
      printedPages.length === 1 && printedPages[0].str === expectedPrintedPage,
      `Expected printed page ${expectedPrintedPage} on physical page ${pageNumber}`,
    );

    const codeItems = items.filter(
      (item) =>
        /^\d{5}$/.test(item.str) &&
        item.transform[4] >= 230 &&
        item.transform[4] < 280,
    );

    for (const codeItem of codeItems) {
      const baseline = codeItem.transform[5];
      const rowItems = items.filter(
        (item) =>
          item.str.trim() &&
          item.transform[4] >= TABLE_GRID_LEFT_POINTS &&
          item.transform[4] < TABLE_GRID_RIGHT_POINTS &&
          Math.abs(item.transform[5] - baseline) < 0.2,
      );
      invariant(rowItems.length > 0, `Missing row glyphs for ${codeItem.str}`);
      const rowGlyph = combinedGlyphBounds(rowItems);
      rows.push({
        code: codeItem.str,
        pageNumber,
        rowTop: round(
          rowGlyph.top - ROW_VERTICAL_PADDING_POINTS / PDF_PAGE_HEIGHT,
        ),
        rowGlyph,
        aa: coefficientAtBaseline(items, baseline, 280, 330, "Aa"),
        av: coefficientAtBaseline(items, baseline, 330, 380, "Av"),
        ae: coefficientAtBaseline(items, baseline, 440, 490, "Ae"),
        ad: coefficientAtBaseline(items, baseline, 490, 530, "Ad"),
      });
    }
  }

  await pdf.destroy();
  return rows;
}

function groupRowsByCode(rows) {
  const rowsByCode = new Map();
  for (const row of rows) {
    const existingRows = rowsByCode.get(row.code);
    if (existingRows) existingRows.push(row);
    else rowsByCode.set(row.code, [row]);
  }
  return rowsByCode;
}

function selectCanonicalSourceRows(rawRows, overrides) {
  const rowsByCode = groupRowsByCode(rawRows);
  const duplicateCodes = [...rowsByCode]
    .filter(([, rows]) => rows.length > 1)
    .map(([code]) => code)
    .sort();
  const declaredDuplicateCodes = overrides.sourceDuplicates
    .map(({ code }) => code)
    .sort();
  invariant(
    JSON.stringify(duplicateCodes) === JSON.stringify(declaredDuplicateCodes),
    `Source duplicate declarations differ: found ${duplicateCodes.join(", ") || "none"}`,
  );

  const duplicateOverrides = new Map(
    overrides.sourceDuplicates.map((override) => [override.code, override]),
  );
  const selected = new Map();

  for (const [code, rows] of rowsByCode) {
    if (rows.length === 1) {
      selected.set(code, rows[0]);
      continue;
    }

    const override = duplicateOverrides.get(code);
    invariant(override, `Missing source duplicate declaration for ${code}`);
    invariant(
      JSON.stringify(rows.map(({ pageNumber }) => pageNumber)) ===
        JSON.stringify(override.occurrencePageNumbers),
      `Source occurrences changed for duplicate ${code}`,
    );
    const chosen = rows.filter(
      ({ pageNumber }) => pageNumber === override.chosenPageNumber,
    );
    invariant(chosen.length === 1, `Duplicate ${code} must select exactly one row`);
    selected.set(code, chosen[0]);
  }

  return selected;
}

function indexCanonicalMunicipalities(municipalities) {
  const byCode = new Map();
  for (const municipality of municipalities) {
    invariant(
      /^\d{5}$/.test(municipality.code),
      `Invalid canonical DANE code for ${municipality.municipio}`,
    );
    invariant(
      !byCode.has(municipality.code),
      `Duplicate canonical DANE code ${municipality.code}`,
    );
    byCode.set(municipality.code, municipality);
  }
  return byCode;
}

function assertExactCodeCoverage(canonicalByCode, sourceByCode) {
  const missing = [...canonicalByCode.keys()].filter(
    (code) => !sourceByCode.has(code),
  );
  const unexpected = [...sourceByCode.keys()].filter(
    (code) => !canonicalByCode.has(code),
  );
  invariant(
    missing.length === 0 && unexpected.length === 0,
    `DANE coverage differs; missing=${missing.join(",") || "none"}, unexpected=${unexpected.join(",") || "none"}`,
  );
}

function buildCanonicalMunicipalities(municipalities, sourceByCode) {
  return municipalities.map((municipality) => {
    const sourceRow = sourceByCode.get(municipality.code);
    invariant(sourceRow, `Missing source row for DANE ${municipality.code}`);
    invariant(
      municipality.aa === sourceRow.aa.value &&
        municipality.av === sourceRow.av.value,
      `Coefficient mismatch for ${municipality.code}: data=${municipality.aa}/${municipality.av}, source=${sourceRow.aa.value}/${sourceRow.av.value}`,
    );

    return {
      ...municipality,
      aa: sourceRow.aa.value,
      av: sourceRow.av.value,
      ae: sourceRow.ae.value,
      ad: sourceRow.ad.value,
    };
  });
}

function deriveValueLayout(rawRows, key) {
  const horizontalPadding =
    VALUE_HORIZONTAL_PADDING_POINTS / PDF_PAGE_WIDTH;
  const verticalPadding = VALUE_VERTICAL_PADDING_POINTS / PDF_PAGE_HEIGHT;
  const left = Math.min(...rawRows.map((row) => row[key].glyph.left));
  const right = Math.max(...rawRows.map((row) => row[key].glyph.right));
  const relativeTop = Math.min(
    ...rawRows.map((row) => row[key].glyph.top - row.rowTop),
  );
  const relativeBottom = Math.max(
    ...rawRows.map((row) => row[key].glyph.bottom - row.rowTop),
  );

  return {
    left: round(left - horizontalPadding),
    width: round(right - left + horizontalPadding * 2),
    topOffset: round(relativeTop - verticalPadding),
    height: round(relativeBottom - relativeTop + verticalPadding * 2),
  };
}

function deriveAppendixLayout(rawRows) {
  const rowHeight = Math.max(
    ...rawRows.map(
      (row) =>
        row.rowGlyph.bottom -
        row.rowTop +
        ROW_VERTICAL_PADDING_POINTS / PDF_PAGE_HEIGHT,
    ),
  );

  return {
    row: {
      left: round(TABLE_GRID_LEFT_POINTS / PDF_PAGE_WIDTH),
      width: round(
        (TABLE_GRID_RIGHT_POINTS - TABLE_GRID_LEFT_POINTS) / PDF_PAGE_WIDTH,
      ),
      height: round(rowHeight),
    },
    values: {
      aa: deriveValueLayout(rawRows, "aa"),
      av: deriveValueLayout(rawRows, "av"),
      ae: deriveValueLayout(rawRows, "ae"),
      ad: deriveValueLayout(rawRows, "ad"),
    },
  };
}

function buildCompactCitations(municipalities, sourceByCode, appendixLayout) {
  return municipalities.map((municipality) => {
    const sourceRow = sourceByCode.get(municipality.code);
    invariant(sourceRow, `Missing source row for DANE ${municipality.code}`);
    invariant(
      municipality.aa === sourceRow.aa.value &&
        municipality.av === sourceRow.av.value &&
        municipality.ae === sourceRow.ae.value &&
        municipality.ad === sourceRow.ad.value,
      `Coefficient mismatch for ${municipality.code}: data=${municipality.aa}/${municipality.av}/${municipality.ae}/${municipality.ad}, source=${sourceRow.aa.value}/${sourceRow.av.value}/${sourceRow.ae.value}/${sourceRow.ad.value}`,
    );
    invariant(
      sourceRow.rowTop >= 0 &&
        sourceRow.rowTop + appendixLayout.row.height <= 1,
      `Row for ${municipality.code} exceeds the PDF page`,
    );
    return [municipality.code, sourceRow.pageNumber, sourceRow.rowTop];
  });
}

function containsBounds(rect, bounds) {
  return (
    bounds.left + GEOMETRY_EPSILON >= rect.left &&
    bounds.top + GEOMETRY_EPSILON >= rect.top &&
    bounds.right <= rect.left + rect.width + GEOMETRY_EPSILON &&
    bounds.bottom <= rect.top + rect.height + GEOMETRY_EPSILON
  );
}

function assertLayoutIntegrity(appendixLayout, rawRows) {
  const rowRight = appendixLayout.row.left + appendixLayout.row.width;
  invariant(rowRight <= 1, "Row layout exceeds the PDF width");

  for (const [key, value] of Object.entries(appendixLayout.values)) {
    invariant(
      value.left >= appendixLayout.row.left &&
        value.left + value.width <= rowRight &&
        value.topOffset + value.height <= appendixLayout.row.height,
      `${key} layout is not contained by the cited row`,
    );
  }

  for (const row of rawRows) {
    const rowRect = {
      left: appendixLayout.row.left,
      top: row.rowTop,
      width: appendixLayout.row.width,
      height: appendixLayout.row.height,
    };
    invariant(
      containsBounds(rowRect, row.rowGlyph),
      `Derived row layout does not contain all glyphs for ${row.code} on page ${row.pageNumber}`,
    );

    for (const key of ["aa", "av", "ae", "ad"]) {
      const valueLayout = appendixLayout.values[key];
      const valueRect = {
        left: valueLayout.left,
        top: row.rowTop + valueLayout.topOffset,
        width: valueLayout.width,
        height: valueLayout.height,
      };
      invariant(
        containsBounds(valueRect, row[key].glyph),
        `Derived ${key} layout does not contain its glyph for ${row.code} on page ${row.pageNumber}`,
      );
    }
  }
}

async function verifyOrWrite(file, expectedContents) {
  if (checkOnly) {
    const actualContents = await readFile(file, "utf8");
    invariant(
      actualContents === expectedContents,
      `${file} is not reproducible; run the generator`,
    );
    return;
  }
  await writeFile(file, expectedContents, "utf8");
}

async function main() {
  runOracleGenerator();
  const [
    pdfBytes,
    municipalitiesText,
    overridesText,
    oracleText,
    oracleInputText,
  ] = await Promise.all([
    readFile(pdfFile),
    readFile(municipalitiesFile, "utf8"),
    readFile(overridesFile, "utf8"),
    readFile(oracleFile, "utf8"),
    readFile(oracleInputFile, "utf8"),
  ]);
  const pdfSha256 = sha256(pdfBytes);
  invariant(
    pdfSha256 === EXPECTED_PDF_SHA256,
    `PDF SHA-256 changed: expected ${EXPECTED_PDF_SHA256}, found ${pdfSha256}`,
  );

  const municipalities = JSON.parse(municipalitiesText);
  const overrides = JSON.parse(overridesText);
  const oracle = JSON.parse(oracleText);
  const oracleInput = JSON.parse(oracleInputText);
  invariant(overrides.schemaVersion === 1, "Unsupported evidence override schema");
  invariant(
    municipalities.length === EXPECTED_MUNICIPALITY_COUNT,
    `Expected ${EXPECTED_MUNICIPALITY_COUNT} canonical municipalities`,
  );
  const aaAvProjectionSha256 = sha256(
    JSON.stringify(
      municipalities.map(({ departamento, municipio, aa, av }) => ({
        departamento,
        municipio,
        aa,
        av,
      })),
    ),
  );
  invariant(
    aaAvProjectionSha256 === EXPECTED_AA_AV_PROJECTION_SHA256,
    "The 1,123-row Aa/Av projection no longer matches the historical oracle input",
  );
  assertOracleCaseInputs(municipalities, oracleInput);
  const oracleSourceHashes = await assertOracleSourceLocks(oracle);
  oracleSourceHashes.oracle_program = await assertOracleProgramLock(oracleInput);

  const [rawRows, normativeCitations] = await Promise.all([
    extractSourceRows(pdfBytes),
    extractNormativeCitations(pdfBytes),
  ]);
  invariant(
    rawRows.length === EXPECTED_RAW_ROW_COUNT,
    `Expected ${EXPECTED_RAW_ROW_COUNT} raw source rows, found ${rawRows.length}`,
  );
  const appendixLayout = deriveAppendixLayout(rawRows);
  assertLayoutIntegrity(appendixLayout, rawRows);
  const sourceByCode = selectCanonicalSourceRows(rawRows, overrides);
  const canonicalMunicipalities = buildCanonicalMunicipalities(
    municipalities,
    sourceByCode,
  );
  const canonicalByCode = indexCanonicalMunicipalities(canonicalMunicipalities);
  invariant(
    sourceByCode.size === EXPECTED_MUNICIPALITY_COUNT &&
      canonicalByCode.size === EXPECTED_MUNICIPALITY_COUNT,
    "Canonical and source DANE indexes must each contain 1,123 records",
  );
  assertExactCodeCoverage(canonicalByCode, sourceByCode);
  const citations = buildCompactCitations(
    canonicalMunicipalities,
    sourceByCode,
    appendixLayout,
  );

  const manifestOutput = JSON.stringify({
    schemaVersion: 4,
    source: {
      document: "NSR-10 Título A, versión consolidada 2017",
      appendix: "Apéndice A-4",
      pdfPath: "/nsr10-titulo-a-2017.pdf",
      sourceUrl:
        "https://iisee.kenken.go.jp/worldlist/11_Colombia/Colombia%20Titulo%20A-NSR-10-Ver-2017.pdf",
      pdfSha256,
    },
    layout: appendixLayout,
    citations,
    normativeCitations,
  });

  const municipalitiesOutput = `${JSON.stringify(canonicalMunicipalities, null, 2)}\n`;
  await verifyOrWrite(municipalitiesFile, municipalitiesOutput);
  await verifyOrWrite(manifestFile, manifestOutput);
  if (reportJson) {
    console.log(
      JSON.stringify({
        rawRows: rawRows.length,
        uniqueCodes: sourceByCode.size,
        duplicateCodes: overrides.sourceDuplicates.map(({ code }) => code).sort(),
        geometryRowsValidated: rawRows.length,
        normativeCitations: normativeCitations.length,
        sourceHashes: { pdf: pdfSha256, ...oracleSourceHashes },
        sourcePageCounts: { pdf: EXPECTED_PDF_PAGE_COUNT },
        historicalAaAvProjectionSha256: aaAvProjectionSha256,
        oracleCases: oracle.cases.length,
        artifactSizes: {
          manifest: Buffer.byteLength(manifestOutput),
          municipalities: Buffer.byteLength(municipalitiesOutput),
          oracle: Buffer.byteLength(oracleText),
        },
      }),
    );
  } else {
    console.log(
      `${checkOnly ? "Verified" : "Generated"} ${citations.length} compact municipality citations and ${normativeCitations.length} normative clause/table citations from the pinned PDF.`,
    );
  }
}

await main();
