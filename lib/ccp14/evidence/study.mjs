import { checkEvidenceStudy } from "../../regulatory/runtime.mjs";

export const studyId = "ccp14-seismic-research";

const fullPage = { left: 0, top: 0, width: 1, height: 1 };
const sourcePages = [
	[50, "3-46"],
	[54, "3-50"],
	[55, "3-51"],
	[56, "3-52"],
	[58, "3-54"],
	[59, "3-55"],
	[60, "3-56"],
	[61, "3-57"],
	[62, "3-58"],
].map(([physicalPage, printedPage]) => ({
	physicalPage,
	printedPage,
	rotationDegrees: 0,
	crop: fullPage,
}));

const sources = [
	{
		id: "invias-resolution-108-2015",
		issuingAuthority: "Instituto Nacional de Vías (INVÍAS)",
		officialTitle: "Resolución 0000108 del 26 de enero de 2015",
		edition: "2015",
		revision: null,
		adoptionInstrument: "Resolución 0000108 de 2015",
		amendmentsAndErrata: [],
		legalStatus: "active",
		applicabilityStatus: "applicable",
		officialUrl:
			"https://www.invias.gov.co/index.php/archivo-y-documentos/bibilioteca-virtual/resoluciones-circulares-y-otros/3610-resolucion-no-108-del-26-de-enero-de-2015/file",
		retrievedOn: "2026-07-22",
		redistribution: {
			decision: "external-only",
			rationale:
				"Official bytes were recovered from an archived capture because the current INVÍAS URL returns 404; redistribution permission was not established.",
		},
		mediaType: "application/pdf",
		pageCount: 2,
		sha256: "e17c4aa764716c5533cb82499984f87e4eda032888c91544fab10b804d5a753a",
		pages: [{ physicalPage: 1, printedPage: null, rotationDegrees: 0, crop: fullPage }],
	},
	{
		id: "invias-ccp14-section-3",
		issuingAuthority: "Instituto Nacional de Vías (INVÍAS)",
		officialTitle: "Norma Colombiana de Diseño de Puentes CCP-14 - Sección 3: Cargas y factores de carga",
		edition: "CCP-14",
		revision: null,
		adoptionInstrument: "Resolución 0000108 de 2015",
		amendmentsAndErrata: [],
		legalStatus: "active",
		applicabilityStatus: "conditional",
		officialUrl:
			"https://www.invias.gov.co/index.php/archivo-y-documentos/documentos-tecnicos/3709-norma-colombiana-de-diseno-de-puentes-ccp14",
		retrievedOn: "2026-07-22",
		redistribution: {
			decision: "external-only",
			rationale:
				"The official INVÍAS archive was hash-locked after recovery through an archived transport; redistribution permission for the PDF was not established.",
		},
		mediaType: "application/pdf",
		pageCount: 140,
		sha256: "55f53d68dfc568a930b726b0c7dba510ea608128490353bf604f827a27ffc8ca",
		pages: sourcePages,
	},
];

const applicabilityCitations = [
	{
		id: "adoption-resolution-article-1",
		sourceDocumentId: "invias-resolution-108-2015",
		physicalPage: 1,
		printedPage: null,
		reference: "Resolución 0000108 de 2015, artículo 1",
		rect: { left: 0.08, top: 0.55, width: 0.84, height: 0.2 },
		extractedToken: "adopta como norma técnica la Norma Colombiana de Diseño de Puentes CCP-2014",
		requiredTokens: ["CCP-2014"],
	},
	{
		id: "general-hazard-and-location-method",
		sourceDocumentId: "invias-ccp14-section-3",
		physicalPage: 50,
		printedPage: "3-46",
		reference: "CCP-14 3.10.2 y 3.10.2.1",
		rect: { left: 0.04, top: 0.04, width: 0.48, height: 0.9 },
		extractedToken: "PGA, SS y S1 de las Figuras 3.10.2.1-1 a 3.10.2.1-3; interpolación lineal",
		requiredTokens: ["PGA", "interpolación lineal"],
	},
	{
		id: "site-specific-procedure",
		sourceDocumentId: "invias-ccp14-section-3",
		physicalPage: 54,
		printedPage: "3-50",
		reference: "CCP-14 3.10.2.2",
		rect: { left: 0.04, top: 0.04, width: 0.5, height: 0.92 },
		extractedToken: "Procedimiento Particular de Sitio; siete por ciento de probabilidad de excedencia en 75 años",
		requiredTokens: ["Procedimiento Particular de Sitio", "75 años"],
	},
	{
		id: "site-specific-two-thirds-floor",
		sourceDocumentId: "invias-ccp14-section-3",
		physicalPage: 55,
		printedPage: "3-51",
		reference: "CCP-14 3.10.2.2, límite inferior",
		rect: { left: 0.04, top: 0.04, width: 0.48, height: 0.38 },
		extractedToken: "no deben ser menores que dos tercios de los espectros de diseño determinados usando el procedimiento general",
		requiredTokens: ["dos tercios"],
	},
	{
		id: "soil-f-and-factor-notes",
		sourceDocumentId: "invias-ccp14-section-3",
		physicalPage: 59,
		printedPage: "3-55",
		reference: "CCP-14 tablas 3.10.3.2-2 y 3.10.3.2-3, notas",
		rect: { left: 0.16, top: 0.23, width: 0.72, height: 0.48 },
		extractedToken: "interpolación lineal; para el perfil tipo F debe realizarse un estudio de sitio particular",
		requiredTokens: ["perfil tipo F", "interpolación lineal"],
	},
	{
		id: "operational-zones-and-r-application",
		sourceDocumentId: "invias-ccp14-section-3",
		physicalPage: 62,
		printedPage: "3-58",
		reference: "CCP-14 3.10.7.1 y 3.10.7.2",
		rect: { left: 0.03, top: 0.04, width: 0.95, height: 0.92 },
		extractedToken: "R=1.0 para la subestructura y todas las conexiones; ambas direcciones ortogonales",
		requiredTokens: ["R=1.0", "direcciones ortogonales"],
	},
].map((citation) => ({
	...citation,
	regionKind: "applicability",
	unit: null,
	transformation: null,
}));

