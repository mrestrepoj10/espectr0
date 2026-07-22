import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const EXPECTED_MUNICIPALITY_COUNT = 1_123;
const EXPECTED_RAW_ROW_COUNT = 1_124;
const EXPECTED_PDF_SHA256 =
  "47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0";
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
const checkOnly = process.argv.includes("--check");
const reportJson = process.argv.includes("--report-json");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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
    },
  };
}

function buildCompactCitations(municipalities, sourceByCode, appendixLayout) {
  return municipalities.map((municipality) => {
    const sourceRow = sourceByCode.get(municipality.code);
    invariant(sourceRow, `Missing source row for DANE ${municipality.code}`);
    invariant(
      municipality.aa === sourceRow.aa.value &&
        municipality.av === sourceRow.av.value,
      `Coefficient mismatch for ${municipality.code}: data=${municipality.aa}/${municipality.av}, source=${sourceRow.aa.value}/${sourceRow.av.value}`,
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

    for (const key of ["aa", "av"]) {
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
  const [pdfBytes, municipalitiesText, overridesText] = await Promise.all([
    readFile(pdfFile),
    readFile(municipalitiesFile, "utf8"),
    readFile(overridesFile, "utf8"),
  ]);
  const pdfSha256 = createHash("sha256").update(pdfBytes).digest("hex");
  invariant(
    pdfSha256 === EXPECTED_PDF_SHA256,
    `PDF SHA-256 changed: expected ${EXPECTED_PDF_SHA256}, found ${pdfSha256}`,
  );

  const municipalities = JSON.parse(municipalitiesText);
  const overrides = JSON.parse(overridesText);
  invariant(overrides.schemaVersion === 1, "Unsupported evidence override schema");
  invariant(
    municipalities.length === EXPECTED_MUNICIPALITY_COUNT,
    `Expected ${EXPECTED_MUNICIPALITY_COUNT} canonical municipalities`,
  );

  const rawRows = await extractSourceRows(pdfBytes);
  invariant(
    rawRows.length === EXPECTED_RAW_ROW_COUNT,
    `Expected ${EXPECTED_RAW_ROW_COUNT} raw source rows, found ${rawRows.length}`,
  );
  const appendixLayout = deriveAppendixLayout(rawRows);
  assertLayoutIntegrity(appendixLayout, rawRows);
  const sourceByCode = selectCanonicalSourceRows(rawRows, overrides);
  const canonicalByCode = indexCanonicalMunicipalities(municipalities);
  invariant(
    sourceByCode.size === EXPECTED_MUNICIPALITY_COUNT &&
      canonicalByCode.size === EXPECTED_MUNICIPALITY_COUNT,
    "Canonical and source DANE indexes must each contain 1,123 records",
  );
  assertExactCodeCoverage(canonicalByCode, sourceByCode);
  const citations = buildCompactCitations(
    municipalities,
    sourceByCode,
    appendixLayout,
  );

  const manifestOutput = JSON.stringify({
    schemaVersion: 2,
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
  });

  await verifyOrWrite(manifestFile, manifestOutput);
  if (reportJson) {
    console.log(
      JSON.stringify({
        rawRows: rawRows.length,
        uniqueCodes: sourceByCode.size,
        duplicateCodes: overrides.sourceDuplicates.map(({ code }) => code).sort(),
        geometryRowsValidated: rawRows.length,
        manifestBytes: Buffer.byteLength(manifestOutput),
        pdfSha256,
      }),
    );
  } else {
    console.log(
      `${checkOnly ? "Verified" : "Generated"} ${citations.length} compact municipality citations from ${rawRows.length} Appendix A-4 rows.`,
    );
  }
}

await main();
