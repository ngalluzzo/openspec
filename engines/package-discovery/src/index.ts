import type { Dirent } from "node:fs";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

export type OpenSpecDiscoverySeverity = "warning" | "error";

export type OpenSpecDiscoveryDiagnostic = {
	severity: OpenSpecDiscoverySeverity;
	code: string;
	message: string;
	source?: {
		path: string;
	};
	details?: Record<string, unknown>;
};

export type OpenSpecCompatibility = {
	openspec?: string;
	protocols?: Record<string, string>;
};

export type OpenSpecAdapterImplementation = {
	id?: string;
	kind: string;
	export: string;
	capability?: string;
	module?: string;
	from?: string;
	importPath: string;
	packageName: string;
	packageRoot: string;
	packageVersion?: string;
};

export type DiscoveredOpenSpecPackage = {
	name: string;
	version?: string;
	private?: boolean;
	root: string;
	realpath: string;
	packageJsonPath: string;
	manifestVersion: 1;
	documentPaths: string[];
	adapterImplementations: OpenSpecAdapterImplementation[];
	compatibility?: OpenSpecCompatibility;
	diagnostics: OpenSpecDiscoveryDiagnostic[];
};

export type OpenSpecPackageRegistryIndex = {
	packages: DiscoveredOpenSpecPackage[];
	documents: Array<{
		packageName: string;
		packageVersion?: string;
		path: string;
	}>;
	adapterImplementations: OpenSpecAdapterImplementation[];
	diagnostics: OpenSpecDiscoveryDiagnostic[];
};

export type DiscoverOpenSpecPackagesInput = {
	root: string;
	strict?: boolean;
	currentOpenSpecVersion?: string;
	includeRootPackage?: boolean;
};

type PackageRef = {
	root: string;
	realpath: string;
	packageJsonPath: string;
};

const SUPPORTED_MANIFEST_VERSION = 1;
const LEGACY_DOCUMENT_SECTIONS = [
	"models",
	"patterns",
	"graphs",
	"capabilities",
	"providers",
	"provider",
	"adapters",
] as const;

export function discoverOpenSpecPackages(
	input: DiscoverOpenSpecPackagesInput,
): OpenSpecPackageRegistryIndex {
	const root = resolve(input.root);
	const diagnostics: OpenSpecDiscoveryDiagnostic[] = [];
	const packages: DiscoveredOpenSpecPackage[] = [];

	for (const packageRef of collectPackageRefs(root, input.includeRootPackage)) {
		const discovered = readOpenSpecPackage(packageRef, input);
		if (!discovered) continue;
		packages.push(discovered);
		diagnostics.push(...discovered.diagnostics);
	}

	const adapterImplementations = packages.flatMap(
		(pkg) => pkg.adapterImplementations,
	);
	diagnostics.push(...duplicateAdapterIdDiagnostics(adapterImplementations));

	return {
		packages,
		documents: packages.flatMap((pkg) =>
			pkg.documentPaths.map((path) => ({
				packageName: pkg.name,
				...(pkg.version ? { packageVersion: pkg.version } : {}),
				path,
			})),
		),
		adapterImplementations,
		diagnostics,
	};
}

function collectPackageRefs(
	root: string,
	includeRootPackage: boolean | undefined,
): PackageRef[] {
	const refs: PackageRef[] = [];
	const seenRealpaths = new Set<string>();
	const seenNodeModules = new Set<string>();

	const addPackageRoot = (packageRoot: string): boolean => {
		const packageJsonPath = join(packageRoot, "package.json");
		if (!existsSync(packageJsonPath)) return false;
		let realpath: string;
		try {
			realpath = realpathSync(packageRoot);
		} catch {
			return false;
		}
		if (seenRealpaths.has(realpath)) return false;
		seenRealpaths.add(realpath);
		refs.push({ root: packageRoot, realpath, packageJsonPath });
		return true;
	};

	if (includeRootPackage) addPackageRoot(root);
	for (const workspaceRoot of collectWorkspacePackageRoots(root)) {
		addPackageRoot(workspaceRoot);
	}
	walkNodeModules(join(root, "node_modules"), addPackageRoot, seenNodeModules);
	return refs;
}

