import { implementActionExecutorAdapter } from "@openspec/action-executor-capability";
import type { ActionOutput, SyncActionSummary, SyncExecutorOutput } from "@openspec/action-executor-capability/types";
import type { ArtifactRenderRecipe } from "@openspec/artifact-render-capability/types";
import {
	createGraphRuntime,
	createGraphSelectorMaterializer,
	type SemanticGraph,
	type GraphRuntime,
	type GraphSelector,
} from "@openspec/compiler";
import type { ExternalSourceAdapter } from "@openspec/external-source-capability";
import type { PlatformApplyAdapter } from "@openspec/platform-apply-capability";
import type { PlatformSyncAdapter } from "@openspec/platform-sync-capability";
import type { PlatformMutation } from "@openspec/platform-sync-capability/types";
import type { ProjectionExecuteAdapter } from "@openspec/projection-execute-capability";
import type { ProjectionAction } from "@openspec/projection-execute-capability/types";

export type ActionExecutorOptions = {
	adapters: Array<{
		id?: string;
		kind: string;
		capability?: string;
		adapter: unknown;
	}>;
	externalSourceAdapters?: Array<{
		id: string;
		adapter: ExternalSourceAdapter;
	}>;
	platformSyncAdapters?: Array<{
		id: string;
		adapter: PlatformSyncAdapter;
	}>;
	platformApplyAdapters?: Array<{
		id: string;
		adapter: PlatformApplyAdapter;
	}>;
};

type ArtifactRefCriteria = {
	actionId?: string;
	artifactNodeId?: string;
	projectionKind?: string;
	owner?: string;
	capability?: string;
	target?: string;
	role?: string;
};

type ArtifactRef = { artifactRef: ArtifactRefCriteria };

type PlannedArtifact = {
	nodeId: string;
	id?: string;
	artifactPath?: string;
	artifactNodeId?: string;
	projectionKind?: string;
	owner?: string;
	capability?: string;
	target?: string;
	role?: string;
	projectionInputs?: unknown;
};

type ProjectionMaterializer = {
	nodeId: string;
	id?: string;
	adapter?: string;
	projectionKind?: string;
	selector?: string;
	paramsSource?: string;
	implementationMethod?: string;
	inputMode?: string;
	selectorResultField?: string;
};

type ProviderSelection = {
	nodeId: string;
	id?: string;
	request?: string;
	target?: string;
	role?: string;
	provider?: string;
	offering?: string;
	dialect?: string;
	adapter?: string;
	projectionKind?: string;
};

const TYPESCRIPT_RECIPE_APPLY_CAPABILITY =
	"capability.capability:typescript.recipe.apply";
const EXTERNAL_SOURCE_CAPABILITY = "capability.capability:external.source";
const PLATFORM_SYNC_CAPABILITY = "capability.capability:platform.sync";
const PLATFORM_APPLY_CAPABILITY = "capability.capability:platform.apply";

type PlannerResolutionDiagnostic = {
	code: string;
	message: string;
	severity: "error";
};

function isArtifactRef(value: unknown): value is ArtifactRef {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	if (typeof v.artifactRef !== "object" || v.artifactRef === null) return false;
	const ref = v.artifactRef as Record<string, unknown>;
	return [
		"actionId",
		"artifactNodeId",
		"projectionKind",
		"owner",
		"capability",
		"target",
		"role",
	].some((key) => typeof ref[key] === "string");
}

function resolveArtifactRefs(
	value: unknown,
	plannedArtifacts: PlannedArtifact[],
	diagnostics: PlannerResolutionDiagnostic[],
): unknown {
	if (isArtifactRef(value)) {
		const matches = plannedArtifacts.filter((artifact) =>
			artifactMatchesRef(artifact, value.artifactRef),
		);
		if (matches.length === 0) {
			diagnostics.push({
				code: "planner.artifactRef.unresolved",
				message: `No fulfilled planning action found for artifactRef ${JSON.stringify(value.artifactRef)}.`,
				severity: "error",
			});
			return value;
		}
		if (matches.length > 1) {
			diagnostics.push({
				code: "planner.artifactRef.ambiguous",
				message: `artifactRef ${JSON.stringify(value.artifactRef)} matched multiple planning actions: ${matches.map((match) => match.id ?? match.nodeId).join(", ")}.`,
				severity: "error",
			});
			return value;
		}
		return matches[0]?.artifactPath ?? value;
	}
	if (Array.isArray(value)) {
		return value.map((item) =>
			resolveArtifactRefs(item, plannedArtifacts, diagnostics),
		);
	}
	if (typeof value === "object" && value !== null) {
		const result: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			result[k] = resolveArtifactRefs(v, plannedArtifacts, diagnostics);
		}
		return result;
	}
	return value;
}

