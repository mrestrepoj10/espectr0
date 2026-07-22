import { z } from "zod";

const idSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]*$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const isoDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine(
		(value) =>
			!Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
			new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
		{ message: "Invalid calendar date" },
	);
const scalarSchema = z.union([
	z.string(),
	z.number().finite(),
	z.boolean(),
	z.null(),
]);

export const normalizedRectSchema = z
	.object({
		left: z.number().finite().min(0).max(1),
		top: z.number().finite().min(0).max(1),
		width: z.number().finite().positive().max(1),
		height: z.number().finite().positive().max(1),
	})
	.strict()
	.refine(({ left, width }) => left + width <= 1, {
		message: "Rectangle must fit within the page width",
	})
	.refine(({ top, height }) => top + height <= 1, {
		message: "Rectangle must fit within the page height",
	});

const pageMetadataSchema = z
	.object({
		physicalPage: z.number().int().positive(),
		printedPage: z.string().trim().min(1).optional(),
		rotationDegrees: z.union([
			z.literal(0),
			z.literal(90),
			z.literal(180),
			z.literal(270),
		]),
		crop: normalizedRectSchema,
	})
	.strict();

const amendmentSchema = z
	.object({
		kind: z.enum(["amendment", "erratum"]),
		reference: z.string().trim().min(1),
		issuedOn: isoDateSchema.optional(),
		officialUrl: z.string().url().optional(),
	})
	.strict();

export const sourceDocumentSchema = z
	.object({
		id: idSchema,
		issuingAuthority: z.string().trim().min(1),
		officialTitle: z.string().trim().min(1),
		edition: z.string().trim().min(1),
		revision: z.string().trim().min(1).nullable(),
		adoptionInstrument: z.string().trim().min(1),
		amendmentsAndErrata: z.array(amendmentSchema),
		legalStatus: z.enum([
			"active",
			"superseded",
			"draft",
			"historical",
			"unknown",
		]),
		applicabilityStatus: z.enum([
			"applicable",
			"conditional",
			"not-applicable",
			"historical",
			"unknown",
		]),
		officialUrl: z.string().url(),
		retrievedOn: isoDateSchema,
		redistribution: z
			.object({
				decision: z.enum(["bundled", "external-only", "restricted"]),
				localPath: z.string().trim().min(1).optional(),
				rationale: z.string().trim().min(1),
			})
			.strict(),
		mediaType: z.string().trim().regex(/^[\w.+-]+\/[\w.+-]+$/),
		pageCount: z.number().int().positive(),
		sha256: sha256Schema,
		pages: z.array(pageMetadataSchema),
	})
	.strict()
	.superRefine(({ pageCount, pages, redistribution }, context) => {
		if (redistribution.decision === "bundled" && !redistribution.localPath) {
			context.addIssue({
				code: "custom",
				message: "Bundled sources require a local path",
				path: ["redistribution", "localPath"],
			});
		}
		if (redistribution.decision !== "bundled" && redistribution.localPath) {
			context.addIssue({
				code: "custom",
				message: "Only bundled sources may declare a local path",
				path: ["redistribution", "localPath"],
			});
		}

		const physicalPages = new Set<number>();
		for (let index = 0; index < pages.length; index += 1) {
			const page = pages[index];
			if (page.physicalPage > pageCount) {
				context.addIssue({
					code: "custom",
					message: "Physical page exceeds the document page count",
					path: ["pages", index, "physicalPage"],
				});
			}
			if (physicalPages.has(page.physicalPage)) {
				context.addIssue({
					code: "custom",
					message: `Duplicate physical page ${page.physicalPage}`,
					path: ["pages", index, "physicalPage"],
				});
			}
			physicalPages.add(page.physicalPage);
		}
	});

export const citationRegionKindSchema = z.enum([
	"table",
	"row",
	"cell",
	"clause",
	"note",
	"warning",
	"figure",
	"applicability",
]);

export const citationSchema = z
	.object({
		id: idSchema,
		sourceDocumentId: idSchema,
		regionKind: citationRegionKindSchema,
		physicalPage: z.number().int().positive(),
		printedPage: z.string().trim().min(1).optional(),
		reference: z.string().trim().min(1),
		parentCitationId: idSchema.optional(),
		rect: normalizedRectSchema,
		extractedToken: z.string().trim().min(1),
		normalizedNumericValue: z.number().finite().optional(),
		unit: z.string().trim().min(1).optional(),
		transformation: z.string().trim().min(1).optional(),
		requiredTokens: z.array(z.string().trim().min(1)),
	})
	.strict()
	.superRefine(({ extractedToken, requiredTokens }, context) => {
		for (let index = 0; index < requiredTokens.length; index += 1) {
			if (!extractedToken.includes(requiredTokens[index])) {
				context.addIssue({
					code: "custom",
					message: `Extracted token is missing required token ${requiredTokens[index]}`,
					path: ["requiredTokens", index],
				});
			}
		}
	});