function collectWorkspacePackageRoots(root: string): string[] {
	const packageJsonPath = join(root, "package.json");
	if (!existsSync(packageJsonPath)) return [];

	let pkg: Record<string, unknown>;
	try {
		pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<
			string,
			unknown
		>;
	} catch {
		return [];
	}

	const workspaces = workspacePatterns(pkg.workspaces);
	if (workspaces.length === 0) return [];

	const roots = new Set<string>();
	for (const pattern of workspaces) {
		for (const workspaceRoot of expandWorkspacePattern(root, pattern)) {
			roots.add(workspaceRoot);
		}
	}
	return [...roots].sort();
}

function workspacePatterns(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === "string");
	}
	const packages = record(value)?.packages;
	return Array.isArray(packages)
		? packages.filter((item): item is string => typeof item === "string")
		: [];
}

function expandWorkspacePattern(root: string, pattern: string): string[] {
	const normalized = pattern.replaceAll("\\", "/").replace(/\/+$/, "");
	const globIndex = normalized.search(/[*[{]/);
	const staticPrefix =
		globIndex < 0
			? normalized
			: normalized.slice(0, globIndex).replace(/\/+$/, "");
	const base = resolve(root, staticPrefix || ".");
	if (!existsSync(base)) return [];

	if (!normalized.includes("**") && normalized.endsWith("/*")) {
		return childPackageRoots(base);
	}

	if (!normalized.includes("*") && !normalized.includes("{")) {
		return existsSync(join(base, "package.json")) ? [base] : [];
	}

	return recursivePackageRoots(base);
}

function childPackageRoots(directory: string): string[] {
	try {
		return readdirSync(directory, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
			.map((entry) => join(directory, entry.name))
			.filter((child) => existsSync(join(child, "package.json")));
	} catch {
		return [];
	}
}

function recursivePackageRoots(directory: string): string[] {
	const roots: string[] = [];
	walkWorkspaceDirectory(directory, roots);
	return roots;
}

function walkWorkspaceDirectory(directory: string, roots: string[]) {
	if (existsSync(join(directory, "package.json"))) {
		roots.push(directory);
	}

	let entries: Dirent[];
	try {
		entries = readdirSync(directory, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		if (
			entry.name === ".git" ||
			entry.name === "node_modules" ||
			entry.name === "dist"
		) {
			continue;
		}
		if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
		walkWorkspaceDirectory(join(directory, entry.name), roots);
	}
}

function walkNodeModules(
	nodeModules: string,
	addPackageRoot: (packageRoot: string) => boolean,
	seenNodeModules: Set<string>,
) {
	if (!existsSync(nodeModules)) return;
	try {
		const realpath = realpathSync(nodeModules);
		if (seenNodeModules.has(realpath)) return;
		seenNodeModules.add(realpath);
	} catch {
		return;
	}
	let entries: Dirent[];
	try {
		entries = readdirSync(nodeModules, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		if (entry.name === ".bin") continue;
		if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

		if (entry.name.startsWith("@")) {
			const scopeDir = join(nodeModules, entry.name);
			let scopedEntries: Dirent[];
			try {
				scopedEntries = readdirSync(scopeDir, { withFileTypes: true });
			} catch {
				continue;
			}
			for (const scopedEntry of scopedEntries) {
				if (!scopedEntry.isDirectory() && !scopedEntry.isSymbolicLink()) {
					continue;
				}
				const packageRoot = join(scopeDir, scopedEntry.name);
				if (addPackageRoot(packageRoot)) {
					walkNodeModules(
						join(packageRoot, "node_modules"),
						addPackageRoot,
						seenNodeModules,
					);
				}
			}
			continue;
		}

		const packageRoot = join(nodeModules, entry.name);
		if (addPackageRoot(packageRoot)) {
			walkNodeModules(
				join(packageRoot, "node_modules"),
				addPackageRoot,
				seenNodeModules,
			);
		}
	}
}

function readOpenSpecPackage(
	packageRef: PackageRef,
	input: DiscoverOpenSpecPackagesInput,
): DiscoveredOpenSpecPackage | undefined {
	let pkg: Record<string, unknown>;
	try {
		pkg = JSON.parse(
			readFileSync(packageRef.packageJsonPath, "utf8"),
		) as Record<string, unknown>;
	} catch (cause) {
		return {
			name: packageRef.root,
			root: packageRef.root,
			realpath: packageRef.realpath,
			packageJsonPath: packageRef.packageJsonPath,
			manifestVersion: SUPPORTED_MANIFEST_VERSION,
			documentPaths: [],
			adapterImplementations: [],
			diagnostics: [
				diagnostic("error", "openspec.packageJson.invalid", {
					message: `Package manifest '${packageRef.packageJsonPath}' could not be parsed.`,
					path: packageRef.packageJsonPath,
					details: {
						cause: cause instanceof Error ? cause.message : String(cause),
					},
				}),
			],
		};
	}

	const openspec = record(pkg.openspec);
	if (!openspec) return undefined;

	const name = typeof pkg.name === "string" ? pkg.name : packageRef.root;
	const version = typeof pkg.version === "string" ? pkg.version : undefined;
	const isPrivate = pkg.private === true;
	const diagnostics: OpenSpecDiscoveryDiagnostic[] = [];
	const manifestVersion = normalizeManifestVersion(
		openspec.version,
		packageRef.packageJsonPath,
		diagnostics,
	);
	if (manifestVersion === undefined) {
		return {
			name,
			...(version ? { version } : {}),
			...(isPrivate ? { private: true } : {}),
			root: packageRef.root,
			realpath: packageRef.realpath,
			packageJsonPath: packageRef.packageJsonPath,
			manifestVersion: SUPPORTED_MANIFEST_VERSION,
			documentPaths: [],
			adapterImplementations: [],
			diagnostics,
		};
	}

	const compatibility = normalizeCompatibility(openspec.compatibility);
	diagnostics.push(
		...compatibilityDiagnostics({
			packageName: name,
			packageJsonPath: packageRef.packageJsonPath,
			compatibility,
			isPrivate,
			strict: input.strict ?? false,
			currentOpenSpecVersion: input.currentOpenSpecVersion,
		}),
	);

	const documentPaths = normalizeDocumentPaths({
		openspec,
		packageRoot: packageRef.root,
		packageJsonPath: packageRef.packageJsonPath,
		diagnostics,
	});
	const adapterImplementations = normalizeAdapterImplementations({
		openspec,
		packageName: name,
		packageVersion: version,
		packageRoot: packageRef.root,
		packageJsonPath: packageRef.packageJsonPath,
		diagnostics,
	});

	return {
		name,
		...(version ? { version } : {}),
		...(isPrivate ? { private: true } : {}),
		root: packageRef.root,
		realpath: packageRef.realpath,
		packageJsonPath: packageRef.packageJsonPath,
		manifestVersion,
		documentPaths,
		adapterImplementations,
		...(compatibility ? { compatibility } : {}),
		diagnostics,
	};
}

function normalizeManifestVersion(
	value: unknown,
	packageJsonPath: string,
	diagnostics: OpenSpecDiscoveryDiagnostic[],
): 1 | undefined {
	if (value === undefined) return SUPPORTED_MANIFEST_VERSION;
	if (value === SUPPORTED_MANIFEST_VERSION) return SUPPORTED_MANIFEST_VERSION;
	diagnostics.push(
		diagnostic("error", "openspec.manifest.version.unsupported", {
			message: `OpenSpec manifest '${packageJsonPath}' declares unsupported openspec.version '${String(value)}'.`,
			path: packageJsonPath,
			details: { supported: [SUPPORTED_MANIFEST_VERSION], actual: value },
		}),
	);
	return undefined;
}

function normalizeDocumentPaths(input: {
	openspec: Record<string, unknown>;
	packageRoot: string;
	packageJsonPath: string;
	diagnostics: OpenSpecDiscoveryDiagnostic[];
}): string[] {
	const paths = new Set<string>();
	addDocumentPaths(paths, input.openspec.documents, input);
	for (const section of LEGACY_DOCUMENT_SECTIONS) {
		addDocumentPaths(paths, record(input.openspec[section])?.documents, input);
	}
	return [...paths].sort();
}

function addDocumentPaths(
	paths: Set<string>,
	value: unknown,
	input: {
		packageRoot: string;
		packageJsonPath: string;
		diagnostics: OpenSpecDiscoveryDiagnostic[];
	},
) {
	if (value === undefined) return;
	if (!Array.isArray(value)) {
		input.diagnostics.push(
			diagnostic("error", "openspec.documents.invalid", {
				message: `OpenSpec documents in '${input.packageJsonPath}' must be an array of strings.`,
				path: input.packageJsonPath,
			}),
		);
		return;
	}
	for (const item of value) {
		if (typeof item !== "string") {
			input.diagnostics.push(
				diagnostic("error", "openspec.document.invalid", {
					message: `OpenSpec document entries in '${input.packageJsonPath}' must be strings.`,
					path: input.packageJsonPath,
					details: { entry: item },
				}),
			);
			continue;
		}
		const path = resolve(input.packageRoot, item);
		if (!existsSync(path)) {
			input.diagnostics.push(
				diagnostic("error", "openspec.document.missing", {
					message: `OpenSpec document '${item}' declared by '${input.packageJsonPath}' does not exist.`,
					path: input.packageJsonPath,
					details: { document: item },
				}),
			);
			continue;
		}
		paths.add(path);
	}
}

function normalizeAdapterImplementations(input: {
	openspec: Record<string, unknown>;
	packageName: string;
	packageVersion?: string;
	packageRoot: string;
	packageJsonPath: string;
	diagnostics: OpenSpecDiscoveryDiagnostic[];
}): OpenSpecAdapterImplementation[] {
	const adapters = record(input.openspec.adapters);
	const implementations = adapters?.implementations;
	if (implementations === undefined) return [];
	if (!Array.isArray(implementations)) {
		input.diagnostics.push(
			diagnostic("error", "openspec.adapters.implementations.invalid", {
				message: `Adapter implementations in '${input.packageJsonPath}' must be an array.`,
				path: input.packageJsonPath,
			}),
		);
		return [];
	}

	const result: OpenSpecAdapterImplementation[] = [];
	for (const entry of implementations) {
		const item = record(entry);
		if (!item) {
			input.diagnostics.push(adapterEntryDiagnostic(input, entry));
			continue;
		}
		const kind = item.kind;
		const id = item.id;
		const exported = item.export;
		const capability = item.capability;
		const modulePath = item.module;
		const from = item.from;
		if (
			typeof kind !== "string" ||
			(id !== undefined && typeof id !== "string") ||
			typeof exported !== "string" ||
			(capability !== undefined && typeof capability !== "string") ||
			(modulePath !== undefined && typeof modulePath !== "string") ||
			(from !== undefined && typeof from !== "string")
		) {
			input.diagnostics.push(adapterEntryDiagnostic(input, entry));
			continue;
		}
		if (modulePath !== undefined && !modulePath.startsWith(".")) {
			input.diagnostics.push(
				diagnostic("error", "openspec.adapter.module.invalid", {
					message: `Adapter implementation module '${modulePath}' in '${input.packageJsonPath}' must be package-relative.`,
					path: input.packageJsonPath,
					details: { kind, module: modulePath },
				}),
			);
			continue;
		}
		if (modulePath !== undefined && from !== undefined) {
			input.diagnostics.push(
				diagnostic("error", "openspec.adapter.import.ambiguous", {
					message: `Adapter implementation '${kind}' in '${input.packageJsonPath}' must not declare both module and from.`,
					path: input.packageJsonPath,
					details: { kind, module: modulePath, from },
				}),
			);
			continue;
		}
		const importPath = modulePath
			? resolve(input.packageRoot, modulePath)
			: (from ?? input.packageName);
		if (modulePath && !existsSync(importPath)) {
			input.diagnostics.push(
				diagnostic("error", "openspec.adapter.module.missing", {
					message: `Adapter implementation module '${modulePath}' declared by '${input.packageJsonPath}' does not exist.`,
					path: input.packageJsonPath,
					details: { kind, module: modulePath },
				}),
			);
			continue;
		}
		result.push({
			...(id !== undefined ? { id } : {}),
			kind,
			export: exported,
			...(typeof capability === "string" ? { capability } : {}),
			...(typeof modulePath === "string" ? { module: modulePath } : {}),
			...(typeof from === "string" ? { from } : {}),
			importPath,
			packageName: input.packageName,
			packageRoot: input.packageRoot,
			...(input.packageVersion ? { packageVersion: input.packageVersion } : {}),
		});
	}
	return result;
}

function adapterEntryDiagnostic(
	input: {
		packageJsonPath: string;
	},
	entry: unknown,
): OpenSpecDiscoveryDiagnostic {
	return diagnostic("error", "openspec.adapter.implementation.invalid", {
		message: `Adapter implementation entries in '${input.packageJsonPath}' must declare string kind and export fields.`,
		path: input.packageJsonPath,
		details: { entry },
	});
}

function duplicateAdapterIdDiagnostics(
	implementations: OpenSpecAdapterImplementation[],
): OpenSpecDiscoveryDiagnostic[] {
	const byId = new Map<string, OpenSpecAdapterImplementation[]>();
	for (const implementation of implementations) {
		if (!implementation.id) continue;
		const entries = byId.get(implementation.id) ?? [];
		entries.push(implementation);
		byId.set(implementation.id, entries);
	}
	return [...byId.entries()].flatMap(([id, entries]) => {
		if (entries.length < 2) return [];
		return [
			diagnostic("error", "openspec.adapter.id.duplicate", {
				message: `Multiple OpenSpec packages declare adapter implementation id '${id}'.`,
				details: {
					id,
					packages: entries.map((entry) => entry.packageName),
				},
			}),
		];
	});
}

function normalizeCompatibility(
	value: unknown,
): OpenSpecCompatibility | undefined {
	const input = record(value);
	if (!input) return undefined;
	const protocols = record(input.protocols);
	return {
		...(typeof input.openspec === "string" ? { openspec: input.openspec } : {}),
		...(protocols ? { protocols: stringRecord(protocols) } : {}),
	};
}

function compatibilityDiagnostics(input: {
	packageName: string;
	packageJsonPath: string;
	compatibility: OpenSpecCompatibility | undefined;
	isPrivate: boolean;
	strict: boolean;
	currentOpenSpecVersion?: string;
}): OpenSpecDiscoveryDiagnostic[] {
	if (!input.compatibility) {
		if (input.isPrivate) return [];
		return [
			diagnostic("warning", "openspec.compatibility.missing", {
				message: `OpenSpec package '${input.packageName}' does not declare openspec.compatibility.`,
				path: input.packageJsonPath,
			}),
		];
	}
	if (
		input.currentOpenSpecVersion &&
		input.compatibility.openspec &&
		!satisfiesSimpleRange(
			input.currentOpenSpecVersion,
			input.compatibility.openspec,
		)
	) {
		return [
			diagnostic(
				input.strict ? "error" : "warning",
				"openspec.compatibility.openspec.unsatisfied",
				{
					message: `OpenSpec package '${input.packageName}' requires OpenSpec '${input.compatibility.openspec}', but current version is '${input.currentOpenSpecVersion}'.`,
					path: input.packageJsonPath,
					details: {
						required: input.compatibility.openspec,
						current: input.currentOpenSpecVersion,
					},
				},
			),
		];
	}
	return [];
}

function satisfiesSimpleRange(version: string, range: string): boolean {
	if (range === "*" || range === version) return true;
	if (range.startsWith("^")) {
		const base = parseVersion(range.slice(1));
		const actual = parseVersion(version);
		if (!base || !actual) return false;
		return actual.major === base.major && compareVersion(actual, base) >= 0;
	}
	return false;
}

function parseVersion(value: string):
	| {
			major: number;
			minor: number;
			patch: number;
	  }
	| undefined {
	const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value);
	if (!match) return undefined;
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
	};
}

function compareVersion(
	left: { major: number; minor: number; patch: number },
	right: { major: number; minor: number; patch: number },
): number {
	return (
		left.major - right.major ||
		left.minor - right.minor ||
		left.patch - right.patch
	);
}

function record(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function stringRecord(value: Record<string, unknown>): Record<string, string> {
	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		),
	);
}

function diagnostic(
	severity: OpenSpecDiscoverySeverity,
	code: string,
	input: {
		message: string;
		path?: string;
		details?: Record<string, unknown>;
	},
): OpenSpecDiscoveryDiagnostic {
	return {
		severity,
		code,
		message: input.message,
		...(input.path ? { source: { path: input.path } } : {}),
		...(input.details ? { details: input.details } : {}),
	};
}