function artifactMatchesRef(
	artifact: PlannedArtifact,
	ref: ArtifactRefCriteria,
): boolean {
	if (!matchesString(ref.actionId, artifact.id, artifact.nodeId)) return false;
	if (!matchesString(ref.artifactNodeId, artifact.artifactNodeId)) return false;
	if (!matchesString(ref.projectionKind, artifact.projectionKind)) return false;
	if (!matchesString(ref.owner, artifact.owner)) return false;
	if (!matchesString(ref.capability, artifact.capability)) return false;
	if (!matchesString(ref.target, artifact.target)) return false;
	if (!matchesString(ref.role, artifact.role)) return false;
	return true;
}

function matchesString(
	expected: string | undefined,
	...actuals: Array<string | undefined>
): boolean {
	return (
		expected === undefined || actuals.some((actual) => actual === expected)
	);
}

function collectPlannedArtifacts(graph: SemanticGraph): PlannedArtifact[] {
	const plannedArtifacts: PlannedArtifact[] = [];
	for (const node of graph.nodes) {
		if (node.kind !== "planning.action") continue;
		const attrs = node.attributes as Record<string, unknown> | undefined;
		if (!attrs) continue;
		plannedArtifacts.push({
			nodeId: String(node.id),
			id: stringOrUndefined(attrs.id),
			artifactPath: stringOrUndefined(attrs.artifactPath),
			artifactNodeId: stringOrUndefined(attrs.artifactNodeId),
			projectionKind: stringOrUndefined(attrs.projectionKind),
			owner: stringOrUndefined(attrs.owner),
			capability: stringOrUndefined(attrs.capability),
			target:
				stringOrUndefined(attrs.target) ??
				projectionInputString(attrs.projectionInputs, "target") ??
				projectionInputString(attrs.projectionInputs, "operation"),
			role:
				stringOrUndefined(attrs.role) ??
				projectionInputString(attrs.projectionInputs, "role"),
			projectionInputs: attrs.projectionInputs,
		});
	}
	return plannedArtifacts;
}

function collectProjectionMaterializers(
	graph: SemanticGraph,
): ProjectionMaterializer[] {
	const materializers: ProjectionMaterializer[] = [];
	for (const node of graph.nodes) {
		if (node.kind !== "projection.materializer") continue;
		const attrs = node.attributes as Record<string, unknown> | undefined;
		if (!attrs) continue;
		const adapter = graph.edges.find(
			(edge) =>
				edge.kind === "projection.materializer.adapter" &&
				edge.from === node.id,
		);
		const selector = graph.edges.find(
			(edge) =>
				edge.kind === "projection.materializer.selector" &&
				edge.from === node.id,
		);
		materializers.push({
			nodeId: String(node.id),
			id: stringOrUndefined(attrs.id),
			adapter: adapter ? String(adapter.to) : undefined,
			projectionKind: stringOrUndefined(attrs.projectionKind),
			selector: selector
				? String(selector.to).replace(/^selector\.declaration:/, "")
				: undefined,
			paramsSource: stringOrUndefined(attrs.paramsSource),
			implementationMethod: stringOrUndefined(attrs.implementationMethod),
			inputMode: stringOrUndefined(attrs.inputMode),
			selectorResultField: stringOrUndefined(attrs.selectorResultField),
		});
	}
	return materializers;
}

function collectProviderSelections(graph: SemanticGraph): ProviderSelection[] {
	const selections: ProviderSelection[] = [];
	for (const node of graph.nodes) {
		if (node.kind !== "provider.selection") continue;
		const attrs = objectOrUndefined(node.attributes);
		const selectionAttrs = objectOrUndefined(attrs?.value) ?? attrs;
		if (!selectionAttrs) continue;
		const nodeSelectionId = String(node.id).startsWith("provider.selection:")
			? String(node.id).slice("provider.selection:".length)
			: undefined;
		selections.push({
			nodeId: String(node.id),
			id: stringOrUndefined(selectionAttrs.id) ?? nodeSelectionId,
			request: stringOrUndefined(selectionAttrs.request),
			target: stringOrUndefined(selectionAttrs.target),
			role: stringOrUndefined(selectionAttrs.role),
			provider: stringOrUndefined(selectionAttrs.provider),
			offering: stringOrUndefined(selectionAttrs.offering),
			dialect: stringOrUndefined(selectionAttrs.dialect),
			adapter: stringOrUndefined(selectionAttrs.adapter),
			projectionKind: stringOrUndefined(selectionAttrs.projectionKind),
		});
	}
	return selections;
}

