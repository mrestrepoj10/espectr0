import manifestData from "./manifest.json";

import { lookupMunicipioByCode } from "../municipios";
import type {
	CompactMunicipalityCitation,
	MunicipalityTraceability,
	NormalizedPdfRect,
	SourceEvidenceManifest,
} from "./schema";

export type { MunicipalityTraceability } from "./schema";

// The generator and its tests strictly validate this checked-in artifact.
// Runtime keeps the hot path to a small tuple lookup with no eager expansion.
const manifest = manifestData as unknown as SourceEvidenceManifest;
const citationByCode = new Map(
	manifest.citations.map((citation) => [citation[0], citation]),
);

function composeValueRect(
	rowTop: number,
	layout: SourceEvidenceManifest["layout"]["values"]["aa"],
): NormalizedPdfRect {
	return {
		left: layout.left,
		top: rowTop + layout.topOffset,
		width: layout.width,
		height: layout.height,
	};
}

function composeTraceability(
	municipality: NonNullable<ReturnType<typeof lookupMunicipioByCode>>,
	citation: CompactMunicipalityCitation,
): MunicipalityTraceability {
	const [, pageNumber, rowTop] = citation;
	const { layout } = manifest;

	return {
		municipality,
		source: manifest.source,
		pageNumber,
		printedPage: `A-${pageNumber - 14}`,
		row: {
			left: layout.row.left,
			top: rowTop,
			width: layout.row.width,
			height: layout.row.height,
		},
		values: {
			aa: {
				value: municipality.aa,
				rect: composeValueRect(rowTop, layout.values.aa),
			},
			av: {
				value: municipality.av,
				rect: composeValueRect(rowTop, layout.values.av),
			},
			ae: {
				value: municipality.ae,
				rect: composeValueRect(rowTop, layout.values.ae),
			},
			ad: {
				value: municipality.ad,
				rect: composeValueRect(rowTop, layout.values.ad),
			},
		},
	};
}

export function getMunicipalityTraceability(
	code: string,
): MunicipalityTraceability | undefined {
	const municipality = lookupMunicipioByCode(code);
	const citation = citationByCode.get(code);
	return municipality && citation
		? composeTraceability(municipality, citation)
		: undefined;
}
