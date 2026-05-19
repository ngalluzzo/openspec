import type {
	SemanticEdge,
	SemanticFacet,
	SemanticGraph,
	SemanticNode,
	GraphRuntime,
	GraphSelector,
} from "@openspec/kernel";
import type { GraphSelectorsMaterializeAdapter } from "../generated/graph-capabilities.contracts.ts";
import { implementGraphSelectorsMaterializeAdapter } from "../generated/graph-capabilities.contracts.ts";

type SelectorDefinition = {
	sources?: Record<string, SourceSpec>;
	where?: unknown;
	groupBy?: unknown;
	result: {
		cardinality: "many" | "one" | "optionalOne";
		value: unknown;
		when?: unknown;
	};
	orderBy?: unknown[];
};

type CompiledSelectorPlan = {
	sources: Array<readonly [string, SourceSpec]>;
	where?: unknown;
	groupBy?: unknown;
	result?: SelectorDefinition["result"];
	orderBy: unknown[];
};

type SourceSpec =
	| NodesSourceSpec
	| EdgesSourceSpec
	| FacetsSourceSpec
	| NeighborsSourceSpec
	| SelectorSourceSpec
	| ArraySourceSpec;

type NodesSourceSpec = {
	kind: "nodes";
	filter?: {
		kind?: unknown;
		id?: unknown;
	};
	optional?: boolean;
};

type EdgesSourceSpec = {
	kind: "edges";
	filter?: {
		kind?: unknown;
		id?: unknown;
		from?: unknown;
		to?: unknown;
	};
	optional?: boolean;
};

type FacetsSourceSpec = {
	kind: "facets";
	filter?: {
		kind?: unknown;
		id?: unknown;
		target?: unknown;
		value?: Record<string, unknown>;
	};
	optional?: boolean;
};

type NeighborsSourceSpec = {
	kind: "neighbors";
	nodeId: unknown;
	filter?: {
		kind?: unknown;
		direction?: unknown;
	};
	optional?: boolean;
};

type SelectorSourceSpec = {
	kind: "selector";
	selector: unknown;
	params?: unknown;
	optional?: boolean;
};

type ArraySourceSpec = {
	kind: "array";
	items: unknown;
	optional?: boolean;
};

type RowValue = SemanticNode | SemanticEdge | SemanticFacet | unknown | null;
type Row = Record<string, RowValue>;

export function createGraphSelectorMaterializer(): GraphSelectorsMaterializeAdapter {
	return implementGraphSelectorsMaterializeAdapter({
		async materialize({ graph }) {
			return buildSelectorRegistry(graph as SemanticGraph);
		},
	});
}

function buildSelectorRegistry(
	graph: SemanticGraph,
): Record<string, GraphSelector> {
	const registry: Record<string, GraphSelector> = {};

	for (const node of graph.nodes) {
		if (node.kind !== "selector.declaration") continue;
		const attrs = node.attributes as Record<string, unknown> | undefined;
		if (!attrs) continue;
		const definition = attrs.definition as Record<string, unknown> | undefined;
		if (!definition) continue;

		const selectorId = String(node.id).replace(/^selector\.declaration:/, "");
		registry[selectorId] = buildSelector(definition, registry);
	}

	return registry;
}