function resolveProviderSelection(input: {
	selections: ProviderSelection[];
	rawInputs: unknown;
	projectionKind: string;
	adapterId?: string;
	errors: string[];
}): { adapterId?: string; ok: boolean } {
	const attrs = objectOrUndefined(input.rawInputs);
	const request = stringOrUndefined(attrs?.providerSelectionRequest);
	if (!request) return { adapterId: input.adapterId, ok: true };
	const matches = input.selections.filter(
		(selection) =>
			selection.request === request ||
			selection.nodeId === request ||
			selection.id === request ||
			selection.nodeId.startsWith(`provider.selection:${request}.`) ||
			selection.id?.startsWith(`${request}.`),
	);
	if (matches.length === 0) {
		input.errors.push(
			`provider.selection.unresolved: Planning action references provider selection request '${request}', but no provider.selection node was derived.`,
		);
		return { adapterId: undefined, ok: false };
	}
	if (matches.length > 1) {
		input.errors.push(
			`provider.selection.ambiguous: Planning action references provider selection request '${request}', but multiple provider.selection nodes matched: ${matches.map((match) => match.nodeId).join(", ")}.`,
		);
		return { adapterId: undefined, ok: false };
	}
	const selection = matches[0];
	const selectedProjectionKind = selection?.projectionKind;
	if (selectedProjectionKind && selectedProjectionKind !== input.projectionKind) {
		input.errors.push(
			`provider.selection.projectionKind.mismatch: Provider selection '${request}' resolved projection kind '${selectedProjectionKind}', but planning action uses '${input.projectionKind}'.`,
		);
		return { adapterId: undefined, ok: false };
	}
	const selectedAdapter =
		adapterIdFromNodeId(selection?.adapter) ??
		adapterIdFromProviderSelection(selection, request);
	if (!selectedAdapter) {
		input.errors.push(
			`provider.selection.adapter.missing: Provider selection '${request}' does not declare an adapter.`,
		);
		return { adapterId: undefined, ok: false };
	}
	if (input.adapterId && input.adapterId !== selectedAdapter) {
		input.errors.push(
			`provider.selection.adapter.mismatch: Provider selection '${request}' resolved adapter '${selectedAdapter}', but planning action uses '${input.adapterId}'.`,
		);
		return { adapterId: undefined, ok: false };
	}
	return { adapterId: selectedAdapter, ok: true };
}

function adapterIdFromProviderSelection(
	selection: ProviderSelection | undefined,
	request: string,
): string | undefined {
	if (!selection) return undefined;
	const id = selection.id ?? selection.nodeId.replace(/^provider\.selection:/, "");
	const prefix = `${request}.`;
	if (!id.startsWith(prefix)) return undefined;
	return id.slice(prefix.length);
}

function resolveProjectionMaterializer(input: {
	materializers: ProjectionMaterializer[];
	adapterId?: string;
	projectionKind: string;
	errors: string[];
}): ProjectionMaterializer | undefined {
	if (!input.adapterId) return undefined;
	const adapterNodeId = `adapter.adapter:${input.adapterId}`;
	const matches = input.materializers.filter(
		(materializer) =>
			materializer.projectionKind === input.projectionKind &&
			(materializer.adapter === input.adapterId ||
				materializer.adapter === adapterNodeId),
	);
	if (matches.length === 0) return undefined;
	if (matches.length === 1) return matches[0];
	input.errors.push(
		`projection.materializer.ambiguous: Adapter '${input.adapterId}' (${input.projectionKind}) matched multiple projection materializers: ${matches.map((match) => match.id ?? match.nodeId).join(", ")}.`,
	);
	return undefined;
}

