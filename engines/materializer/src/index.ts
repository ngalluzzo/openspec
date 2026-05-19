import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { implementStorageReaderAdapter } from "@openspec/storage-reader-capability";
import type {
	ContentRead,
	ReadQuery,
	ReadReport,
} from "@openspec/storage-reader-capability/types";
import { implementStorageWriterAdapter } from "@openspec/storage-writer-capability";
import type {
	ContentWrite,
	OverwritePolicy,
	WriteBatch,
	WriteReport,
} from "@openspec/storage-writer-capability/types";

export type {
	ContentRead,
	ContentWrite,
	OverwritePolicy,
	ReadQuery,
	ReadReport,
	WriteBatch,
	WriteReport,
};

export const localFsStorageReader = implementStorageReaderAdapter({
	async read(query): Promise<ReadReport> {
		return localFsRead(query as unknown as LocalFsReadQuery);
	},
});

export const localFsStorageWriter = implementStorageWriterAdapter({
	async write(batch): Promise<WriteReport> {
		return localFsWrite(batch as unknown as LocalFsWriteBatch);
	},
});

type LocalFsReadQuery = {
	root: string;
	patterns?: string[];
};

type LocalFsWriteBatch = {
	writes: ContentWrite[];
	root?: string;
	policy?: OverwritePolicy;
};

export function localFsRead(query: LocalFsReadQuery): ReadReport {
	const root = resolve(query.root);
	const requested = query.patterns?.length
		? query.patterns
		: collectFileLocations(root);
	const locations = new Set<string>();
	const diagnostics: unknown[] = [];

	for (const pattern of requested) {
		const matches = matchLocations(root, pattern);
		if (matches.length === 0) {
			diagnostics.push({
				severity: "error",
				code: "storage.read.notFound",
				message: `No file matched '${pattern}'.`,
				details: { pattern },
			});
		}
		for (const location of matches) locations.add(location);
	}

	const files: ContentRead[] = [];
	for (const location of [...locations].sort()) {
		try {
			files.push({
				location,
				content: readFileSync(join(root, location), "utf8"),
			});
		} catch (cause) {
			diagnostics.push({
				severity: "error",
				code: "storage.read.failed",
				message: `Failed to read '${location}'.`,
				details: { location, cause: String(cause) },
			});
		}
	}

	return { files, diagnostics };
}

export function localFsWrite(batch: LocalFsWriteBatch): WriteReport {
	const destination = batch.root ?? process.cwd();
	const policy: OverwritePolicy = batch.policy ?? "overwrite-generated";

	const written: string[] = [];
	const skipped: string[] = [];
	const stale: string[] = [];

	for (const write of batch.writes) {
		const dest = join(destination, write.location);
		const existing = existsSync(dest);

		if (existing && policy !== "overwrite-generated") {
			skipped.push(dest);
			continue;
		}

		if (write.disposition === "scaffold" && existing) {
			skipped.push(dest);
			continue;
		}

		mkdirSync(dirname(dest), { recursive: true });
		writeFileSync(dest, write.content, "utf8");
		written.push(dest);
	}

	return { written, skipped, stale, diagnostics: [] };
}

function matchLocations(root: string, pattern: string): string[] {
	const normalized = normalizeLocation(pattern);
	if (!isGlob(normalized)) {
		const path = join(root, normalized);
		return existsSync(path) && statSync(path).isFile() ? [normalized] : [];
	}

	const regex = globRegex(normalized);
	return collectFileLocations(root).filter((location) => regex.test(location));
}

function collectFileLocations(root: string): string[] {
	const locations: string[] = [];
	walk(root, root, locations);
	return locations;
}

function walk(root: string, directory: string, locations: string[]) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.name === ".git" || entry.name === "node_modules") continue;
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			walk(root, path, locations);
		} else if (entry.isFile()) {
			locations.push(normalizeLocation(relative(root, path)));
		}
	}
}

function normalizeLocation(location: string): string {
	return location.replaceAll("\\", "/").replace(/^\/+/, "");
}

function isGlob(pattern: string): boolean {
	return (
		pattern.includes("*") || pattern.includes("?") || pattern.includes("[")
	);
}

function globRegex(pattern: string): RegExp {
	let source = "";
	for (let index = 0; index < pattern.length; index += 1) {
		const char = pattern[index];
		const next = pattern[index + 1];
		if (char === "*" && next === "*") {
			source += ".*";
			index += 1;
		} else if (char === "*") {
			source += "[^/]*";
		} else if (char === "?") {
			source += "[^/]";
		} else {
			source += escapeRegex(char ?? "");
		}
	}
	return new RegExp(`^${source}$`);
}

function escapeRegex(value: string): string {
	return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