function buildSelector(
	definition: Record<string, unknown>,
	registry: Record<string, GraphSelector>,
): GraphSelector {
	const plan = compileSelectorPlan(definition);
	return function selector(input: unknown, selectorContext): unknown {
		const runtime = selectorContext.runtime;
		const resultDef = plan.result;
		const groupByExpr = plan.groupBy;
		const orderByExprs = plan.orderBy ?? [];

		if (!resultDef) return [];

		// Build rows from sources via nested-loop join.
		let rows: Row[] = [{}];
			if (plan.sources.length > 0) {
				for (const [sourceName, sourceSpec] of plan.sources) {
				rows = expandSource(
					rows,
						sourceName,
						sourceSpec,
						runtime,
						input,
						registry,
					);
				}
			}

			if (plan.where !== undefined) {
				rows = rows.filter((row) =>
					isTruthy(evalExpr(plan.where, makeCtx(row, null, null, input))),
				);
			}
		if (resultDef.when !== undefined) {
			rows = rows.filter((row) =>
				isTruthy(evalExpr(resultDef.when, makeCtx(row, null, null, input))),
			);
		}

		let results: unknown[];

		if (groupByExpr) {
			// Group rows by the groupBy expression, then evaluate result per group.
			const groups = new Map<unknown, Row[]>();
			for (const row of rows) {
				const key = evalExpr(groupByExpr, makeCtx(row, null, null, input));
				const serialKey = JSON.stringify(key);
				const group = groups.get(serialKey) ?? [];
				groups.set(serialKey, group);
				group.push(row);
			}
			results = [];
			for (const groupRows of groups.values()) {
				const representativeRow = groupRows[0];
				if (!representativeRow) continue;
				const ctx = makeCtx(representativeRow, null, groupRows, input);
				const value = evalExpr(resultDef.value, ctx);
				results.push(value);
			}
		} else {
			results = rows.map((row) => {
				const ctx = makeCtx(row, null, null, input);
				return evalExpr(resultDef.value, ctx);
			});
		}

		// Sort by orderBy expressions.
		if (orderByExprs.length > 0) {
			results.sort((a, b) => {
				for (const orderExpr of orderByExprs) {
					const ctxA = makeCtx({}, a, null, input);
					const ctxB = makeCtx({}, b, null, input);
					const va = String(evalExpr(orderExpr, ctxA) ?? "");
					const vb = String(evalExpr(orderExpr, ctxB) ?? "");
					const cmp = va.localeCompare(vb);
					if (cmp !== 0) return cmp;
				}
				return 0;
			});
		}

		if (
			resultDef.cardinality === "one" ||
			resultDef.cardinality === "optionalOne"
		)
			return results[0] ?? null;
		return results;
	};
}

function compileSelectorPlan(definition: Record<string, unknown>): CompiledSelectorPlan {
	const sources = definition.sources as Record<string, SourceSpec> | undefined;
	return {
		sources: sources ? Object.entries(sources) : [],
		where: definition.where,
		groupBy: definition.groupBy,
		result: definition.result as SelectorDefinition["result"] | undefined,
		orderBy: Array.isArray(definition.orderBy) ? definition.orderBy : [],
	};
}