function materializerAdapterInput(input: {
	materializer: ProjectionMaterializer;
	rawInputs: unknown;
	runtime: GraphRuntime;
	errors: string[];
}): unknown {
	const selectorId = selectorIdFromNodeId(
		resolveMaterializerSelector(input.materializer.selector, input.rawInputs),
	);
	if (!selectorId) {
		input.errors.push(
			`projection.materializer.selector.missing: Projection materializer '${input.materializer.id ?? input.materializer.nodeId}' does not declare a selector.`,
		);
		return input.rawInputs;
	}
	if (!input.runtime.hasSelector(selectorId)) {
		input.errors.push(
			`projection.materializer.selector.unresolved: Projection materializer '${input.materializer.id ?? input.materializer.nodeId}' references missing selector '${selectorId}'.`,
		);
		return input.rawInputs;
	}
	const selectorParams = selectorParamsFromProjectionInputs(
		input.rawInputs,
		input.materializer.paramsSource,
	);
	const selectorResult = input.runtime.select(selectorId, selectorParams);
	if (input.materializer.inputMode === "projectionInputsWithSelectorResult") {
		return {
			...(objectOrUndefined(input.rawInputs) ?? {}),
			[input.materializer.selectorResultField ?? "facts"]: selectorResult,
		};
	}
	return selectorResult;
}

async function graphRuntimeFromInput(
	input: unknown,
	graph: SemanticGraph,
): Promise<GraphRuntime> {
	const runtime = objectOrUndefined(input)?.runtime;
	if (isGraphRuntime(runtime)) return runtime;
	const selectors = await createGraphSelectorMaterializer().materialize({ graph });
	return createGraphRuntime(graph, selectors as Record<string, GraphSelector>);
}

function isGraphRuntime(value: unknown): value is GraphRuntime {
	return (
		typeof value === "object" &&
		value !== null &&
		"graph" in value &&
		typeof (value as { select?: unknown }).select === "function" &&
		typeof (value as { hasSelector?: unknown }).hasSelector === "function"
	);
}

function selectorParamsFromProjectionInputs(
	rawInputs: unknown,
	paramsSource: string | undefined,
): unknown {
	const attrs = objectOrUndefined(rawInputs);
	if (paramsSource === "projectionInputs") return attrs ?? {};
	if (paramsSource === "projectionInputs.params") {
		return objectOrUndefined(attrs?.params) ?? {};
	}
	if (paramsSource === "projectionInputs.paramsOrOwner") {
		return objectOrUndefined(attrs?.params) ?? ownerParams(attrs);
	}
	return objectOrUndefined(attrs?.params) ?? ownerParams(attrs);
}

function ownerParams(
	attrs: Record<string, unknown> | undefined,
): Record<string, unknown> {
	const owner = stringOrUndefined(attrs?.owner);
	return owner ? { owner } : {};
}

function augmentMaterializerInput(input: {
	projectionKind: string;
	input: unknown;
	adapters: RegisteredAdapter[];
}): unknown {
	if (input.projectionKind !== "projection.syntax.render") return input.input;
	const attrs = objectOrUndefined(input.input);
	if (!attrs) return input.input;
	const recipeAdapters = input.adapters.filter(
		(adapter) =>
			adapter.capability === TYPESCRIPT_RECIPE_APPLY_CAPABILITY ||
			adapter.kind === "typescript.module.recipe",
	);
	if (recipeAdapters.length === 0) return input.input;
	return {
		...attrs,
		recipeAdapters,
	};
}

type RegisteredAdapter = {
	id?: string;
	kind: string;
	capability?: string;
	adapter: unknown;
};

function resolveProjectionAdapter(input: {
	adapterId?: string;
	projectionKind: string;
	adaptersById: Map<string, RegisteredAdapter>;
	adaptersByKind: Map<string, RegisteredAdapter[]>;
	errors: string[];
}): RegisteredAdapter | undefined {
	if (input.adapterId) {
		const entry = input.adaptersById.get(input.adapterId);
		if (entry) return entry;
		const kindMatches = input.adaptersByKind.get(input.projectionKind) ?? [];
		if (kindMatches.length === 1) return kindMatches[0];
		input.errors.push(
			`planner.adapter.unresolved: No projection adapter registered for selected adapter '${input.adapterId}' (${input.projectionKind}).`,
		);
		return undefined;
	}

	const kindMatches = input.adaptersByKind.get(input.projectionKind) ?? [];
	if (kindMatches.length === 0) return undefined;
	if (kindMatches.length === 1) return kindMatches[0];
	input.errors.push(
		`planner.adapter.ambiguous: Projection kind '${input.projectionKind}' matched ${kindMatches.length} registered adapters but the planning action did not include adapterId.`,
	);
	return undefined;
}

