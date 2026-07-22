import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { z } from "zod";

const idSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]*$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const scalarSchema = z.union([
	z.string(),
	z.number().finite(),
	z.boolean(),
	z.null(),
]);
const nullableUnitSchema = z.string().trim().min(1).nullable();
const isoDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine(
		(value) =>
			!Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
			new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
		{ message: "Invalid calendar date" },
	);

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
		printedPage: z.string().trim().min(1).nullable(),
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
		pages: z.array(pageMetadataSchema).min(1),
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
				message: "External-only and restricted sources must be pathless",
				path: ["redistribution", "localPath"],
			});
		}
		const physicalPages = new Set();
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
	"equation",
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
		printedPage: z.string().trim().min(1).nullable(),
		reference: z.string().trim().min(1),
		parentCitationId: idSchema.optional(),
		rect: normalizedRectSchema,
		extractedToken: z.string().trim().min(1),
		normalizedValue: scalarSchema.optional(),
		normalizedNumericValue: z.number().finite().optional(),
		unit: nullableUnitSchema,
		transformation: z.string().trim().min(1).nullable(),
		requiredTokens: z.array(z.string().trim().min(1)).min(1),
	})
	.strict()
	.superRefine((citation, context) => {
		for (let index = 0; index < citation.requiredTokens.length; index += 1) {
			if (!citation.extractedToken.includes(citation.requiredTokens[index])) {
				context.addIssue({
					code: "custom",
					message: `Extracted token is missing required token ${citation.requiredTokens[index]}`,
					path: ["requiredTokens", index],
				});
			}
		}
		if (
			citation.normalizedNumericValue !== undefined &&
			citation.normalizedValue !== undefined &&
			citation.normalizedNumericValue !== citation.normalizedValue
		) {
			context.addIssue({
				code: "custom",
				message: "Normalized numeric and scalar values differ",
				path: ["normalizedNumericValue"],
			});
		}
	});

export const valueProvenanceSchema = z.enum([
	"direct-source",
	"interpolated",
	"derived",
	"user-input",
]);

const lineageDependencySchema = z
	.object({
		valueId: idSchema,
		inputCitationIds: z.array(idSchema).min(1),
	})
	.strict();

const derivedLineageSchema = z
	.object({
		dependencies: z.array(lineageDependencySchema).min(1),
		formulaCitationId: idSchema,
		formula: z.string().trim().min(1),
		substitution: z.string().trim().min(1),
		result: scalarSchema,
		unit: nullableUnitSchema,
	})
	.strict();

