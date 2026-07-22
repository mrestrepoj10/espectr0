import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import type { SourceDocument } from "./schema";

export type VerifiedSourceLock = {
	id: string;
	localPath: string;
	sha256: string;
	size: number;
	pageCount: number;
};

export type SourceLockOptions = {
	readPageCount?: (
		source: SourceDocument,
		bytes: Uint8Array,
	) => number | Promise<number>;
};

function sha256(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

export async function verifySourceLocks(
	sources: SourceDocument[],
	repositoryRoot: string,
	options: SourceLockOptions = {},
): Promise<VerifiedSourceLock[]> {
	const locks = await Promise.all(
		sources
			.filter(({ redistribution }) => redistribution.decision === "bundled")
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
				if (source.mediaType === "application/pdf" && !options.readPageCount) {
					throw new Error(
						`PDF source ${source.id} requires a page-count reader for lock verification`,
					);
				}
				const actualPageCount = options.readPageCount
					? await options.readPageCount(source, bytes)
					: source.pageCount;
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

	return locks.sort((left, right) => left.id.localeCompare(right.id));
}