function adapterIdFromNodeId(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const prefix = "adapter.adapter:";
	return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function resolvePlatformAdapter<T>(
	syncKind: string,
	adapterId: string | undefined,
	byId: Map<string, T>,
): T | undefined {
	if (adapterId) return byId.get(adapterId) ?? byId.get(`adapter.adapter:${adapterId}`);
	// Fall back to first adapter whose registered id contains the syncKind.
	for (const [id, adapter] of byId) {
		if (id.includes(syncKind)) return adapter;
	}
	// Last resort: if exactly one adapter is registered, use it.
	if (byId.size === 1) return byId.values().next().value;
	return undefined;
}

function resolveAdapterById<T>(
	adapterId: string | undefined,
	byId: Map<string, T>,
): T | undefined {
	if (!adapterId) return undefined;
	return (
		byId.get(adapterId) ??
		byId.get(`adapter.adapter:${adapterId}`) ??
		(adapterId.startsWith("adapter.adapter:")
			? byId.get(adapterId.slice("adapter.adapter:".length))
			: undefined)
	);
}

function adapterMapByCapability<T>(
	adapters: RegisteredAdapter[],
	capability: string,
): Map<string, T> {
	const result = new Map<string, T>();
	for (const entry of adapters) {
		if (entry.capability !== capability) continue;
		const id = entry.id ?? entry.kind;
		result.set(id, entry.adapter as T);
		result.set(`adapter.adapter:${id}`, entry.adapter as T);
	}
	return result;
}

function summarizeMutations(id: string, mutations: PlatformMutation[]): SyncActionSummary {
	let created = 0, updated = 0, deleted = 0, noop = 0, breaking = 0;
	for (const m of mutations) {
		if (m.operation === "create") created++;
		else if (m.operation === "update") updated++;
		else if (m.operation === "delete") deleted++;
		else noop++;
		if (m.breaking) breaking++;
	}
	return { id, created, updated, deleted, noop, breaking };
}

function resolveExecutionConfig(
	value: unknown,
	path: string,
	errors: string[],
): unknown {
	if (Array.isArray(value)) {
		return value.map((item, index) =>
			resolveExecutionConfig(item, `${path}[${index}]`, errors),
		);
	}
	if (typeof value !== "object" || value === null) return value;

	const record = value as Record<string, unknown>;
	if (
		typeof record.env === "string" &&
		Object.keys(record).every((key) => key === "env")
	) {
		const resolved = process.env[record.env];
		if (resolved === undefined) {
			errors.push(
				`sync.config.env.missing: Environment variable '${record.env}' referenced by ${path} is not set.`,
			);
			return null;
		}
		return resolved;
	}

	const resolved: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(record)) {
		resolved[key] = resolveExecutionConfig(item, `${path}.${key}`, errors);
	}
	return resolved;
}

function filterApplicableMutations(input: {
	actionId: string;
	mutations: PlatformMutation[];
	forceBreaking: boolean;
	diagnostics: unknown[];
}): PlatformMutation[] {
	const allowed: PlatformMutation[] = [];
	for (const mutation of input.mutations) {
		if (mutation.supported === false) {
			input.diagnostics.push({
				severity: "warning",
				code: "sync.mutation.unsupported.skipped",
				message: `Unsupported mutation '${mutation.id}' for sync action '${input.actionId}' was skipped.`,
				details: { action: input.actionId, mutation: mutation.id },
			});
			continue;
		}
		if (mutation.breaking && !input.forceBreaking) {
			input.diagnostics.push({
				severity: "warning",
				code: "sync.mutation.breaking.skipped",
				message: `Breaking mutation '${mutation.id}' for sync action '${input.actionId}' was skipped. Pass --force-breaking to allow supported breaking mutations.`,
				details: { action: input.actionId, mutation: mutation.id },
			});
			continue;
		}
		allowed.push(mutation);
	}
	return allowed;
}