export const valueProvenanceSchema = z.enum([
	"direct-source",
	"interpolated",
	"derived",
	"user-input",
]);

const derivedLineageSchema = z
	.object({
		dependencyValueIds: z.array(idSchema).min(1),
		citationIds: z.array(idSchema).min(1),
		formula: z.string().trim().min(1),
		substitution: z.string().trim().min(1),
		result: scalarSchema,
		unit: z.string().trim().min(1),
	})
	.strict();

export const evidenceValueSchema = z
	.object({
		id: idSchema,
		optionId: idSchema,
		hazardId: idSchema,
		fieldId: idSchema,
		value: scalarSchema,
		unit: z.string().trim().min(1).optional(),
		provenance: valueProvenanceSchema,
		citationIds: z.array(idSchema),
		transformation: z.string().trim().min(1).optional(),
		derivedLineage: derivedLineageSchema.optional(),
	})
	.strict()
	.superRefine((value, context) => {
		if (value.provenance === "direct-source" && value.citationIds.length === 0) {
			context.addIssue({
				code: "custom",
				message: "Direct-source values require a citation",
				path: ["citationIds"],
			});
		}
		if (
			value.provenance === "interpolated" &&
			(value.citationIds.length < 2 || !value.transformation)
		) {
			context.addIssue({
				code: "custom",
				message: "Interpolated values require two citations and a transformation",
				path: ["citationIds"],
			});
		}
		if (value.provenance === "derived" && !value.derivedLineage) {
			context.addIssue({
				code: "custom",
				message: "Derived values require cited lineage",
				path: ["derivedLineage"],
			});
		}
		if (value.provenance !== "derived" && value.derivedLineage) {
			context.addIssue({
				code: "custom",
				message: "Only derived values may declare derived lineage",
				path: ["derivedLineage"],
			});
		}
	});

const evidenceRowSchema = z
	.object({
		id: idSchema,
		rowKey: z.string().trim().min(1),
		sourceDocumentId: idSchema,
		optionId: idSchema,
		hazardId: idSchema,
		citationIds: z.array(idSchema).min(1),
		fields: z.record(idSchema, scalarSchema),
	})
	.strict();

const canonicalRowSchema = evidenceRowSchema.extend({
	sourceRowIds: z.array(idSchema).min(1),
});

export const evidenceOverrideSchema = z
	.object({
		id: idSchema,
		affected: z
			.object({
				sourceDocumentId: idSchema,
				optionId: idSchema,
			})
			.strict(),
		reason: z.string().trim().min(1),
		competingOccurrences: z
			.array(
				z
					.object({
						rawRowId: idSchema,
						citationId: idSchema,
					})
					.strict(),
			)
			.min(2),
		chosenOccurrenceRawRowId: idSchema,
		author: z.string().trim().min(1),
		independentReviewer: z.string().trim().min(1),
		reviewDate: isoDateSchema,
	})
	.strict()
	.superRefine(({ author, independentReviewer }, context) => {
		if (author === independentReviewer) {
			context.addIssue({
				code: "custom",
				message: "Override author and independent reviewer must differ",
				path: ["independentReviewer"],
			});
		}
	});

export const regulatoryEvidenceStudySchema = z
	.object({
		schemaVersion: z.literal(1),
		studyId: idSchema,
		title: z.string().trim().min(1),
		sources: z.array(sourceDocumentSchema).min(1),
		citations: z.array(citationSchema).min(1),
		applicabilityCitationIds: z.array(idSchema),
		coverage: z
			.object({
				optionIds: z.array(idSchema).min(1),
				hazardIds: z.array(idSchema).min(1),
				fieldIds: z.array(idSchema).min(1),
			})
			.strict(),
		values: z.array(evidenceValueSchema).min(1),
		rawRows: z.array(evidenceRowSchema),
		canonicalRows: z.array(canonicalRowSchema),
		overrides: z.array(evidenceOverrideSchema),
	})
	.strict();

export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type EvidenceCitation = z.infer<typeof citationSchema>;
export type EvidenceValue = z.infer<typeof evidenceValueSchema>;
export type RegulatoryEvidenceStudy = z.infer<
	typeof regulatoryEvidenceStudySchema
>;
