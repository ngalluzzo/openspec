import { pathToFileURL } from "node:url";
import {
	discoverOpenSpecPackages,
	type OpenSpecAdapterImplementation,
	type OpenSpecDiscoveryDiagnostic,
	type OpenSpecPackageRegistryIndex,
} from "@openspec/package-discovery";
import type { ProjectionExecuteAdapter } from "@openspec/projection-execute-capability";

export type DiscoveredAdapter = {
	id?: string;
	kind: string;
	capability?: string;
	adapter: unknown;
	implementation: OpenSpecAdapterImplementation;
};

export type AdapterRegistry = {
	adapters: DiscoveredAdapter[];
	packageIndex: OpenSpecPackageRegistryIndex;
	diagnostics: OpenSpecDiscoveryDiagnostic[];
};

export type DiscoveredProjectionAdapter = DiscoveredAdapter & {
	adapter: ProjectionExecuteAdapter;
};

export type ProjectionAdapterRegistry = AdapterRegistry & {
	adapters: DiscoveredProjectionAdapter[];
};

/**
 * Scans OpenSpec packages discoverable from `root`, dynamically imports
 * declared implementations, and returns the resolved adapters plus
 * registry diagnostics.
 */
export async function discoverAdapterRegistry(
	root: string,
): Promise<AdapterRegistry> {
	const packageIndex = discoverOpenSpecPackages({ root });
	const diagnostics = [...packageIndex.diagnostics];
	const adapters: DiscoveredAdapter[] = [];

	for (const implementation of packageIndex.adapterImplementations) {
		let mod: Record<string, unknown>;
		try {
			mod = (await import(importSpecifier(implementation))) as Record<
				string,
				unknown
			>;
		} catch (cause) {
			diagnostics.push({
				severity: "error",
				code: "openspec.adapter.import.failed",
				message: `Adapter implementation '${implementation.kind}' from package '${implementation.packageName}' could not be imported.`,
				details: {
					kind: implementation.kind,
					packageName: implementation.packageName,
					importPath: implementation.importPath,
					cause: cause instanceof Error ? cause.message : String(cause),
				},
			});
			continue;
		}
		const adapter = mod[implementation.export];
		if (!isAdapterExport(adapter)) {
			diagnostics.push({
				severity: "error",
				code: "openspec.adapter.export.invalid",
				message: `Adapter implementation '${implementation.kind}' from package '${implementation.packageName}' does not export an adapter object named '${implementation.export}'.`,
				details: {
					kind: implementation.kind,
					packageName: implementation.packageName,
					export: implementation.export,
				},
			});
			continue;
		}
		adapters.push({
			...(implementation.id ? { id: implementation.id } : {}),
			kind: implementation.kind,
			...(implementation.capability
				? { capability: implementation.capability }
				: {}),
			adapter,
			implementation,
		});
	}

	return { adapters, packageIndex, diagnostics };
}

export async function discoverProjectionAdapterRegistry(
	root: string,
): Promise<ProjectionAdapterRegistry> {
	const registry = await discoverAdapterRegistry(root);
	return {
		...registry,
		adapters: projectionAdaptersFromRegistry(registry),
	};
}

export function projectionAdaptersFromRegistry(
	registry: AdapterRegistry,
): DiscoveredProjectionAdapter[] {
	return registry.adapters.flatMap((entry) =>
		hasProjectMethod(entry.adapter)
			? [{ ...entry, adapter: entry.adapter as ProjectionExecuteAdapter }]
			: [],
	);
}

export function adaptersByCapability<TAdapter = unknown>(
	registry: AdapterRegistry,
	capability: string,
): Array<DiscoveredAdapter & { adapter: TAdapter }> {
	return registry.adapters.flatMap((entry) =>
		entry.capability === capability
			? [{ ...entry, adapter: entry.adapter as TAdapter }]
			: [],
	);
}

/**
 * Convenience API for hosts that only need resolved projection adapters.
 *
 * Adding a new adapter to the ecosystem requires only: install the package
 * and declare implementations in its package.json. No code changes needed.
 */
export async function discoverProjectionAdapters(
	root: string,
): Promise<DiscoveredAdapter[]> {
	const registry = await discoverProjectionAdapterRegistry(root);
	const errors = registry.diagnostics.filter(
		(diagnostic) => diagnostic.severity === "error",
	);
	if (errors.length > 0) {
		throw new Error(
			`adapter discovery failed:\n${errors.map(formatDiagnostic).join("\n")}`,
		);
	}
	return registry.adapters;
}

function hasProjectMethod(
	v: unknown,
): v is { project: (input: never) => unknown } {
	return typeof v === "object" && v !== null && "project" in v;
}

function isAdapterExport(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null;
}

function importSpecifier(
	implementation: OpenSpecAdapterImplementation,
): string {
	return implementation.module
		? pathToFileURL(implementation.importPath).href
		: implementation.importPath;
}

function formatDiagnostic(diagnostic: OpenSpecDiscoveryDiagnostic): string {
	return `- ${diagnostic.code}: ${diagnostic.message}`;
}