export function createActionExecutorAdapter(options: ActionExecutorOptions) {
	const adaptersById = new Map(
		options.adapters
			.filter((entry) => entry.id !== undefined)
			.map((entry) => [entry.id as string, entry]),
	);
	const adaptersByKind = new Map<string, RegisteredAdapter[]>();
	for (const entry of options.adapters) {
		const { kind } = entry;
		const entries = adaptersByKind.get(kind) ?? [];
		entries.push(entry);
		adaptersByKind.set(kind, entries);
	}
	const externalSourceAdaptersById = adapterMapByCapability<ExternalSourceAdapter>(
		options.adapters,
		EXTERNAL_SOURCE_CAPABILITY,
	);
	for (const { id, adapter } of options.externalSourceAdapters ?? []) {
		externalSourceAdaptersById.set(id, adapter);
		externalSourceAdaptersById.set(`adapter.adapter:${id}`, adapter);
	}
	const platformSyncAdaptersById = adapterMapByCapability<PlatformSyncAdapter>(
		options.adapters,
		PLATFORM_SYNC_CAPABILITY,
	);
	for (const { id, adapter } of options.platformSyncAdapters ?? []) {
		platformSyncAdaptersById.set(id, adapter);
		platformSyncAdaptersById.set(`adapter.adapter:${id}`, adapter);
	}
	const platformApplyAdaptersById = adapterMapByCapability<PlatformApplyAdapter>(
		options.adapters,
		PLATFORM_APPLY_CAPABILITY,
	);
	for (const { id, adapter } of options.platformApplyAdapters ?? []) {
		platformApplyAdaptersById.set(id, adapter);
		platformApplyAdaptersById.set(`adapter.adapter:${id}`, adapter);
	}

	return implementActionExecutorAdapter({
			async sync(input): Promise<SyncExecutorOutput> {
				const graph = input.graph as SemanticGraph;
				const runtime = await graphRuntimeFromInput(input, graph);

			const preview = input.preview ?? false;
			const forceBreaking = input.forceBreaking ?? false;
			const summaries: SyncActionSummary[] = [];
			const diagnostics: unknown[] = [];
			const errors: string[] = [];
			let matchedActions = 0;

			for (const node of graph.nodes) {
				if (node.kind !== "sync.action") continue;
				const attrs = node.attributes as Record<string, unknown> | undefined;
				if (!attrs) continue;

				const actionId = stringOrUndefined(attrs.id) ?? String(node.id);

				if (input.target !== undefined && actionId !== input.target) continue;
				matchedActions++;

				const syncKind = stringOrUndefined(attrs.syncKind);
				if (!syncKind) {
					errors.push(`sync.action.syncKind.missing: sync.action '${actionId}' has no syncKind.`);
					continue;
				}
				const errorCountBeforeConfig = errors.length;
				const config = resolveExecutionConfig(
					attrs.config,
					`sync.action '${actionId}' config`,
					errors,
				);
				if (errors.length > errorCountBeforeConfig) continue;

				// Read current external state.
				const externalSourceId = stringOrUndefined(attrs.externalSource);
				let externalState: unknown;
				if (externalSourceId !== null && externalSourceId !== undefined) {
					const sourceAdapter = resolveAdapterById(
						externalSourceId,
						externalSourceAdaptersById,
					);
					if (!sourceAdapter) {
						errors.push(`planner.externalSource.unresolved: No external source adapter registered for "${externalSourceId}"`);
						continue;
					}
					const sourceResult = await sourceAdapter.read({
						root: input.root,
						config,
						graph,
						runtime,
					});
					externalState = sourceResult.state;
				}

				// Resolve the platform sync adapter by syncKind.
				const syncAdapterId = stringOrUndefined(attrs.syncAdapter);
				const syncAdapter = resolvePlatformAdapter(
					syncKind,
					syncAdapterId,
					platformSyncAdaptersById,
				);
				if (!syncAdapter) {
					errors.push(`planner.platformSync.unresolved: No platform sync adapter registered for syncKind "${syncKind}"${syncAdapterId ? ` (adapterId: ${syncAdapterId})` : ""}.`);
					continue;
				}

				// Compute mutations.
				const syncResult = await syncAdapter.sync({
					action: { id: actionId, syncKind, externalState, config },
					graph,
					runtime,
				});

				for (const d of syncResult.diagnostics) {
					const diag = d as { severity?: string; code?: string; message?: string };
					if (diag.severity === "error" || diag.severity === undefined) {
						errors.push(`${diag.code ?? "sync.error"}: ${diag.message ?? String(d)}`);
					} else {
						diagnostics.push(d);
					}
				}

				const mutations = syncResult.mutations as PlatformMutation[];
				const summary = summarizeMutations(actionId, mutations);
				summaries.push(summary);

				if (preview || mutations.length === 0) continue;
				const applicableMutations = filterApplicableMutations({
					actionId,
					mutations,
					forceBreaking,
					diagnostics,
				});
				if (applicableMutations.length === 0) continue;

				// Apply mutations to the live platform.
				const applyAdapterId = stringOrUndefined(attrs.platformTarget);
				const applyAdapter = resolvePlatformAdapter(
					syncKind,
					applyAdapterId,
					platformApplyAdaptersById,
				);
				if (!applyAdapter) {
					errors.push(`planner.platformApply.unresolved: No platform apply adapter registered for syncKind "${syncKind}"${applyAdapterId ? ` (adapterId: ${applyAdapterId})` : ""}.`);
					continue;
				}

				const applyResult = await applyAdapter.apply({
					mutations: applicableMutations,
					config,
					root: input.root,
					graph,
				});

				for (const d of applyResult.diagnostics) {
					const diag = d as { severity?: string; code?: string; message?: string };
					if (diag.severity === "error" || diag.severity === undefined) {
						errors.push(`${diag.code ?? "apply.error"}: ${diag.message ?? String(d)}`);
					} else {
						diagnostics.push(d);
					}
				}
			}

			if (input.target !== undefined && matchedActions === 0) {
				errors.push(
					`sync.action.target.unresolved: No sync.action found for target '${input.target}'.`,
				);
			}

			if (errors.length > 0) {
				throw new Error(`Sync execution failed:\n${errors.join("\n")}`);
			}

			return { preview, summaries, diagnostics };
		},

			async execute(input): Promise<ActionOutput[]> {
				const graph = input.graph as SemanticGraph;
				const runtime = await graphRuntimeFromInput(input, graph);
				const runtimeGraph = runtime.graph as SemanticGraph;

			const plannedArtifacts = collectPlannedArtifacts(runtimeGraph);
			const projectionMaterializers = collectProjectionMaterializers(runtimeGraph);
			const providerSelections = collectProviderSelections(runtimeGraph);

			const outputs: ActionOutput[] = [];
			const errors: string[] = [];

			for (const node of graph.nodes) {
				if (node.kind !== "planning.action") continue;
				const attrs = node.attributes as Record<string, unknown> | undefined;
				if (!attrs) continue;
				const projectionKind =
					typeof attrs.projectionKind === "string"
						? attrs.projectionKind
						: undefined;
				if (!projectionKind) continue;

				const actionAdapterId =
					typeof attrs.adapterId === "string" ? attrs.adapterId : undefined;
				const providerSelection = resolveProviderSelection({
					selections: providerSelections,
					rawInputs: attrs.projectionInputs,
					projectionKind,
					adapterId: actionAdapterId,
					errors,
				});
				if (!providerSelection.ok) continue;
				const adapterId = providerSelection.adapterId;
				const adapterEntry = resolveProjectionAdapter({
					adapterId,
					projectionKind,
					adaptersById,
					adaptersByKind,
					errors,
				});
				if (!adapterEntry) continue;

				const refDiagnostics: PlannerResolutionDiagnostic[] = [];
				const resolvedInputs = resolveArtifactRefs(
					attrs.projectionInputs,
					plannedArtifacts,
					refDiagnostics,
				);

				for (const d of refDiagnostics) {
					errors.push(`${d.code}: ${d.message}`);
				}
				const materializer = resolveProjectionMaterializer({
					materializers: projectionMaterializers,
					adapterId: adapterId ?? adapterEntry.id,
					projectionKind,
					errors,
				});
				const projectionInputs = materializer
					? materializerAdapterInput({
							materializer,
							rawInputs: resolvedInputs,
							runtime,
							errors,
						})
					: resolvedInputs;
				const materializerInputs = augmentMaterializerInput({
					projectionKind,
					input: projectionInputs,
					adapters: options.adapters,
				});

				const action: ProjectionAction = {
					id: String(node.id),
					projectionKind,
					artifactPath:
						typeof attrs.artifactPath === "string" ? attrs.artifactPath : "",
					artifactNodeId:
						typeof attrs.artifactNodeId === "string"
							? attrs.artifactNodeId
							: undefined,
					projectionInputs,
				};

				if (!hasProjectMethod(adapterEntry.adapter)) {
					if (!materializer) {
						errors.push(
							`projection.materializer.missing: Adapter '${adapterEntry.id ?? adapterId ?? adapterEntry.kind}' does not implement projection.execute and no projection.materializer was found for '${projectionKind}'.`,
						);
						continue;
					}
					const result = await executeMaterializer({
						adapter: adapterEntry.adapter,
						materializer,
						input: materializerInputs,
						action,
						errors,
					});
					for (const output of result) outputs.push(output);
					continue;
				}

				// Resolve externalSource adapter and read external state when present.
				let externalState: unknown;
				const externalSourceId =
					typeof attrs.externalSource === "string"
						? attrs.externalSource
						: null;
				if (externalSourceId !== null) {
					const externalSourceAdapter =
						externalSourceAdaptersById.get(externalSourceId);
					if (!externalSourceAdapter) {
						errors.push(
							`planner.externalSource.unresolved: No external source adapter registered for "${externalSourceId}"`,
						);
					} else {
						const result = await externalSourceAdapter.read({
							root: input.root,
							graph,
							runtime,
						});
						externalState = result.state;
					}
				}

				if (externalState !== undefined) action.externalState = externalState;

				const result = await adapterEntry.adapter.project({
					action,
					graph,
					runtime,
				});

				for (const diagnostic of result.diagnostics) {
					if (
						diagnostic.severity === "error" ||
						diagnostic.severity === undefined
					) {
						errors.push(`${diagnostic.code}: ${diagnostic.message}`);
					}
				}

				for (const file of result.files) {
					outputs.push({
						location: file.path,
						content: file.text,
						...(file.disposition !== undefined
							? { disposition: file.disposition }
							: {}),
					});
				}
			}

			if (errors.length > 0) {
				throw new Error(`Action execution failed:\n${errors.join("\n")}`);
			}

			return outputs;
		},
	});
}

