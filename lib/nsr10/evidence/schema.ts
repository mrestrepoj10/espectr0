import { z } from "zod";

import type { Municipio } from "../schema";

export const normalizedPdfRectSchema = z
	.object({
		left: z.number().finite().min(0).max(1),
		top: z.number().finite().min(0).max(1),
		width: z.number().finite().positive().max(1),
		height: z.number().finite().positive().max(1),
	})
	.strict()
	.refine(({ left, width }) => left + width <= 1, {
		message: "Rectangle must fit within the PDF page width",
	})
	.refine(({ top, height }) => top + height <= 1, {
		message: "Rectangle must fit within the PDF page height",
	});

const sourceSchema = z
	.object({
		document: z.string().trim().min(1),
		appendix: z.string().trim().min(1),
		pdfPath: z.string().startsWith("/"),
		sourceUrl: z.string().url(),
		pdfSha256: z.string().regex(/^[a-f0-9]{64}$/),
	})
	.strict();

const rowLayoutSchema = z
	.object({
		left: z.number().finite().min(0).max(1),
		width: z.number().finite().positive().max(1),
		height: z.number().finite().positive().max(1),
	})
	.strict()
	.refine(({ left, width }) => left + width <= 1, {
		message: "Row layout must fit within the PDF page width",
	});

const valueLayoutSchema = z
	.object({
		left: z.number().finite().min(0).max(1),
		width: z.number().finite().positive().max(1),
		topOffset: z.number().finite().nonnegative().max(1),
		height: z.number().finite().positive().max(1),
	})
	.strict();

const appendixLayoutSchema = z
	.object({
		row: rowLayoutSchema,
		values: z
			.object({
				aa: valueLayoutSchema,
				av: valueLayoutSchema,
			})
			.strict(),
	})
	.strict()
	.superRefine(({ row, values }, context) => {
		const rowRight = row.left + row.width;

		for (const [key, value] of Object.entries(values)) {
			if (
				value.left < row.left ||
				value.left + value.width > rowRight ||
				value.topOffset + value.height > row.height
			) {
				context.addIssue({
					code: "custom",
					message: `${key} layout must be contained by the cited row`,
					path: ["values", key],
				});
			}
		}
	});

export const compactMunicipalityCitationSchema = z.tuple([
	z.string().regex(/^\d{5}$/),
	z.number().int().positive(),
	z.number().finite().min(0).max(1),
]);

export const sourceEvidenceManifestSchema = z
	.object({
		schemaVersion: z.literal(2),
		source: sourceSchema,
		layout: appendixLayoutSchema,
		citations: z.array(compactMunicipalityCitationSchema),
	})
	.strict()
	.superRefine(({ citations, layout }, context) => {
		const seenCodes = new Set<string>();

		for (let index = 0; index < citations.length; index += 1) {
			const [code, , rowTop] = citations[index];
			if (seenCodes.has(code)) {
				context.addIssue({
					code: "custom",
					message: `Duplicate municipality code ${code}`,
					path: ["citations", index, 0],
				});
			}
			seenCodes.add(code);

			if (rowTop + layout.row.height > 1) {
				context.addIssue({
					code: "custom",
					message: `Row for ${code} exceeds the PDF page height`,
					path: ["citations", index, 2],
				});
			}
		}
	});

export type NormalizedPdfRect = z.infer<typeof normalizedPdfRectSchema>;
export type CompactMunicipalityCitation = z.infer<
	typeof compactMunicipalityCitationSchema
>;
export type SourceEvidenceManifest = z.infer<
	typeof sourceEvidenceManifestSchema
>;
export type MunicipalityTraceability = {
	municipality: Municipio;
	source: SourceEvidenceManifest["source"];
	pageNumber: number;
	printedPage: string;
	row: NormalizedPdfRect;
	values: {
		aa: { value: number; rect: NormalizedPdfRect };
		av: { value: number; rect: NormalizedPdfRect };
	};
};