function expandSource(
	rows: Row[],
	sourceName: string,
	sourceSpec: SourceSpec,
	runtime: GraphRuntime,
	input: unknown,
	registry: Record<string, GraphSelector>,
): Row[] {
	const newRows: Row[] = [];

	for (const row of rows) {
		const ctx = makeCtx(row, null, null, input);
		let items: RowValue[] = [];

		if (sourceSpec.kind === "nodes") {
				const kindFilter = evalStringFilter(sourceSpec.filter?.kind, ctx);
				const idFilter = evalStringFilter(sourceSpec.filter?.id, ctx);
				items = runtime.nodes({
					...(kindFilter ? { kind: kindFilter } : {}),
					...(idFilter ? { id: idFilter } : {}),
				});
			} else if (sourceSpec.kind === "edges") {
				const kindFilter = evalStringFilter(sourceSpec.filter?.kind, ctx);
				const idFilter = evalStringFilter(sourceSpec.filter?.id, ctx);
				const fromFilter = evalStringFilter(sourceSpec.filter?.from, ctx);
				const toFilter = evalStringFilter(sourceSpec.filter?.to, ctx);
				items = runtime.edges({
					...(kindFilter ? { kind: kindFilter } : {}),
					...(idFilter ? { id: idFilter } : {}),
					...(fromFilter ? { from: fromFilter } : {}),
					...(toFilter ? { to: toFilter } : {}),
				});
			} else if (sourceSpec.kind === "facets") {
				const kindFilter = evalStringFilter(sourceSpec.filter?.kind, ctx);
				const idFilter = evalStringFilter(sourceSpec.filter?.id, ctx);
				const targetFilter = evalStringFilter(sourceSpec.filter?.target, ctx);
				const valueFilters = Object.entries(sourceSpec.filter?.value ?? {}).map(
					([path, expr]) => [path, evalExpr(expr, ctx)] as const,
				);
				items = runtime.facets({
					...(kindFilter ? { kind: kindFilter } : {}),
					...(idFilter ? { id: idFilter } : {}),
					...(targetFilter ? { target: targetFilter } : {}),
				}).filter(
					(facet) =>
						valueFilters.every(
							([path, expected]) => getPath(facet.value, path) === expected,
						),
				);
		} else if (sourceSpec.kind === "neighbors") {
			const nodeIdVal = evalExpr(sourceSpec.nodeId, ctx);
			if (typeof nodeIdVal !== "string") {
				if (sourceSpec.optional) items = [null];
				else continue;
			} else {
				const directionVal = sourceSpec.filter?.direction
					? String(evalExpr(sourceSpec.filter.direction, ctx) ?? "out")
					: "out";
				const kindExpr = sourceSpec.filter?.kind;
				const kindFilter =
					kindExpr !== undefined
						? String(evalExpr(kindExpr, ctx) ?? "")
						: undefined;
					items = runtime.neighbors(nodeIdVal, {
						direction: directionVal as "out" | "in" | "both",
						...(kindFilter ? { kind: kindFilter } : {}),
					});
				}
			} else if (sourceSpec.kind === "selector") {
				const selectorId = evalExpr(sourceSpec.selector, ctx);
			if (typeof selectorId !== "string" || !selectorId) {
				if (sourceSpec.optional) items = [null];
				else continue;
			} else {
					if (!runtime.hasSelector(selectorId) && !registry[selectorId]) {
						if (sourceSpec.optional) items = [null];
						else continue;
					} else {
					const params =
						sourceSpec.params !== undefined
							? evalExpr(sourceSpec.params, ctx)
							: input;
						const result = runtime.hasSelector(selectorId)
							? runtime.select(selectorId, params)
							: registry[selectorId]?.(params, { runtime });
						if (Array.isArray(result)) items = result;
					else if (result === null || result === undefined) items = [];
					else items = [result];
				}
			}
		} else if (sourceSpec.kind === "array") {
			const arrayValue = evalExpr(sourceSpec.items, ctx);
			if (Array.isArray(arrayValue)) items = arrayValue;
			else if (arrayValue === null || arrayValue === undefined) items = [];
			else items = [arrayValue];
		}

		if (items.length === 0) {
			if (sourceSpec.optional) {
				newRows.push({ ...row, [sourceName]: null });
			}
			// non-optional with no items → row is dropped (inner join)
			continue;
		}

		for (const item of items) {
			newRows.push({ ...row, [sourceName]: item });
		}
	}

	return newRows;
}

function evalStringFilter(expr: unknown, ctx: EvalCtx): string | undefined {
	if (expr === undefined) return undefined;
	const value = evalExpr(expr, ctx);
	return value === null || value === undefined ? undefined : String(value);
}

type EvalCtx = {
	row: Row | unknown;
	value: unknown;
	group?: { rows: Row[] } | null;
	input: unknown;
	parameter: unknown;
};

function makeCtx(
	row: Row | unknown,
	value: unknown,
	groupRows: Row[] | null,
	input: unknown,
): EvalCtx {
	return {
		row,
		value,
		group: groupRows ? { rows: groupRows } : null,
		input,
		parameter: input,
	};
}

/**
 * Minimal synchronous evaluator for the selector expression DSL.
 * Handles the json-logic subset used in selector definitions:
 * - bare values (string/number/boolean/null) → literal
 * - { var: "a.b.c" } or { var: ["a.b.c", default] } → path lookup
 * - { os_object: [{ key: rule, ... }] } → build object
 * - { os_map: [array, name, mapper, filter?, nullCheck?] } → map array
 * - OpenSpec helpers used by selector specs: cat, pascal_case, str_after,
 *   os_node_id, and os_is_empty.
 * - { $expr: rule } → evaluates the inner rule (unwrap envelope)
 */