function stringOrUndefined(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function projectionInputString(
	value: unknown,
	key: string,
): string | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return undefined;
	}
	return stringOrUndefined((value as Record<string, unknown>)[key]);
}

async function executeMaterializer(input: {
	adapter: unknown;
	materializer: ProjectionMaterializer;
	input: unknown;
	action: ProjectionAction;
	errors: string[];
}): Promise<ActionOutput[]> {
	const method = input.materializer.implementationMethod ?? "render";
	const fn = isMaterializerAdapter(input.adapter)
		? input.adapter[method]
		: undefined;
	if (typeof fn !== "function") {
		input.errors.push(
			`projection.materializer.method.missing: Projection materializer '${input.materializer.id ?? input.materializer.nodeId}' expects adapter method '${method}'.`,
		);
		return [];
	}

	const result = await fn(input.input);
	if (typeof result === "string") {
		return [
			{
				location: input.action.artifactPath,
				content: result,
				disposition: "generated",
			},
		];
	}

	if (!isArtifactRenderRecipe(result)) {
		input.errors.push(
			`projection.materializer.output.invalid: Projection materializer '${input.materializer.id ?? input.materializer.nodeId}' returned neither text nor an artifact render recipe.`,
		);
		return [];
	}
	const recipe = recipeWithActionPath(result, input.action.artifactPath);
	return [
		{
			location: recipe.path ?? input.action.artifactPath,
			content: recipe.text,
			...(recipe.disposition !== undefined
				? { disposition: recipe.disposition }
				: { disposition: "generated" }),
		},
	];
}