const factorTables = [
	{
		id: "fpga",
		page: 58,
		printedPage: "3-54",
		reference: "Tabla 3.10.3.2-1",
		columns: ["PGA<=0.10", "PGA=0.20", "PGA=0.30", "PGA=0.40", "PGA>=0.50"],
		rows: {
			A: [0.8, 0.8, 0.8, 0.8, 0.8],
			B: [1, 1, 1, 1, 1],
			C: [1.2, 1.2, 1.1, 1, 1],
			D: [1.6, 1.4, 1.2, 1.1, 1],
			E: [2.5, 1.7, 1.2, 0.9, 0.9],
			F: ["véase nota 2", "véase nota 2", "véase nota 2", "véase nota 2", "véase nota 2"],
		},
		tableRect: { left: 0.12, top: 0.7, width: 0.72, height: 0.15 },
		rowTop: 0.738,
		rowStep: 0.014,
	},
	{
		id: "fa",
		page: 59,
		printedPage: "3-55",
		reference: "Tabla 3.10.3.2-2",
		columns: ["Ss<=0.25", "Ss=0.50", "Ss=0.75", "Ss=1.00", "Ss>=1.25"],
		rows: {
			A: [0.8, 0.8, 0.8, 0.8, 0.8],
			B: [1, 1, 1, 1, 1],
			C: [1.2, 1.2, 1.1, 1, 1],
			D: [1.6, 1.4, 1.2, 1.1, 1],
			E: [2.5, 1.7, 1.2, 0.9, 0.9],
			F: ["véase nota 2", "véase nota 2", "véase nota 2", "véase nota 2", "véase nota 2"],
		},
		tableRect: { left: 0.16, top: 0.1, width: 0.7, height: 0.16 },
		rowTop: 0.16,
		rowStep: 0.014,
	},
	{
		id: "fv",
		page: 59,
		printedPage: "3-55",
		reference: "Tabla 3.10.3.2-3",
		columns: ["S1<=0.10", "S1=0.20", "S1=0.30", "S1=0.40", "S1>=0.50"],
		rows: {
			A: [0.8, 0.8, 0.8, 0.8, 0.8],
			B: [1, 1, 1, 1, 1],
			C: [1.7, 1.6, 1.5, 1.4, 1.3],
			D: [2.4, 2, 1.8, 1.6, 1.5],
			E: [3.5, 3.2, 2.8, 2.4, 2.4],
			F: ["véase nota 2", "véase nota 2", "véase nota 2", "véase nota 2", "véase nota 2"],
		},
		tableRect: { left: 0.16, top: 0.38, width: 0.7, height: 0.17 },
		rowTop: 0.435,
		rowStep: 0.014,
	},
];

const rTables = [
	{
		id: "r-substructure",
		page: 62,
		printedPage: "3-58",
		reference: "Tabla 3.10.7.1-1",
		columns: ["critica", "esencial", "otra"],
		rows: {
			"pilar-muro-dimension-mayor": [1.5, 1.5, 2],
			"portico-concreto-pilas-verticales": [1.5, 2, 3],
			"portico-concreto-pilas-inclinadas": [1.5, 1.5, 2],
			"columna-sola": [1.5, 2, 3],
			"portico-acero-compuesto-pilas-verticales": [1.5, 3.5, 5],
			"portico-acero-compuesto-pilas-inclinadas": [1.5, 2, 3],
			"portico-multiples-columnas": [1.5, 3.5, 5],
		},
		tableRect: { left: 0.1, top: 0.45, width: 0.75, height: 0.22 },
		rowTop: 0.51,
		rowStep: 0.021,
	},
	{
		id: "r-connection",
		page: 62,
		printedPage: "3-58",
		reference: "Tabla 3.10.7.1-2",
		columns: ["todas"],
		rows: {
			"superestructura-estribo": [0.8],
			"junta-expansion-superestructura": [0.8],
			"columna-pilar-pila-viga-superestructura": [1],
			"columna-pilar-cimentacion": [1],
		},
		tableRect: { left: 0.07, top: 0.69, width: 0.82, height: 0.12 },
		rowTop: 0.73,
		rowStep: 0.016,
	},
];