function evalExpr(expr: unknown, ctx: EvalCtx): unknown {
	if (expr === null || typeof expr !== "object") return expr;
	if (Array.isArray(expr)) return expr;

	const obj = expr as Record<string, unknown>;

	// Unwrap $expr envelope
	if ("$expr" in obj && Object.keys(obj).length === 1) {
		return evalExpr(obj.$expr, ctx);
	}

	// json-logic: var
	if ("var" in obj && Object.keys(obj).length === 1) {
		const varVal = obj.var;
		if (typeof varVal === "string") {
			return getPath(ctx, varVal);
		}
		if (Array.isArray(varVal) && varVal.length >= 1) {
			const val = getPath(ctx, String(varVal[0]));
			return val !== undefined && val !== null ? val : (varVal[1] ?? null);
		}
		return null;
	}

	if ("and" in obj && Object.keys(obj).length === 1) {
		const args = obj.and;
		if (!Array.isArray(args)) return false;
		let last: unknown = true;
		for (const arg of args) {
			last = evalExpr(arg, ctx);
			if (!isTruthy(last)) return last;
		}
		return last;
	}

	if ("or" in obj && Object.keys(obj).length === 1) {
		const args = obj.or;
		if (!Array.isArray(args)) return false;
		for (const arg of args) {
			const value = evalExpr(arg, ctx);
			if (isTruthy(value)) return value;
		}
		return false;
	}

	if ("!" in obj && Object.keys(obj).length === 1) {
		const args = obj["!"];
		const value = Array.isArray(args)
			? evalExpr(args[0], ctx)
			: evalExpr(args, ctx);
		return !isTruthy(value);
	}

	if ("json_stringify" in obj && Object.keys(obj).length === 1) {
		const args = obj.json_stringify;
		const value = Array.isArray(args)
			? evalExpr(args[0], ctx)
			: evalExpr(args, ctx);
		return JSON.stringify(value ?? null);
	}

	if ("===" in obj && Object.keys(obj).length === 1) {
		const args = obj["==="];
		if (!Array.isArray(args) || args.length < 2) return false;
		return evalExpr(args[0], ctx) === evalExpr(args[1], ctx);
	}

	if (">" in obj && Object.keys(obj).length === 1) {
		const args = obj[">"];
		if (!Array.isArray(args) || args.length < 2) return false;
		const left = evalExpr(args[0], ctx);
		const right = evalExpr(args[1], ctx);
		return Number(left) > Number(right);
	}

	if ("!==" in obj && Object.keys(obj).length === 1) {
		const args = obj["!=="];
		if (!Array.isArray(args) || args.length < 2) return false;
		return evalExpr(args[0], ctx) !== evalExpr(args[1], ctx);
	}

	if ("cat" in obj && Object.keys(obj).length === 1) {
		const args = obj.cat;
		if (!Array.isArray(args)) return "";
		return args.map((arg) => String(evalExpr(arg, ctx) ?? "")).join("");
	}

	if ("pascal_case" in obj && Object.keys(obj).length === 1) {
		const args = obj.pascal_case;
		const value = Array.isArray(args)
			? evalExpr(args[0], ctx)
			: evalExpr(args, ctx);
		if (typeof value !== "string") return "";
		return splitWords(value)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join("");
	}

	if ("camel_case" in obj && Object.keys(obj).length === 1) {
		const args = obj.camel_case;
		const value = Array.isArray(args)
			? evalExpr(args[0], ctx)
			: evalExpr(args, ctx);
		if (typeof value !== "string") return "";
		const pascal = splitWords(value)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join("");
		return `${pascal.slice(0, 1).toLowerCase()}${pascal.slice(1)}`;
	}

	if ("str_after" in obj && Object.keys(obj).length === 1) {
		const args = obj.str_after;
		if (!Array.isArray(args) || args.length < 2) return "";
		const value = evalExpr(args[0], ctx);
		const separator = String(evalExpr(args[1], ctx) ?? "");
		const optional = Boolean(args.length >= 3 ? evalExpr(args[2], ctx) : false);
		if (typeof value !== "string") return optional ? "" : "";
		const index = value.indexOf(separator);
		if (index === -1) return optional ? value : "";
		return value.slice(index + separator.length);
	}

	if ("regex_test" in obj && Object.keys(obj).length === 1) {
		const args = obj.regex_test;
		if (!Array.isArray(args) || args.length < 2) return false;
		const value = evalExpr(args[0], ctx);
		if (typeof value !== "string") return false;
		const pattern = String(evalExpr(args[1], ctx) ?? "");
		try {
			return new RegExp(pattern).test(value);
		} catch {
			return false;
		}
	}

	if ("os_node_id" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_node_id;
		if (!Array.isArray(args) || args.length < 2) return "";
		const [factKind, ...segments] = args.map((arg) =>
			String(evalExpr(arg, ctx) ?? ""),
		);
		return `${factKind}:${segments.join(".")}`;
	}

	if ("os_is_empty" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_is_empty;
		const value = Array.isArray(args)
			? evalExpr(args[0], ctx)
			: evalExpr(args, ctx);
		if (value === null || value === undefined) return true;
		if (typeof value === "string" || Array.isArray(value))
			return value.length === 0;
		if (typeof value === "object") return Object.keys(value).length === 0;
		return false;
	}

	if ("object_includes" in obj && Object.keys(obj).length === 1) {
		const args = obj.object_includes;
		if (!Array.isArray(args) || args.length < 2) return false;
		const object = evalExpr(args[0], ctx);
		const subset = evalExpr(args[1], ctx);
		if (!isPlainObject(object) || !isPlainObject(subset)) return false;
		return deepObjectIncludes(object, subset);
	}

	// os_object: builds an object from a record of rules
	if ("os_object" in obj && Object.keys(obj).length === 1) {
		const arg = obj.os_object;
		const fields: Record<string, unknown> = Array.isArray(arg)
			? ((arg[0] as Record<string, unknown>) ?? {})
			: ((arg as Record<string, unknown>) ?? {});
		const result: Record<string, unknown> = {};
		for (const [key, ruleExpr] of Object.entries(fields)) {
			const val = evalExpr(ruleExpr, ctx);
			if (val !== undefined) result[key] = val;
		}
		return result;
	}

	if ("os_array" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_array;
		if (!Array.isArray(args)) return [];
		return args.map((arg) => evalExpr(arg, ctx));
	}

	// os_map: [array, name, mapper, filter?, nullCheck?]
	if ("os_map" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_map as unknown[];
		if (!Array.isArray(args) || args.length < 3) return [];
		const arr = evalExpr(args[0], ctx);
		const name = String(args[1] ?? "item");
		const mapperExpr = args[2];
		const filterExpr = args.length >= 4 ? args[3] : undefined;
		const nullCheckExpr = args.length >= 5 ? args[4] : undefined;

		if (!Array.isArray(arr)) return [];
		return arr
			.map((item) => {
				const itemCtx: EvalCtx = { ...ctx, [name]: item };
				if (
					filterExpr !== undefined &&
					filterExpr !== false &&
					!isTruthy(evalExpr(filterExpr, itemCtx))
				) {
					return undefined;
				}
				if (nullCheckExpr !== undefined) {
					const nullCheck = evalExpr(nullCheckExpr, itemCtx);
					if (nullCheck === null || nullCheck === undefined) return undefined;
				}
				return evalExpr(mapperExpr, itemCtx);
			})
			.filter((v): v is unknown => v !== undefined);
	}

	if ("os_flat_map" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_flat_map as unknown[];
		if (!Array.isArray(args) || args.length < 3) return [];
		const arr = evalExpr(args[0], ctx);
		const name = String(args[1] ?? "item");
		const mapperExpr = args[2];
		const filterExpr = args.length >= 4 ? args[3] : undefined;
		if (!Array.isArray(arr)) return [];
		const result: unknown[] = [];
		for (const item of arr) {
			const itemCtx: EvalCtx = { ...ctx, [name]: item };
			if (filterExpr !== undefined && !isTruthy(evalExpr(filterExpr, itemCtx))) continue;
			const mapped = evalExpr(mapperExpr, itemCtx);
			if (Array.isArray(mapped)) result.push(...mapped);
			else if (mapped !== undefined && mapped !== null) result.push(mapped);
		}
		return result;
	}

	if ("os_filter" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_filter as unknown[];
		if (!Array.isArray(args) || args.length < 3) return [];
		const arr = evalExpr(args[0], ctx);
		const name = String(args[1] ?? "item");
		const predicate = args[2];
		if (!Array.isArray(arr)) return [];
		return arr.filter((item) =>
			isTruthy(evalExpr(predicate, { ...ctx, [name]: item })),
		);
	}

	if ("os_distinct" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_distinct;
		const value = Array.isArray(args) ? evalExpr(args[0], ctx) : evalExpr(args, ctx);
		if (!Array.isArray(value)) return [];
		const seen = new Set<string>();
		const result: unknown[] = [];
		for (const item of value) {
			const key = JSON.stringify(item);
			if (seen.has(key)) continue;
			seen.add(key);
			result.push(item);
		}
		return result;
	}

	if ("os_count" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_count;
		const value = Array.isArray(args) ? evalExpr(args[0], ctx) : evalExpr(args, ctx);
		if (Array.isArray(value) || typeof value === "string") return value.length;
		if (isPlainObject(value)) return Object.keys(value).length;
		return value === null || value === undefined ? 0 : 1;
	}

	if ("os_first" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_first;
		const value = Array.isArray(args) ? evalExpr(args[0], ctx) : evalExpr(args, ctx);
		return Array.isArray(value) ? (value[0] ?? null) : null;
	}

	if ("os_includes" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_includes;
		if (!Array.isArray(args) || args.length < 2) return false;
		const collection = evalExpr(args[0], ctx);
		const needle = evalExpr(args[1], ctx);
		return Array.isArray(collection)
			? collection.some((item) => deepEqual(item, needle))
			: typeof collection === "string" && typeof needle === "string"
				? collection.includes(needle)
				: false;
	}

	if ("os_without" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_without;
		if (!Array.isArray(args) || args.length < 2) return [];
		const left = evalExpr(args[0], ctx);
		const right = evalExpr(args[1], ctx);
		if (!Array.isArray(left)) return [];
		const exclusions = Array.isArray(right) ? right : [];
		return left.filter(
			(item) => !exclusions.some((excluded) => deepEqual(item, excluded)),
		);
	}

	if ("os_some" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_some as unknown[];
		if (!Array.isArray(args) || args.length < 3) return false;
		const arr = evalExpr(args[0], ctx);
		const name = String(args[1] ?? "item");
		const predicate = args[2];
		return Array.isArray(arr)
			? arr.some((item) => isTruthy(evalExpr(predicate, { ...ctx, [name]: item })))
			: false;
	}

	if ("os_if" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_if as unknown[];
		if (!Array.isArray(args) || args.length < 2) return null;
		return isTruthy(evalExpr(args[0], ctx))
			? evalExpr(args[1], ctx)
			: evalExpr(args[2], ctx);
	}

	if ("os_entries" in obj && Object.keys(obj).length === 1) {
		const args = obj.os_entries;
		const value = Array.isArray(args) ? evalExpr(args[0], ctx) : evalExpr(args, ctx);
		if (!isPlainObject(value)) return [];
		return Object.entries(value).map(([key, entryValue]) => ({
			key,
			value: entryValue,
		}));
	}

	// Fall through: return the object as-is
	return obj;
}