function selectorIdFromNodeId(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const prefix = "selector.declaration:";
	return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function resolveMaterializerSelector(
	selector: string | undefined,
	rawInputs: unknown,
): string | undefined {
	if (selector !== "projectionInputs.selector") return selector;
	const attrs = objectOrUndefined(rawInputs);
	return stringOrUndefined(attrs?.selector);
}

function objectOrUndefined(
	value: unknown,
): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function hasProjectMethod(v: unknown): v is ProjectionExecuteAdapter {
	return (
		typeof v === "object" &&
		v !== null &&
		"project" in v &&
		typeof (v as { project?: unknown }).project === "function"
	);
}

function isMaterializerAdapter(
	value: unknown,
): value is Record<string, (input: unknown) => unknown | Promise<unknown>> {
	return typeof value === "object" && value !== null;
}

function isArtifactRenderRecipe(value: unknown): value is ArtifactRenderRecipe {
	const recipe = objectOrUndefined(value);
	const kind = stringOrUndefined(recipe?.kind);
	return kind === "text.file";
}

function recipeWithActionPath(
	recipe: ArtifactRenderRecipe,
	artifactPath: string,
): ArtifactRenderRecipe {
	const currentPath = stringOrUndefined(
		(recipe as unknown as Record<string, unknown>).path,
	);
	if (currentPath) return recipe;
	return {
		...(recipe as Record<string, unknown>),
		path: artifactPath,
	} as ArtifactRenderRecipe;
}
