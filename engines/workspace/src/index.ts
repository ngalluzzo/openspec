import { readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { createExpressoRuntime } from "@gooi/expresso";
import { createActionExecutorAdapter } from "@openspec/action-executor";
import {
	adaptersByCapability,
	discoverAdapterRegistry,
} from "@openspec/adapter-registry";
import type {
	CompileDocumentInput,
	JsonObject,
	GraphRuntime,
} from "@openspec/compiler";
import { createCompiler, createMemoryGraphProvider } from "@openspec/compiler";
import { createFlowExecutorAdapter } from "@openspec/flow-executor";
import { localFsStorageReader, localFsStorageWriter } from "@openspec/materializer";
import { discoverOpenSpecPackages } from "@openspec/package-discovery";
import { parse } from "yaml";
import { implementWorkspaceBuildAdapter } from "./sdk/workspace-build.generated.ts";
import { implementWorkspaceSyncAdapter } from "./sdk/workspace-sync.generated.ts";
import {
	createWorkspaceHostDispatchesMethods,
	WorkspaceHostDispatchesFlowId,
} from "./sdk/workspace-host-dispatches.generated.ts";
import type {
	BuildReport,
	BuildRequest,
	SyncReport,
	SyncRequest,
} from "./sdk/workspace-types.generated.ts";

export type { BuildReport, BuildRequest, SyncReport, SyncRequest };

type WorkspaceDocumentDiagnostic = {
	severity: "warning" | "error";
	code: string;
	message: string;
	source?: {
		path: string;
	};
	details?: Record<string, unknown>;
};

type ModelValueParserAdapter = {
	parse(input: {
		declarations: unknown;
		model: string;
		value: unknown;
	}): Promise<{
		value: unknown;
		diagnostics?: Array<{ code: string; message: string; severity?: string }>;
	}>;
};

const MODEL_VALUE_PARSER_CAPABILITY =
	"capability.capability:model.value.parser";

export async function discoverWorkspaceDocuments(input: {
	root: string;
}): Promise<{
	documents: CompileDocumentInput[];
	diagnostics: WorkspaceDocumentDiagnostic[];
}> {
	const root = resolve(input.root);
	const registry = discoverOpenSpecPackages({
		root,
		includeRootPackage: true,
	});
	const documentLocations = registry.documents.map((document) =>
		relativeLocation(root, document.path),
	);
	const readReport = await localFsStorageReader.read({
		root,
		patterns: [...documentLocations, "**/*.openspec.yml"],
	});
	const decoded = decodeOpenSpecDocuments(readReport.files, root);
	return {
		documents: decoded.documents,
		diagnostics: [
			...registry.diagnostics,
			...storageReadDiagnostics(readReport.diagnostics),
			...decoded.diagnostics,
		],
	};
}

export const workspaceBuildAdapter = implementWorkspaceBuildAdapter({
	async run(input): Promise<BuildReport> {
		const root = resolve(input.root);
		const environment = input.environment ?? "default";

		const { documents, diagnostics: discoveryDiagnostics } =
			await discoverWorkspaceDocuments({ root });
		const discoveryErrors = discoveryDiagnostics.filter(
			(d) => d.severity === "error",
		);
		if (discoveryErrors.length > 0) {
			throw new Error(
				`document discovery failed:\n${formatDiagnostics(discoveryErrors)}`,
			);
		}

		const compiler = createCompiler({
			capabilities: {
				expressionEvaluator: createExpressoRuntime(),
				graphProvider: createMemoryGraphProvider(),
			},
		});

		const result = await compiler.compile({ documents });
		const compileErrors = result.diagnostics.filter(
			(d) => d.severity === "error",
		);
		if (compileErrors.length > 0) {
			throw new Error(
				`compilation failed:\n${formatDiagnostics(compileErrors)}`,
			);
		}

		const adapterRegistry = await discoverAdapterRegistry(root);
		const actionExecutor = createActionExecutorAdapter({
			adapters: adapterRegistry.adapters,
		});

		const methods = createWorkspaceHostDispatchesMethods({
			compilerCompile: async () => ({
				graph: result.graph,
				runtime: result.runtime,
				diagnostics: [],
			}),
			actionExecutorDefaultExecute: (input) =>
				actionExecutor.execute(
					input as {
						root: string;
						environment?: string;
						graph: unknown;
						runtime?: unknown;
					},
				),
			materializerLocalFsWrite: (input) =>
				localFsStorageWriter.write(
					input as Parameters<typeof localFsStorageWriter.write>[0],
				),
		});

		const flowResult = await createFlowExecutorAdapter({
			runtime: result.runtime,
			methods,
		}).execute({
			flow: WorkspaceHostDispatchesFlowId,
			inputs: {
				root,
				...(input.policy !== undefined ? { policy: input.policy } : {}),
				environment,
			},
		});

		if (flowResult.diagnostics.length > 0) {
			throw new Error(
				`workspace flow failed:\n${formatDiagnostics(flowResult.diagnostics)}`,
			);
		}

		return await parseBuildReport(
			flowResult.outputs,
			result.runtime,
			adapterRegistry,
		);
	},
});

export function runWorkspaceBuild(input: BuildRequest): Promise<BuildReport> {
	return workspaceBuildAdapter.run(input);
}

export const workspaceSyncAdapter = implementWorkspaceSyncAdapter({
	async run(input): Promise<SyncReport> {
		const root = resolve(input.root);

		const { documents, diagnostics: discoveryDiagnostics } =
			await discoverWorkspaceDocuments({ root });
		const discoveryErrors = discoveryDiagnostics.filter((d) => d.severity === "error");
		if (discoveryErrors.length > 0) {
			throw new Error(`document discovery failed:\n${formatDiagnostics(discoveryErrors)}`);
		}

		const compiler = createCompiler({
			capabilities: {
				expressionEvaluator: createExpressoRuntime(),
				graphProvider: createMemoryGraphProvider(),
			},
		});

		const result = await compiler.compile({ documents });
		const compileErrors = result.diagnostics.filter(
			(d) => d.severity === "error",
		);
		if (compileErrors.length > 0) {
			throw new Error(
				`compilation failed:\n${formatDiagnostics(compileErrors)}`,
			);
		}

		const adapterRegistry = await discoverAdapterRegistry(root);
		const actionExecutor = createActionExecutorAdapter({
			adapters: adapterRegistry.adapters,
		});

		const syncResult = await actionExecutor.sync({
			root,
			graph: result.graph,
			runtime: result.runtime,
			preview: input.preview ?? false,
			forceBreaking: input.forceBreaking ?? false,
			yes: input.yes ?? false,
			...(input.target !== undefined ? { target: input.target } : {}),
		});

		return {
			preview: syncResult.preview,
			summaries: syncResult.summaries,
			diagnostics: syncResult.diagnostics,
		};
	},
});

export function runWorkspaceSync(input: SyncRequest): Promise<SyncReport> {
	return workspaceSyncAdapter.run(input);
}

async function parseBuildReport(
	value: unknown,
	runtime: GraphRuntime,
	adapterRegistry: Awaited<ReturnType<typeof discoverAdapterRegistry>>,
): Promise<BuildReport> {
	const parser = resolveModelValueParser(adapterRegistry);
	if (!parser) return value as BuildReport;

	const declarations = runtime.hasSelector("model.declarationsForOwner")
		? runtime.select("model.declarationsForOwner", {
				owner: "provider.provider:workspace",
			})
		: [];
	const parsed = await parser.parse({
		declarations,
		model: "model:BuildReport",
		value,
	});
	if (parsed.diagnostics?.some((d) => d.severity === "error")) {
		const lines = parsed.diagnostics
			.map((d) => `- ${d.code}: ${d.message}`)
			.join("\n");
		throw new Error(`invalid build report:\n${lines}`);
	}
	return parsed.value as BuildReport;
}

function resolveModelValueParser(
	adapterRegistry: Awaited<ReturnType<typeof discoverAdapterRegistry>>,
): ModelValueParserAdapter | undefined {
	const parsers = adaptersByCapability<ModelValueParserAdapter>(
		adapterRegistry,
		MODEL_VALUE_PARSER_CAPABILITY,
	).filter((entry) => hasParseMethod(entry.adapter));
	if (parsers.length === 1) return parsers[0]?.adapter;
	if (parsers.length > 1) {
		throw new Error(
			`model value parser adapter is ambiguous: ${parsers
				.map((entry) => entry.id ?? entry.kind)
				.join(", ")}`,
		);
	}
	return undefined;
}

function hasParseMethod(value: unknown): value is ModelValueParserAdapter {
	return typeof value === "object" && value !== null && "parse" in value;
}

function decodeOpenSpecDocuments(
	files: readonly { location: string; content: string }[],
	root: string,
): {
	documents: CompileDocumentInput[];
	diagnostics: WorkspaceDocumentDiagnostic[];
} {
	const documents: CompileDocumentInput[] = [];
	const diagnostics: WorkspaceDocumentDiagnostic[] = [];

	for (const file of files) {
		let decoded: unknown;
		try {
			decoded = parse(file.content);
		} catch (cause) {
			diagnostics.push({
				severity: "error",
				code: "openspec.document.parse.failed",
				message: `Failed to parse '${file.location}'.`,
				source: { path: file.location },
				details: { cause: String(cause) },
			});
			continue;
		}

		const decodedRecord = record(decoded);
		if (decodedRecord?.kind === "protocol-declaration") {
			documents.push({
				...(typeof decodedRecord.id === "string"
					? { id: decodedRecord.id }
					: { id: file.location }),
				protocol: "openspec.protocol.v1",
				document: decoded,
				source: { path: file.location },
			});
			continue;
		}

		const entries = decodedRecord?.documents;
		if (!Array.isArray(entries)) {
			diagnostics.push({
				severity: "error",
				code: "openspec.documents.invalid",
				message: `OpenSpec file '${file.location}' must contain a documents array.`,
				source: { path: file.location },
			});
			continue;
		}

		for (const [index, entry] of entries.entries()) {
			const document = record(entry);
			if (!document || typeof document.protocol !== "string") {
				diagnostics.push({
					severity: "error",
					code: "openspec.document.invalid",
					message: `Document ${index} in '${file.location}' must declare a protocol.`,
					source: { path: file.location },
				});
				continue;
			}
			const metadata = record(document.metadata) as JsonObject | undefined;
			const hydrated = hydrateDocumentSource({
				root,
				wrapperLocation: file.location,
				document: document.document,
				diagnostics,
			});
			documents.push({
				...(typeof document.id === "string" ? { id: document.id } : {}),
				protocol: document.protocol,
				document: hydrated,
				source: { path: file.location },
				...(metadata ? { metadata } : {}),
			});
		}
	}

	return { documents, diagnostics };
}

function hydrateDocumentSource(input: {
	root: string;
	wrapperLocation: string;
	document: unknown;
	diagnostics: WorkspaceDocumentDiagnostic[];
}): unknown {
	const document = record(input.document);
	if (!document || "snapshot" in document) return input.document;

	const source = record(document.source);
	if (!source) return input.document;
	const sourcePath = source.path;
	if (typeof sourcePath !== "string" || sourcePath.length === 0) {
		return input.document;
	}

	const mediaType =
		typeof source.mediaType === "string" ? source.mediaType : undefined;
	const normalizedMediaType = mediaType?.split(";")[0]?.trim().toLowerCase();
	const wrapperDir = dirname(input.wrapperLocation);
	const absolutePath = resolve(input.root, wrapperDir, sourcePath);
	const relativePath = relativeLocation(input.root, absolutePath);
	const workspaceRelativePath = relative(input.root, absolutePath);
	const isJson =
		normalizedMediaType === undefined
			? extname(sourcePath).toLowerCase() === ".json"
			: normalizedMediaType === "application/json";

	if (!isJson) {
		input.diagnostics.push({
			severity: "error",
			code: "openspec.document.source.unsupportedMediaType",
			message: `Unsupported source media type for '${sourcePath}'. Only JSON sources are supported.`,
			source: { path: input.wrapperLocation },
			details: {
				sourcePath,
				...(mediaType ? { mediaType } : {}),
			},
		});
		return input.document;
	}

	if (
		workspaceRelativePath === ".." ||
		workspaceRelativePath.startsWith("../") ||
		isAbsolute(workspaceRelativePath)
	) {
		input.diagnostics.push({
			severity: "error",
			code: "openspec.document.source.outsideWorkspace",
			message: `Source '${sourcePath}' for '${input.wrapperLocation}' resolves outside the workspace root.`,
			source: { path: input.wrapperLocation },
			details: {
				sourcePath,
				resolvedPath: absolutePath,
			},
		});
		return input.document;
	}

	let content: string;
	try {
		content = readFileSync(absolutePath, "utf8");
	} catch (cause) {
		input.diagnostics.push({
			severity: "error",
			code: "openspec.document.source.missing",
			message: `Failed to read source '${sourcePath}' for '${input.wrapperLocation}'.`,
			source: { path: input.wrapperLocation },
			details: {
				sourcePath,
				resolvedPath: relativePath,
				cause: String(cause),
			},
		});
		return input.document;
	}

	try {
		return {
			...document,
			snapshot: JSON.parse(content),
		};
	} catch (cause) {
		input.diagnostics.push({
			severity: "error",
			code: "openspec.document.source.parse.failed",
			message: `Failed to parse JSON source '${sourcePath}' for '${input.wrapperLocation}'.`,
			source: { path: input.wrapperLocation },
			details: {
				sourcePath,
				resolvedPath: relativePath,
				cause: String(cause),
			},
		});
		return input.document;
	}
}

function storageReadDiagnostics(
	diagnostics: readonly unknown[],
): WorkspaceDocumentDiagnostic[] {
	return diagnostics.map((diagnostic) => {
		const value = record(diagnostic) ?? {};
		const source = record(value.source);
		const details = record(value.details);
		return {
			severity: severity(value?.severity),
			code: typeof value?.code === "string" ? value.code : "storage.read.failed",
			message:
				typeof value?.message === "string"
					? value.message
					: "Storage read failed.",
			...(source && typeof source.path === "string"
				? { source: { path: source.path } }
				: {}),
			...(details ? { details } : {}),
		};
	});
}

function relativeLocation(root: string, path: string): string {
	return path.startsWith(root)
		? path.slice(root.length).replace(/^\/+/, "")
		: path;
}

function record(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function severity(value: unknown): "warning" | "error" {
	return value === "warning" ? "warning" : "error";
}

function formatDiagnostics(
	diagnostics: readonly { code: string; message: string }[],
): string {
	return diagnostics.map((d) => `- ${d.code}: ${d.message}`).join("\n");
}