function splitWords(value: string): string[] {
	return value
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.split(/[^a-zA-Z0-9]+/)
		.filter((word) => word.length > 0);
}

function isTruthy(value: unknown): boolean {
	if (value === null || value === undefined || value === false) return false;
	if (Array.isArray(value)) return value.length > 0;
	return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepObjectIncludes(
	object: Record<string, unknown>,
	subset: Record<string, unknown>,
): boolean {
	for (const [key, expected] of Object.entries(subset)) {
		if (!(key in object)) return false;
		const actual = object[key];
		if (isPlainObject(actual) && isPlainObject(expected)) {
			if (!deepObjectIncludes(actual, expected)) return false;
			continue;
		}
		if (!deepEqual(actual, expected)) return false;
	}
	return true;
}

function deepEqual(left: unknown, right: unknown): boolean {
	if (left === right) return true;
	if (Array.isArray(left) && Array.isArray(right)) {
		if (left.length !== right.length) return false;
		return left.every((item, index) => deepEqual(item, right[index]));
	}
	if (isPlainObject(left) && isPlainObject(right)) {
		const leftKeys = Object.keys(left);
		const rightKeys = Object.keys(right);
		if (leftKeys.length !== rightKeys.length) return false;
		return leftKeys.every((key) => deepEqual(left[key], right[key]));
	}
	return false;
}

function getPath(data: unknown, path: string): unknown {
	if (!path) return data;
	const parts = path.split(".");
	let current = data;
	for (const part of parts) {
		if (current === null || current === undefined) return undefined;
		if (typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}
