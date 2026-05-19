/**
 * Mini-language evaluator for OpenSpec lowering map expressions.
 *
 * Handles the following `kind` values in *.graph.openspec.yml fact templates:
 *   path | literal | concat | after | pascal | camel | kebab | object |
 *   objectFromEntries | array | arrayConcat | when | equals | is | match |
 *   call | map | find | deepCollect
 *
 * Designed to be purely synchronous — no external evaluator needed.
 */

export type MiniContext = Record<string, unknown>;

export type NamedExprDef = {
	input: string;
	value: unknown;
};

export function evalMini(
	expr: unknown,
	ctx: MiniContext,
	namedExprs: Record<string, NamedExprDef> = {},
): unknown {
	if (!isRecord(expr)) return expr;

	if ("kind" in expr) {
		const kind = (expr as { kind: string }).kind;
		switch (kind) {
			case "literal":
				return (expr as { value: unknown }).value;

			case "path": {
				const path = (expr as { path: string; optional?: boolean }).path;
				const pathExpr = expr as {
					default?: unknown;
					optional?: boolean;
					path: string;
				};
				const optional = pathExpr.optional ?? false;
				const value = getPath(ctx, path);
				if (value === undefined || value === null) {
					if ("default" in pathExpr) {
						return evalMini(pathExpr.default, ctx, namedExprs);
					}
					return optional ? null : null;
				}
				return value;
			}

			case "concat": {
				const items = (expr as { items: unknown[] }).items ?? [];
				return items.map((item) => evalMini(item, ctx, namedExprs)).join("");
			}

			case "after": {
				const afterExpr = expr as {
					value: unknown;
					separator: string;
					optional?: boolean;
				};
				const value = evalMini(afterExpr.value, ctx, namedExprs);
				if (typeof value !== "string") {
					if (afterExpr.optional) return "";
					throw new Error(`after: expected string, got ${typeof value}`);
				}
				const index = value.indexOf(afterExpr.separator);
				if (index < 0) {
					if (afterExpr.optional) return value;
					throw new Error(
						`after: separator "${afterExpr.separator}" not found in "${value}"`,
					);
				}
				return value.slice(index + afterExpr.separator.length);
			}

			case "pascal": {
				const value = evalMini((expr as { value: unknown }).value, ctx, namedExprs);
				return toPascalCase(typeof value === "string" ? value : "");
			}

			case "camel": {
				const value = evalMini((expr as { value: unknown }).value, ctx, namedExprs);
				return toCamelCase(typeof value === "string" ? value : "");
			}

			case "kebab": {
				const value = evalMini((expr as { value: unknown }).value, ctx, namedExprs);
				return toKebabCase(typeof value === "string" ? value : "");
			}

			case "array": {
				const items = (expr as { items: unknown[] }).items ?? [];
				return items.map((item) => evalMini(item, ctx, namedExprs));
			}

			case "arrayConcat": {
				const items = (expr as { items: unknown[] }).items ?? [];
				const result: unknown[] = [];
				for (const item of items) {
					const value = evalMini(item, ctx, namedExprs);
					if (Array.isArray(value)) result.push(...value);
					else if (value !== null && value !== undefined) result.push(value);
				}
				return result;
			}

			case "object": {
				const fields =
					(expr as { fields: Record<string, unknown> }).fields ?? {};
				const result: Record<string, unknown> = {};
				for (const [key, fieldExpr] of Object.entries(fields)) {
					const value = evalMini(fieldExpr, ctx, namedExprs);
					if (value !== undefined) result[key] = value;
				}
				return result;
			}

			case "objectFromEntries": {
				const objectFromEntriesExpr = expr as {
					path: string;
					as: string;
					key: unknown;
					value: unknown;
					where?: unknown;
					optional?: boolean;
				};
				const items = getPath(ctx, objectFromEntriesExpr.path);
				if (!Array.isArray(items)) return {};
				const result: Record<string, unknown> = {};
				for (const item of items) {
					const itemCtx = { ...ctx, [objectFromEntriesExpr.as]: item };
					if (
						objectFromEntriesExpr.where !== undefined &&
						!isTruthy(evalMini(objectFromEntriesExpr.where, itemCtx, namedExprs))
					) {
						continue;
					}
					const key = evalMini(objectFromEntriesExpr.key, itemCtx, namedExprs);
					if (key === null || key === undefined) continue;
					result[String(key)] = evalMini(
						objectFromEntriesExpr.value,
						itemCtx,
						namedExprs,
					);
				}
				return result;
			}

			case "when": {
				const cond = evalMini(
					(expr as { condition: unknown }).condition,
					ctx,
					namedExprs,
				);
				if (isTruthy(cond)) {
					return evalMini((expr as { then: unknown }).then, ctx, namedExprs);
				}
				const elseExpr = (expr as { else?: unknown }).else;
				return elseExpr !== undefined
					? evalMini(elseExpr, ctx, namedExprs)
					: null;
			}

			case "equals": {
				const left = evalMini(
					(expr as { left: unknown }).left,
					ctx,
					namedExprs,
				);
				const right = evalMini(
					(expr as { right: unknown }).right,
					ctx,
					namedExprs,
				);
				return left === right;
			}

			case "is": {
				const value = evalMini(
					(expr as { value: unknown }).value,
					ctx,
					namedExprs,
				);
				const type = (expr as { type?: string }).type;
				return type !== undefined
					? typeof value === type
					: value !== null && value !== undefined;
			}

			case "match": {
				const matchExpr = expr as {
					value: unknown;
					cases: Record<string, unknown>;
					default?: unknown;
				};
				const matchValue = evalMini(matchExpr.value, ctx, namedExprs);
				const key = typeof matchValue === "string" ? matchValue : null;
				if (key !== null && key in matchExpr.cases) {
					return evalMini(matchExpr.cases[key], ctx, namedExprs);
				}
				return matchExpr.default !== undefined
					? evalMini(matchExpr.default, ctx, namedExprs)
					: null;
			}

			case "call": {
				const name = (expr as { name: string }).name;
				const inputExpr = (expr as { input: unknown }).input;
				const inputValue = evalMini(inputExpr, ctx, namedExprs);
				const def = namedExprs[name];
				if (!def) return null;
				return evalMini(def.value, { [def.input]: inputValue }, namedExprs);
			}

			case "map": {
				const mapExpr = expr as {
					path: string;
					as: string;
					value: unknown;
					where?: unknown;
					optional?: boolean;
				};
				const arr = getPath(ctx, mapExpr.path);
				if (!Array.isArray(arr)) return mapExpr.optional ? [] : [];
				return arr.flatMap((item) => {
					const itemCtx = { ...ctx, [mapExpr.as]: item };
					if (
						mapExpr.where !== undefined &&
						!isTruthy(evalMini(mapExpr.where, itemCtx, namedExprs))
					) {
						return [];
					}
					return [evalMini(mapExpr.value, itemCtx, namedExprs)];
				});
			}

			case "find": {
				const findExpr = expr as {
					path: string;
					as: string;
					condition: unknown;
					value?: unknown;
					default?: unknown;
					optional?: boolean;
				};
				const arr = getPath(ctx, findExpr.path);
				if (!Array.isArray(arr)) {
					return "default" in findExpr
						? evalMini(findExpr.default, ctx, namedExprs)
						: null;
				}
				for (const item of arr) {
					const itemCtx = { ...ctx, [findExpr.as]: item };
					if (isTruthy(evalMini(findExpr.condition, itemCtx, namedExprs))) {
						return "value" in findExpr
							? evalMini(findExpr.value, itemCtx, namedExprs)
							: item;
					}
				}
				return "default" in findExpr
					? evalMini(findExpr.default, ctx, namedExprs)
					: null;
			}

			case "deepCollect": {
				const dcExpr = expr as {
					path: string;
					select: unknown;
					optional?: boolean;
				};
				const root = getPath(ctx, dcExpr.path);
				if (root === undefined || root === null) return dcExpr.optional ? [] : [];
				const collected: unknown[] = [];
				function traverse(node: unknown): void {
					if (node === null || node === undefined) return;
					const nodeCtx = { ...ctx, $node: node };
					const selected = evalMini(dcExpr.select, nodeCtx, namedExprs);
					if (selected !== null && selected !== undefined) collected.push(selected);
					if (Array.isArray(node)) {
						for (const child of node) traverse(child);
					} else if (isRecord(node)) {
						for (const value of Object.values(node)) traverse(value);
					}
				}
				traverse(root);
				return collected;
			}

			default:
				throw new Error(
					`mini-lang: unknown expression kind "${kind}". Valid kinds: literal, path, concat, after, pascal, camel, kebab, array, arrayConcat, object, objectFromEntries, when, equals, is, match, call, map, find, deepCollect`,
				);
		}
	}

	// Not a mini-lang expression with a known kind — return as literal
	return expr;
}

export function getPath(obj: unknown, path: string): unknown {
	if (!path) return obj;
	const parts = path.split(".");
	let current = obj;
	for (const part of parts) {
		if (current === null || current === undefined) return undefined;
		if (!isRecord(current)) return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

function isTruthy(value: unknown): boolean {
	if (value === null || value === undefined || value === false) return false;
	if (Array.isArray(value)) return value.length > 0;
	return true;
}

function toPascalCase(value: string): string {
	return words(value)
		.filter(Boolean)
		.map(capitalizeWord)
		.join("");
}

function toCamelCase(value: string): string {
	const parts = words(value);
	const [first, ...rest] = parts;
	if (!first) return "";
	return [
		first.toLowerCase(),
		...rest.map(capitalizeWord),
	].join("");
}

function toKebabCase(value: string): string {
	return words(value)
		.map((part) => part.toLowerCase())
		.join("-");
}

function words(value: string): string[] {
	return (
		value.match(
			/[A-Z]+(?=[A-Z][a-z0-9]|[^A-Za-z0-9]|$)|[A-Z]?[a-z]+|[0-9]+/g,
		) ?? []
	);
}

function capitalizeWord(value: string): string {
	const lower = value.toLowerCase();
	return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