const generatedCitations = [];
const values = [];
const rawRows = [];
const canonicalRows = [];
const optionIds = [];
const slug = (value) =>
	String(value)
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "");

for (const table of [...factorTables, ...rTables]) {
	const tableCitationId = `${table.id}-table`;
	generatedCitations.push({
		id: tableCitationId,
		sourceDocumentId: "invias-ccp14-section-3",
		regionKind: "table",
		physicalPage: table.page,
		printedPage: table.printedPage,
		reference: table.reference,
		rect: table.tableRect,
		extractedToken: table.reference,
		unit: null,
		transformation: null,
		requiredTokens: [table.reference],
	});
	Object.entries(table.rows).forEach(([rowId, rowValues], rowIndex) => {
		const rowSlug = slug(rowId);
		const rowCitationId = `${table.id}-row-${rowSlug}`;
		const rowRect = {
			left: table.tableRect.left + 0.01,
			top: table.rowTop + rowIndex * table.rowStep,
			width: table.tableRect.width - 0.02,
			height: table.rowStep * 0.88,
		};
		generatedCitations.push({
			id: rowCitationId,
			sourceDocumentId: "invias-ccp14-section-3",
			regionKind: "row",
			physicalPage: table.page,
			printedPage: table.printedPage,
			reference: `${table.reference}, fila ${rowId}`,
			parentCitationId: tableCitationId,
			rect: rowRect,
			extractedToken: rowId,
			unit: null,
			transformation: null,
			requiredTokens: [rowId],
		});
		rowValues.forEach((value, columnIndex) => {
			const columnId = table.columns[columnIndex];
			const columnSlug = slug(columnId);
			const optionId = `${table.id}.${rowSlug}.${columnSlug}`;
			const cellCitationId = `${table.id}-cell-${rowSlug}-${columnIndex + 1}`;
			const cellLeft = rowRect.left + rowRect.width * (0.34 + (0.66 * columnIndex) / table.columns.length);
			const cellWidth = (rowRect.width * 0.66) / table.columns.length;
			const transformation = typeof value === "number" ? "decimal parse" : "text identity";
			generatedCitations.push({
				id: cellCitationId,
				sourceDocumentId: "invias-ccp14-section-3",
				regionKind: "cell",
				physicalPage: table.page,
				printedPage: table.printedPage,
				reference: `${table.reference}, ${rowId}, ${columnId}`,
				parentCitationId: rowCitationId,
				rect: {
					left: cellLeft,
					top: rowRect.top + rowRect.height * 0.1,
					width: cellWidth * 0.92,
					height: rowRect.height * 0.8,
				},
				extractedToken: String(value),
				normalizedValue: value,
				...(typeof value === "number" ? { normalizedNumericValue: value } : {}),
				unit: null,
				transformation,
				requiredTokens: [String(value)],
			});
			const valueId = `value-${table.id}-${rowSlug}-${columnIndex + 1}`;
			values.push({
				id: valueId,
				optionId,
				hazardId: "ccp14-2014-7pct-75y",
				fieldId: "value",
				value,
				unit: null,
				provenance: "direct-source",
				citationIds: [cellCitationId],
				transformation,
			});
			const rawId = `raw-${table.id}-${rowSlug}-${columnIndex + 1}`;
			const rowKey = `${optionId}/ccp14-2014-7pct-75y`;
			rawRows.push({
				id: rawId,
				rowKey,
				sourceDocumentId: "invias-ccp14-section-3",
				optionId,
				hazardId: "ccp14-2014-7pct-75y",
				citationIds: [cellCitationId],
				fields: { value },
			});
			canonicalRows.push({
				id: `canonical-${table.id}-${rowSlug}-${columnIndex + 1}`,
				rowKey,
				sourceDocumentId: "invias-ccp14-section-3",
				optionId,
				hazardId: "ccp14-2014-7pct-75y",
				citationIds: [cellCitationId],
				fields: { value },
				sourceRowIds: [rawId],
			});
			optionIds.push(optionId);
		});
	});
}

export const ccp14Study = {
	schemaVersion: 1,
	studyId,
	title: "CCP-14 seismic source research: site factors and response-modification factors",
	sources,
	citations: [...applicabilityCitations, ...generatedCitations],
	applicabilityCitationIds: applicabilityCitations.map(({ id }) => id),
	coverage: {
		optionIds,
		hazardIds: ["ccp14-2014-7pct-75y"],
		fieldIds: ["value"],
	},
	values,
	rawRows,
	canonicalRows,
	overrides: [],
};

export async function check({ repositoryRoot }) {
	return checkEvidenceStudy(ccp14Study, { repositoryRoot });
}