export const evidenceValueSchema = z
	.object({
		id: idSchema,
		optionId: idSchema,
		hazardId: idSchema,
		fieldId: idSchema,
		value: scalarSchema,
		unit: nullableUnitSchema,
		provenance: valueProvenanceSchema,
		citationIds: z.array(idSchema),
		transformation: z.string().trim().min(1).nullable(),
		derivedLineage: derivedLineageSchema.optional(),
	})
	.strict()
	.superRefine((value, context) => {
		if (
			value.provenance === "direct-source" &&
			(value.citationIds.length !== 1 || !value.transformation)
		) {
			context.addIssue({
				code: "custom",
				message: "Direct-source values require exactly one cell citation and transformation",
				path: ["citationIds"],
			});
		}
		if (
			value.provenance === "interpolated" &&
			(value.citationIds.length < 2 || !value.transformation)
		) {
			context.addIssue({
				code: "custom",
				message: "Interpolated values require two cell citations and a transformation",
				path: ["citationIds"],
			});
		}
		if (
			value.provenance === "derived" &&
			(!value.derivedLineage || value.citationIds.length !== 0 || value.transformation)
		) {
			context.addIssue({
				code: "custom",
				message: "Derived values require role-based lineage and no unclassified citations",
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
		if (
			value.provenance === "user-input" &&
			(value.citationIds.length !== 0 || value.transformation)
		) {
			context.addIssue({
				code: "custom",
				message: "User inputs cannot claim regulatory citations or transformations",
				path: ["citationIds"],
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
			.object({ sourceDocumentId: idSchema, optionId: idSchema })
			.strict(),
		reason: z.string().trim().min(1),
		competingOccurrences: z
			.array(
				z
					.object({ rawRowId: idSchema, citationId: idSchema })
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
		applicabilityCitationIds: z.array(idSchema).min(1),
		coverage: z
			.object({
				optionIds: z.array(idSchema).min(1),
				hazardIds: z.array(idSchema).min(1),
				fieldIds: z.array(idSchema).min(1),
			})
			.strict(),
		values: z.array(evidenceValueSchema).min(1),
		rawRows: z.array(evidenceRowSchema).min(1),
		canonicalRows: z.array(canonicalRowSchema).min(1),
		overrides: z.array(evidenceOverrideSchema),
	})
	.strict();

const sourceLockSchema = z
	.object({
		id: idSchema,
		localPath: z.string().trim().min(1),
		sha256: sha256Schema,
		size: z.number().int().nonnegative(),
		pageCount: z.number().int().positive(),
	})
	.strict();

const reportOverrideSchema = z
	.object({
		id: idSchema,
		selectedRawRowId: z.string().trim().min(1),
		competingRawRowIds: z.array(z.string().trim().min(1)).min(2),
		reviewStatus: z.enum(["reviewed", "legacy-pending"]),
	})
	.strict();

const citationCountsSchema = z
	.object({
		table: z.number().int().nonnegative(),
		row: z.number().int().nonnegative(),
		cell: z.number().int().nonnegative(),
		clause: z.number().int().nonnegative(),
		equation: z.number().int().nonnegative(),
		note: z.number().int().nonnegative(),
		warning: z.number().int().nonnegative(),
		figure: z.number().int().nonnegative(),
		applicability: z.number().int().nonnegative(),
	})
	.strict();

export const evidenceCheckReportSchema = z
	.object({
		schemaVersion: z.literal(1),
		studyId: idSchema,
		rawRows: z
			.object({ count: z.number().int().positive(), ids: z.array(z.string().min(1)) })
			.strict(),
		canonicalRows: z
			.object({ count: z.number().int().positive(), ids: z.array(z.string().min(1)) })
			.strict(),
		duplicates: z.array(
			z
				.object({
					rowKey: z.string().min(1),
					rawRowIds: z.array(z.string().min(1)).min(2),
					overrideId: idSchema,
				})
				.strict(),
		),
		overrides: z.array(reportOverrideSchema),
		citations: citationCountsSchema,
		uncoveredValues: z.array(z.string()).max(0),
		hashes: z.record(z.string().min(1), sha256Schema),
		sizes: z.record(z.string().min(1), z.number().int().nonnegative()),
		sourceLocks: z.array(sourceLockSchema),
		coverage: z
			.object({
				optionIds: z.array(idSchema).min(1),
				hazardIds: z.array(idSchema).min(1),
				fieldIds: z.array(idSchema).min(1),
				expectedRows: z.number().int().positive(),
				expectedValues: z.number().int().positive(),
				bundledSources: z.number().int().nonnegative(),
			})
			.strict(),
	})
	.strict()
	.superRefine((report, context) => {
		if (report.rawRows.count !== report.rawRows.ids.length) {
			context.addIssue({ code: "custom", message: "Raw row count and IDs differ" });
		}
		if (report.canonicalRows.count !== report.canonicalRows.ids.length) {
			context.addIssue({ code: "custom", message: "Canonical row count and IDs differ" });
		}
		if (new Set(report.rawRows.ids).size !== report.rawRows.ids.length) {
			context.addIssue({ code: "custom", message: "Duplicate report raw row IDs" });
		}
		if (new Set(report.canonicalRows.ids).size !== report.canonicalRows.ids.length) {
			context.addIssue({ code: "custom", message: "Duplicate report canonical row IDs" });
		}
		const expectedRows =
			report.coverage.optionIds.length * report.coverage.hazardIds.length;
		const expectedValues = expectedRows * report.coverage.fieldIds.length;
		if (
			report.coverage.expectedRows !== expectedRows ||
			report.coverage.expectedValues !== expectedValues ||
			report.canonicalRows.count !== expectedRows
		) {
			context.addIssue({ code: "custom", message: "Report coverage totals differ" });
		}
		if (report.sourceLocks.length !== report.coverage.bundledSources) {
			context.addIssue({ code: "custom", message: "Report source-lock coverage differs" });
		}
		for (const lock of report.sourceLocks) {
			const key = `source:${lock.id}`;
			if (report.hashes[key] !== lock.sha256 || report.sizes[key] !== lock.size) {
				context.addIssue({
					code: "custom",
					message: `Report source lock ${lock.id} lacks matching hash/size evidence`,
				});
			}
		}
		for (const [label, values] of [
			["option", report.coverage.optionIds],
			["hazard", report.coverage.hazardIds],
			["field", report.coverage.fieldIds],
		]) {
			if (new Set(values).size !== values.length) {
				context.addIssue({ code: "custom", message: `Duplicate report coverage ${label}` });
			}
		}
		const duplicateOverrideIds = report.duplicates
			.map(({ overrideId }) => overrideId)
			.sort(compare);
		const overrideIds = report.overrides.map(({ id }) => id).sort(compare);
		if (
			new Set(overrideIds).size !== overrideIds.length ||
			new Set(duplicateOverrideIds).size !== duplicateOverrideIds.length ||
			JSON.stringify(duplicateOverrideIds) !== JSON.stringify(overrideIds)
		) {
			context.addIssue({ code: "custom", message: "Report duplicate/override coverage differs" });
		}
		const rawRowIds = new Set(report.rawRows.ids);
		const duplicateByOverrideId = new Map();
		const duplicateRowKeys = new Set();
		const duplicateRawRowIds = new Set();
		const validDuplicateRowKeys = new Set(
			report.coverage.optionIds.flatMap((optionId) =>
				report.coverage.hazardIds.map((hazardId) => rowKey(optionId, hazardId)),
			),
		);
		let duplicateSurplus = 0;
		for (const duplicate of report.duplicates) {
			if (
				duplicateRowKeys.has(duplicate.rowKey) ||
				!validDuplicateRowKeys.has(duplicate.rowKey)
			) {
				context.addIssue({
					code: "custom",
					message: `Invalid or repeated report duplicate row key ${duplicate.rowKey}`,
				});
			}
			duplicateRowKeys.add(duplicate.rowKey);
			duplicateByOverrideId.set(duplicate.overrideId, duplicate);
			duplicateSurplus += duplicate.rawRowIds.length - 1;
			if (
				new Set(duplicate.rawRowIds).size !== duplicate.rawRowIds.length ||
				duplicate.rawRowIds.some((id) => !rawRowIds.has(id))
			) {
				context.addIssue({ code: "custom", message: `Invalid report duplicate ${duplicate.rowKey}` });
			}
			for (const rawRowId of duplicate.rawRowIds) {
				if (duplicateRawRowIds.has(rawRowId)) {
					context.addIssue({
						code: "custom",
						message: `Report raw row ${rawRowId} belongs to multiple duplicate groups`,
					});
				}
				duplicateRawRowIds.add(rawRowId);
			}
		}
		for (const override of report.overrides) {
			const duplicate = duplicateByOverrideId.get(override.id);
			if (
				new Set(override.competingRawRowIds).size !== override.competingRawRowIds.length ||
				!override.competingRawRowIds.includes(override.selectedRawRowId) ||
				override.competingRawRowIds.some((id) => !rawRowIds.has(id)) ||
				!rawRowIds.has(override.selectedRawRowId)
			) {
				context.addIssue({ code: "custom", message: `Invalid report override ${override.id}` });
			}
			if (!duplicate || !sameSet(duplicate.rawRowIds, override.competingRawRowIds)) {
				context.addIssue({
					code: "custom",
					message: `Report duplicate/override raw rows differ for ${override.id}`,
				});
			}
		}
		if (report.rawRows.count !== report.coverage.expectedRows + duplicateSurplus) {
			context.addIssue({
				code: "custom",
				message: "Raw row count has unexplained surplus or missing duplicate evidence",
			});
		}
		if (
			report.studyId !== "nsr10" &&
			report.overrides.some(({ reviewStatus }) => reviewStatus === "legacy-pending")
		) {
			context.addIssue({
				code: "custom",
				message: "Legacy-pending overrides are isolated to the NSR compatibility adapter",
			});
		}
		if (Object.keys(report.hashes).length === 0 || Object.keys(report.sizes).length === 0) {
			context.addIssue({ code: "custom", message: "Report hashes and sizes are required" });
		}
	});

export const studyDescriptorSchema = z
	.object({
		studyId: idSchema,
		check: z.custom((value) => typeof value === "function", "check must be a function"),
	})
	.strict();

export const aggregateEvidenceReportSchema = z
	.object({
		schemaVersion: z.literal(1),
		installedStudies: z.array(idSchema).min(1),
		studies: z.array(evidenceCheckReportSchema).min(1),
	})
	.strict()
	.superRefine((report, context) => {
		const installed = [...report.installedStudies].sort(compare);
		const reported = report.studies.map(({ studyId }) => studyId).sort(compare);
		if (
			new Set(installed).size !== installed.length ||
			JSON.stringify(installed) !== JSON.stringify(reported)
		) {
			context.addIssue({ code: "custom", message: "Aggregate installed/report study IDs differ" });
		}
	});

export function validateInstalledDescriptors(inputs) {
	const descriptors = inputs.map((input) => studyDescriptorSchema.parse(input));
	assertUniqueStrings(
		"installed study ID",
		descriptors.map(({ studyId }) => studyId),
	);
	return descriptors;
}

export function validateStudyCheckResult(descriptor, input) {
	const parsedDescriptor = studyDescriptorSchema.parse(descriptor);
	const report = evidenceCheckReportSchema.parse(input);
	invariant(
		report.studyId === parsedDescriptor.studyId,
		`Descriptor/result study ID mismatch: ${parsedDescriptor.studyId}/${report.studyId}`,
	);
	return report;
}

export async function runInstalledDescriptors(inputs, context) {
	const descriptors = validateInstalledDescriptors(inputs).sort((left, right) =>
		compare(left.studyId, right.studyId),
	);
	const reports = [];
	for (const descriptor of descriptors) {
		reports.push(
			validateStudyCheckResult(descriptor, await descriptor.check(context)),
		);
	}
	return { descriptors, reports };
}

function compare(left, right) {
	return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalize(value) {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => compare(left, right))
				.map(([key, nested]) => [key, canonicalize(nested)]),
		);
	}
	return value;
}

export function deterministicJson(value) {
	return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

async function readBuiltInPageCount(source, bytes) {
	if (source.mediaType === "application/pdf") {
		const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
		const pdf = await getDocument({
			data: new Uint8Array(bytes),
			disableWorker: true,
			verbosity: 0,
		}).promise;
		const pageCount = pdf.numPages;
		await pdf.destroy();
		return pageCount;
	}
	if (source.mediaType.startsWith("text/")) {
		return Buffer.from(bytes).toString("utf8").split("\f").length;
	}
	return undefined;
}

function sha256(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

export async function verifySourceLocks(sourcesInput, repositoryRoot, options = {}) {
	const sources = z.array(sourceDocumentSchema).min(1).parse(sourcesInput);
	const bundledSources = sources.filter(
		({ redistribution }) => redistribution.decision === "bundled",
	);
	const locks = await Promise.all(
		bundledSources
			.map(async (source) => {
				const localPath = source.redistribution.localPath;
				if (!localPath) throw new Error(`Bundled source ${source.id} has no local path`);
				const absolutePath = resolve(repositoryRoot, localPath);
				const relativePath = relative(repositoryRoot, absolutePath);
				if (isAbsolute(relativePath) || relativePath.startsWith("..")) {
					throw new Error(`Source ${source.id} local path escapes the repository root`);
				}
				const bytes = await readFile(absolutePath);
				const actualHash = sha256(bytes);
				if (actualHash !== source.sha256) {
					throw new Error(
						`Source lock drift for ${source.id}: expected ${source.sha256}, found ${actualHash}`,
					);
				}
				const builtInPageCount = await readBuiltInPageCount(source, bytes);
				const actualPageCount =
					builtInPageCount ??
					(await options.readPageCount?.(source, bytes));
				if (actualPageCount === undefined) {
					throw new Error(
						`Bundled source ${source.id} media type ${source.mediaType} requires a page-count reader`,
					);
				}
				if (actualPageCount !== source.pageCount) {
					throw new Error(
						`Source page-count drift for ${source.id}: expected ${source.pageCount}, found ${actualPageCount}`,
					);
				}
				return {
					id: source.id,
					localPath,
					sha256: actualHash,
					size: bytes.byteLength,
					pageCount: actualPageCount,
				};
			}),
	);
	return locks.sort((left, right) => compare(left.id, right.id));
}

function invariant(condition, message) {
	if (!condition) throw new Error(message);
}

function uniqueIndex(label, items) {
	const index = new Map();
	for (const item of items) {
		invariant(!index.has(item.id), `Duplicate ${label} id ${item.id}`);
		index.set(item.id, item);
	}
	return index;
}

function assertUniqueStrings(label, values) {
	const seen = new Set();
	for (const value of values) {
		invariant(!seen.has(value), `Duplicate ${label} ${value}`);
		seen.add(value);
	}
}

function sameScalar(left, right) {
	return Object.is(left, right);
}

function sameSet(left, right) {
	return (
		left.length === right.length &&
		JSON.stringify([...left].sort(compare)) === JSON.stringify([...right].sort(compare))
	);
}

function sameFields(left, right) {
	const leftKeys = Object.keys(left).sort(compare);
	const rightKeys = Object.keys(right).sort(compare);
	return (
		JSON.stringify(leftKeys) === JSON.stringify(rightKeys) &&
		leftKeys.every((key) => sameScalar(left[key], right[key]))
	);
}

function containsRect(outer, inner) {
	return (
		inner.left >= outer.left &&
		inner.top >= outer.top &&
		inner.left + inner.width <= outer.left + outer.width &&
		inner.top + inner.height <= outer.top + outer.height
	);
}

function rowKey(optionId, hazardId) {
	return `${optionId}/${hazardId}`;
}

function valueKey(optionId, hazardId, fieldId) {
	return `${optionId}\u0000${hazardId}\u0000${fieldId}`;
}

function citationRegionKey(citation) {
	return [
		citation.sourceDocumentId,
		citation.physicalPage,
		citation.rect.left,
		citation.rect.top,
		citation.rect.width,
		citation.rect.height,
	].join(":");
}

function assertNoCitationCycles(study) {
	const parents = new Map(
		study.citations.map((citation) => [citation.id, citation.parentCitationId]),
	);
	for (const citation of study.citations) {
		const seen = new Set();
		let currentId = citation.id;
		while (currentId) {
			invariant(!seen.has(currentId), `Citation parent cycle at ${currentId}`);
			seen.add(currentId);
			currentId = parents.get(currentId);
		}
	}
}

function assertNoDerivedCycles(study) {
	const dependencies = new Map(
		study.values.map((value) => [
			value.id,
			value.derivedLineage?.dependencies.map(({ valueId }) => valueId) ?? [],
		]),
	);
	const active = new Set();
	const complete = new Set();
	function visit(id) {
		invariant(!active.has(id), `Derived dependency cycle at ${id}`);
		if (complete.has(id)) return;
		active.add(id);
		for (const dependencyId of dependencies.get(id) ?? []) visit(dependencyId);
		active.delete(id);
		complete.add(id);
	}
	for (const id of dependencies.keys()) visit(id);
}

function supportCitationIds(value) {
	if (!value.derivedLineage) return new Set(value.citationIds);
	return new Set([
		value.derivedLineage.formulaCitationId,
		...value.derivedLineage.dependencies.flatMap(({ inputCitationIds }) =>
			inputCitationIds,
		),
	]);
}

export async function checkEvidenceStudy(input, options) {
	invariant(options?.repositoryRoot, "repositoryRoot is required for evidence checking");
	const study = regulatoryEvidenceStudySchema.parse(input);
	const sourceLocks = await verifySourceLocks(study.sources, options.repositoryRoot, {
		readPageCount: options.readPageCount,
	});
	const sourceById = uniqueIndex("source", study.sources);
	const citationById = uniqueIndex("citation", study.citations);
	const valueById = uniqueIndex("value", study.values);
	const rawRowById = uniqueIndex("raw row", study.rawRows);
	uniqueIndex("canonical row", study.canonicalRows);
	const overrideById = uniqueIndex("override", study.overrides);
	assertUniqueStrings("coverage option", study.coverage.optionIds);
	assertUniqueStrings("coverage hazard", study.coverage.hazardIds);
	assertUniqueStrings("coverage field", study.coverage.fieldIds);

	const expectedLockIds = study.sources
		.filter(({ redistribution }) => redistribution.decision === "bundled")
		.map(({ id }) => id)
		.sort(compare);
	invariant(
		JSON.stringify(expectedLockIds) ===
			JSON.stringify(sourceLocks.map(({ id }) => id).sort(compare)),
		"Source-lock coverage differs from bundled sources",
	);

	const usedCitationIds = new Set(study.applicabilityCitationIds);
	for (const citationId of study.applicabilityCitationIds) {
		const citation = citationById.get(citationId);
		invariant(citation, `Missing applicability citation ${citationId}`);
		invariant(
			citation.regionKind === "applicability",
			`Applicability citation ${citationId} has the wrong region kind`,
		);
	}

	const citedSourceIds = new Set();
	for (const citation of study.citations) {
		const source = sourceById.get(citation.sourceDocumentId);
		invariant(
			source,
			`Citation ${citation.id} references missing source ${citation.sourceDocumentId}`,
		);
		const page = source.pages.find(
			({ physicalPage }) => physicalPage === citation.physicalPage,
		);
		invariant(page, `Citation ${citation.id} has no physical page metadata`);
		invariant(
			citation.printedPage === page.printedPage,
			`Citation ${citation.id} printed page differs from source metadata`,
		);
		invariant(
			containsRect(page.crop, citation.rect),
			`Citation ${citation.id} lies outside the declared page crop`,
		);
		citedSourceIds.add(source.id);
		const parent = citation.parentCitationId
			? citationById.get(citation.parentCitationId)
			: undefined;
		if (citation.regionKind === "cell") {
			invariant(parent?.regionKind === "row", `Cell citation ${citation.id} requires a row parent`);
		} else if (citation.regionKind === "row") {
			invariant(
				parent?.regionKind === "table",
				`Row citation ${citation.id} requires a table parent`,
			);
		} else {
			invariant(!parent, `${citation.regionKind} citation ${citation.id} cannot have a parent`);
		}
		if (parent) {
			invariant(
				parent.sourceDocumentId === citation.sourceDocumentId &&
					parent.physicalPage === citation.physicalPage &&
					containsRect(parent.rect, citation.rect),
				`Citation ${citation.id} is not contained by its parent`,
			);
			usedCitationIds.add(parent.id);
		}
	}
	assertNoCitationCycles(study);
	const orphanSources = [...sourceById.keys()].filter((id) => !citedSourceIds.has(id));
	invariant(orphanSources.length === 0, `Orphan sources: ${orphanSources.sort(compare).join(", ")}`);

	const expectedValueKeys = new Set();
	const expectedRowKeys = new Set();
	for (const optionId of study.coverage.optionIds) {
		for (const hazardId of study.coverage.hazardIds) {
			expectedRowKeys.add(rowKey(optionId, hazardId));
			for (const fieldId of study.coverage.fieldIds) {
				expectedValueKeys.add(valueKey(optionId, hazardId, fieldId));
			}
		}
	}

	const valueByCoverage = new Map();
	for (const value of study.values) {
		const key = valueKey(value.optionId, value.hazardId, value.fieldId);
		invariant(expectedValueKeys.has(key), `Orphan value ${value.id} is outside declared coverage`);
		invariant(
			!valueByCoverage.has(key),
			`Duplicate covered value ${value.id}; already covered by ${valueByCoverage.get(key)}`,
		);
		valueByCoverage.set(key, value);
		for (const citationId of value.citationIds) {
			invariant(
				citationById.has(citationId),
				`Value ${value.id} references missing citation ${citationId}`,
			);
			usedCitationIds.add(citationId);
		}
		if (value.provenance === "direct-source") {
			const citation = citationById.get(value.citationIds[0]);
			invariant(citation?.regionKind === "cell", `Direct value ${value.id} requires cell evidence`);
			invariant(
				citation.normalizedValue !== undefined &&
					sameScalar(citation.normalizedValue, value.value) &&
					citation.unit === value.unit &&
					citation.transformation === value.transformation,
				`Direct value ${value.id} does not match its exact cell transcription`,
			);
			if (typeof value.value === "number") {
				invariant(
					citation.normalizedNumericValue === value.value,
					`Direct numeric value ${value.id} has no matching normalized numeric value`,
				);
			}
		}
		if (value.provenance === "interpolated") {
			for (const citationId of value.citationIds) {
				invariant(
					citationById.get(citationId)?.regionKind === "cell",
					`Interpolated value ${value.id} requires cell inputs`,
				);
			}
		}
		if (value.derivedLineage) {
			const lineage = value.derivedLineage;
			const formulaCitation = citationById.get(lineage.formulaCitationId);
			invariant(
				formulaCitation && ["clause", "equation"].includes(formulaCitation.regionKind),
				`Derived value ${value.id} requires a clause/equation formula citation`,
			);
			invariant(
				formulaCitation.extractedToken.includes(lineage.formula),
				`Derived value ${value.id} formula is absent from its formula citation`,
			);
			usedCitationIds.add(lineage.formulaCitationId);
			const dependencyIds = lineage.dependencies.map(({ valueId }) => valueId);
			assertUniqueStrings(`derived dependency for ${value.id}`, dependencyIds);
			for (const dependency of lineage.dependencies) {
				const dependencyValue = valueById.get(dependency.valueId);
				invariant(
					dependencyValue,
					`Derived value ${value.id} has missing dependency ${dependency.valueId}`,
				);
				invariant(dependency.valueId !== value.id, `Derived value ${value.id} cannot depend on itself`);
				const validInputCitations = supportCitationIds(dependencyValue);
				assertUniqueStrings(
					`input citation for ${value.id}/${dependency.valueId}`,
					dependency.inputCitationIds,
				);
				for (const citationId of dependency.inputCitationIds) {
					invariant(
						citationById.has(citationId) && validInputCitations.has(citationId),
						`Derived value ${value.id} has unrelated input citation ${citationId}`,
					);
					usedCitationIds.add(citationId);
				}
			}
			invariant(
				sameScalar(lineage.result, value.value) && lineage.unit === value.unit,
				`Derived value ${value.id} lineage result or unit differs`,
			);
		}
	}
	assertNoDerivedCycles(study);
	const uncoveredValues = [...expectedValueKeys]
		.filter((key) => !valueByCoverage.has(key))
		.map((key) => key.replaceAll("\u0000", "/"))
		.sort(compare);
	invariant(
		uncoveredValues.length === 0,
		`Incomplete option×hazard×field coverage: ${uncoveredValues.join(", ")}`,
	);

	const expectedFields = [...study.coverage.fieldIds].sort(compare);
	const overrideCitationIdsByRawRowId = new Map();
	for (const override of study.overrides) {
		for (const occurrence of override.competingOccurrences) {
			const citationIds = overrideCitationIdsByRawRowId.get(occurrence.rawRowId) ?? [];
			citationIds.push(occurrence.citationId);
			overrideCitationIdsByRawRowId.set(occurrence.rawRowId, citationIds);
		}
	}

	function directCellMatchesRowField(citation, value, fieldValue) {
		return (
			citation?.regionKind === "cell" &&
			citation.normalizedValue !== undefined &&
			sameScalar(citation.normalizedValue, fieldValue) &&
			citation.unit === value.unit &&
			citation.transformation === value.transformation
		);
	}

	function cellRowSupportIds(citation) {
		return [citation.id, citation.parentCitationId].filter(Boolean);
	}

	function assertRowShape(label, row) {
		const expectedKey = rowKey(row.optionId, row.hazardId);
		invariant(
			expectedRowKeys.has(expectedKey) && row.rowKey === expectedKey,
			`${label} ${row.id} has an unexpected row key`,
		);
		invariant(
			JSON.stringify(Object.keys(row.fields).sort(compare)) ===
				JSON.stringify(expectedFields),
			`${label} ${row.id} does not contain the exact field set`,
		);
		invariant(sourceById.has(row.sourceDocumentId), `${label} ${row.id} references a missing source`);
		assertUniqueStrings(`${label} citation for ${row.id}`, row.citationIds);
		for (const citationId of row.citationIds) {
			const citation = citationById.get(citationId);
			invariant(
				citation,
				`${label} ${row.id} references missing citation ${citationId}`,
			);
			let current = citation;
			while (current) {
				invariant(
					current.sourceDocumentId === row.sourceDocumentId,
					`${label} ${row.id} citation ${citationId} has source ancestry outside ${row.sourceDocumentId}`,
				);
				current = current.parentCitationId
					? citationById.get(current.parentCitationId)
					: undefined;
			}
			usedCitationIds.add(citationId);
		}
	}

	function assertRowFieldSupport(label, row) {
		const rowCitationIds = new Set(row.citationIds);
		const occurrenceCitationIds = new Set(
			label === "Raw row"
				? (overrideCitationIdsByRawRowId.get(row.id) ?? [])
				: row.sourceRowIds.flatMap(
						(rawRowId) => overrideCitationIdsByRawRowId.get(rawRowId) ?? [],
					),
		);
		const allowedRowSupportIds = new Set();
		const requiredFieldSupport = [];
		for (const fieldId of study.coverage.fieldIds) {
			const value = valueByCoverage.get(valueKey(row.optionId, row.hazardId, fieldId));
			if (value?.provenance === "direct-source") {
				const expectedFieldValue =
					label === "Canonical row" ? value.value : row.fields[fieldId];
				const supportingCells = [...value.citationIds, ...occurrenceCitationIds]
					.map((citationId) => citationById.get(citationId))
					.filter((citation) => directCellMatchesRowField(citation, value, expectedFieldValue));
				for (const citation of supportingCells) {
					for (const citationId of cellRowSupportIds(citation)) {
						allowedRowSupportIds.add(citationId);
					}
				}
				requiredFieldSupport.push({ fieldId, provenance: "direct", supportingCells });
			}
			if (value?.provenance === "interpolated") {
				for (const citationId of value.citationIds) {
					const citation = citationById.get(citationId);
					const supportIds = cellRowSupportIds(citation);
					for (const supportId of supportIds) allowedRowSupportIds.add(supportId);
					requiredFieldSupport.push({
						fieldId,
						provenance: "interpolated",
						citationId,
						supportIds,
					});
				}
			}
		}
		for (const citationId of row.citationIds) {
			const citation = citationById.get(citationId);
			invariant(
				["row", "cell"].includes(citation.regionKind) &&
					allowedRowSupportIds.has(citationId),
				`${label} ${row.id} citation ${citationId} is not row/cell evidence for its direct/interpolated fields`,
			);
		}
		for (const support of requiredFieldSupport) {
			if (support.provenance === "direct") {
				invariant(
					support.supportingCells.some((citation) =>
						cellRowSupportIds(citation).some((citationId) => rowCitationIds.has(citationId)),
					),
					`${label} ${row.id} field ${support.fieldId} lacks direct cell/row support`,
				);
			} else {
				invariant(
					support.supportIds.some((supportId) => rowCitationIds.has(supportId)),
					`${label} ${row.id} field ${support.fieldId} lacks interpolated cell/row support ${support.citationId}`,
				);
			}
		}
	}

	const rawRowsByKey = new Map();
	for (const row of study.rawRows) {
		assertRowShape("Raw row", row);
		const rows = rawRowsByKey.get(row.rowKey) ?? [];
		rows.push(row);
		rawRowsByKey.set(row.rowKey, rows);
	}
	const canonicalByKey = new Map();
	for (const row of study.canonicalRows) {
		assertRowShape("Canonical row", row);
		invariant(!canonicalByKey.has(row.rowKey), `Duplicate canonical row key ${row.rowKey}`);
		canonicalByKey.set(row.rowKey, row);
	}
	for (const expectedKey of expectedRowKeys) {
		invariant(rawRowsByKey.has(expectedKey), `Missing raw row ${expectedKey}`);
		invariant(canonicalByKey.has(expectedKey), `Missing canonical row ${expectedKey}`);
	}
	invariant(rawRowsByKey.size === expectedRowKeys.size, "Unexpected raw rows detected");
	invariant(canonicalByKey.size === expectedRowKeys.size, "Unexpected canonical rows detected");

	const matchedOverrideIds = new Set();
	const duplicates = [];
	for (const key of [...expectedRowKeys].sort(compare)) {
		const rawRows = rawRowsByKey.get(key);
		const canonical = canonicalByKey.get(key);
		let selected;
		let override;
		if (rawRows.length === 1) {
			selected = rawRows[0];
			invariant(
				canonical.sourceRowIds.length === 1 && canonical.sourceRowIds[0] === selected.id,
				`Canonical row ${canonical.id} must consume its only raw row`,
			);
		} else {
			const rawIds = rawRows.map(({ id }) => id).sort(compare);
			const matches = study.overrides.filter((candidate) =>
				sameSet(
					candidate.competingOccurrences.map(({ rawRowId }) => rawRowId),
					rawIds,
				),
			);
			invariant(matches.length === 1, `Undeclared or ambiguously overridden duplicate row ${key}`);
			override = matches[0];
			selected = rawRowById.get(override.chosenOccurrenceRawRowId);
			invariant(selected && rawIds.includes(selected.id), `Override ${override.id} chooses a non-competing row`);
			invariant(
				rawRows.every(
					(row) =>
						row.sourceDocumentId === override.affected.sourceDocumentId &&
						row.optionId === override.affected.optionId,
				),
				`Override ${override.id} affected source/option does not match`,
			);
			const occurrenceCitationIds = override.competingOccurrences.map(
				({ citationId }) => citationId,
			);
			assertUniqueStrings(`override occurrence citation for ${override.id}`, occurrenceCitationIds);
			const occurrenceRegions = [];
			for (const occurrence of override.competingOccurrences) {
				const row = rawRowById.get(occurrence.rawRowId);
				const citation = citationById.get(occurrence.citationId);
				invariant(
					row?.citationIds.includes(occurrence.citationId) && citation,
					`Override ${override.id} has an invalid competing citation`,
				);
				occurrenceRegions.push(citationRegionKey(citation));
				usedCitationIds.add(occurrence.citationId);
			}
			assertUniqueStrings(`override occurrence region for ${override.id}`, occurrenceRegions);
			invariant(
				canonical.sourceRowIds.length === 1 && canonical.sourceRowIds[0] === selected.id,
				`Canonical row ${canonical.id} does not use override ${override.id} selection`,
			);
			matchedOverrideIds.add(override.id);
			duplicates.push({ rowKey: key, rawRowIds: rawIds, overrideId: override.id });
		}
		for (const rawRow of rawRows) assertRowFieldSupport("Raw row", rawRow);
		assertRowFieldSupport("Canonical row", canonical);
		invariant(
			canonical.sourceDocumentId === selected.sourceDocumentId &&
				sameSet(canonical.citationIds, selected.citationIds) &&
				sameFields(canonical.fields, selected.fields),
			`Canonical row ${canonical.id} differs from selected raw occurrence`,
		);
		for (const fieldId of study.coverage.fieldIds) {
			const value = valueByCoverage.get(valueKey(canonical.optionId, canonical.hazardId, fieldId));
			invariant(
				value && sameScalar(canonical.fields[fieldId], value.value),
				`Canonical row ${canonical.id} field ${fieldId} differs from its value`,
			);
		}
	}
	for (const overrideId of overrideById.keys()) {
		invariant(
			matchedOverrideIds.has(overrideId),
			`Orphan override ${overrideId} does not resolve a duplicate row`,
		);
	}
	const orphanCitations = [...citationById.keys()].filter(
		(citationId) => !usedCitationIds.has(citationId),
	);
	invariant(
		orphanCitations.length === 0,
		`Orphan citations: ${orphanCitations.sort(compare).join(", ")}`,
	);

	const studyBytes = Buffer.from(deterministicJson(study), "utf8");
	const hashes = { study: sha256(studyBytes) };
	const sizes = { study: studyBytes.byteLength };
	for (const lock of sourceLocks) {
		hashes[`source:${lock.id}`] = lock.sha256;
		sizes[`source:${lock.id}`] = lock.size;
	}
	const citationCounts = Object.fromEntries(
		citationRegionKindSchema.options.map((kind) => [
			kind,
			study.citations.filter(({ regionKind }) => regionKind === kind).length,
		]),
	);
	const report = {
		schemaVersion: 1,
		studyId: study.studyId,
		rawRows: { count: study.rawRows.length, ids: study.rawRows.map(({ id }) => id).sort(compare) },
		canonicalRows: {
			count: study.canonicalRows.length,
			ids: study.canonicalRows.map(({ id }) => id).sort(compare),
		},
		duplicates,
		overrides: study.overrides
			.map((override) => ({
				id: override.id,
				selectedRawRowId: override.chosenOccurrenceRawRowId,
				competingRawRowIds: override.competingOccurrences
					.map(({ rawRowId }) => rawRowId)
					.sort(compare),
				reviewStatus: "reviewed",
			}))
			.sort((left, right) => compare(left.id, right.id)),
		citations: citationCounts,
		uncoveredValues: [],
		hashes,
		sizes,
		sourceLocks,
		coverage: {
			optionIds: [...study.coverage.optionIds].sort(compare),
			hazardIds: [...study.coverage.hazardIds].sort(compare),
			fieldIds: [...study.coverage.fieldIds].sort(compare),
			expectedRows: expectedRowKeys.size,
			expectedValues: expectedValueKeys.size,
			bundledSources: expectedLockIds.length,
		},
	};
	return evidenceCheckReportSchema.parse(report);
}
