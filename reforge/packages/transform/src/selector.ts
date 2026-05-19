/**
 * Selector parser for the reforge query DSL.
 *
 * Supports a deliberate subset of CSS attribute selector syntax applied to AST nodes:
 *
 *   "FunctionDeclaration"
 *   "FunctionDeclaration[async]"
 *   "CallExpression[callee.name=require]"
 *   "ImportDeclaration[moduleSpecifier=lodash][importKind=value]"
 *
 * Dot-notation in attribute names resolves nested properties:
 *   [callee.name=require]  →  node.callee.name === "require"
 *
 * No value means existence check:
 *   [async]  →  node.async !== undefined && node.async !== false
 *
 * Design constraint: the parser must be zero-dependency and ~100 lines.
 * Anything the string syntax can't express falls through to .where() predicates.
 */

export interface ParsedSelector {
	/** The node type string to match. e.g. "FunctionDeclaration" */
	type: string;
	/** Attribute constraints, all must pass (AND semantics) */
	attrs: AttributeConstraint[];
}

export type AttributeConstraint =
	| { kind: "exists"; path: string[] }
	| { kind: "eq"; path: string[]; value: string };

/**
 * Parse a selector string into a structured form.
 * Throws a descriptive error on malformed input.
 */
export function parseSelector(selector: string): ParsedSelector {
	selector = selector.trim();
	if (!selector) throw new SelectorParseError("Selector cannot be empty");

	// Split on the first "[" to get the type prefix
	const bracketIdx = selector.indexOf("[");
	const typePart = bracketIdx === -1 ? selector : selector.slice(0, bracketIdx);

	const type = typePart.trim();
	if (!type)
		throw new SelectorParseError(
			`Missing node type in selector: "${selector}"`,
		);
	if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(type)) {
		throw new SelectorParseError(
			`Invalid node type "${type}" — must be a valid identifier (e.g. "FunctionDeclaration")`,
		);
	}

	const attrs: AttributeConstraint[] = [];

	if (bracketIdx !== -1) {
		const attrPart = selector.slice(bracketIdx);
		parseAttributes(attrPart, attrs, selector);
	}

	return { type, attrs };
}

/**
 * Test a node against a parsed selector.
 * The adapter's typeOf() provides the node's type name.
 */
export function matchesSelector<TNode extends object>(
	node: TNode,
	selector: ParsedSelector,
	typeOf: (n: TNode) => string,
): boolean {
	if (typeOf(node) !== selector.type) return false;

	for (const attr of selector.attrs) {
		const actual = resolvePath(node, attr.path);
		if (attr.kind === "exists") {
			if (actual === undefined || actual === false || actual === null)
				return false;
		} else {
			// Coerce to string for comparison — handles numbers, booleans, enums
			if (String(actual) !== attr.value) return false;
		}
	}

	return true;
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parseAttributes(
	input: string,
	out: AttributeConstraint[],
	fullSelector: string,
): void {
	// Walk character-by-character through "[attr]" and "[attr=value]" blocks
	let i = 0;

	while (i < input.length) {
		if (input[i] !== "[") {
			throw new SelectorParseError(
				`Unexpected character "${input[i]}" at position ${i} in selector "${fullSelector}"`,
			);
		}

		const closeIdx = input.indexOf("]", i);
		if (closeIdx === -1) {
			throw new SelectorParseError(
				`Unclosed "[" in selector "${fullSelector}"`,
			);
		}

		const content = input.slice(i + 1, closeIdx).trim();
		if (!content) {
			throw new SelectorParseError(
				`Empty attribute brackets in selector "${fullSelector}"`,
			);
		}

		const eqIdx = content.indexOf("=");

		if (eqIdx === -1) {
			// Existence check: [async]
			const pathStr = content.trim();
			validateAttrPath(pathStr, fullSelector);
			out.push({ kind: "exists", path: pathStr.split(".") });
		} else {
			// Equality check: [callee.name=require]
			const pathStr = content.slice(0, eqIdx).trim();
			const value = content.slice(eqIdx + 1).trim();

			validateAttrPath(pathStr, fullSelector);
			if (!value) {
				throw new SelectorParseError(
					`Empty value in attribute "[${content}]" in selector "${fullSelector}"`,
				);
			}

			out.push({ kind: "eq", path: pathStr.split("."), value });
		}

		i = closeIdx + 1;
	}
}

function validateAttrPath(path: string, selector: string): void {
	if (!path) {
		throw new SelectorParseError(
			`Empty attribute name in selector "${selector}"`,
		);
	}
	for (const segment of path.split(".")) {
		if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)) {
			throw new SelectorParseError(
				`Invalid attribute path segment "${segment}" in selector "${selector}"`,
			);
		}
	}
}

/**
 * Resolve a dot-separated path on an object.
 * Returns undefined if any segment is missing.
 */
function resolvePath(obj: unknown, path: string[]): unknown {
	let current = obj;
	for (const key of path) {
		if (
			current === null ||
			current === undefined ||
			typeof current !== "object"
		) {
			return undefined;
		}
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}

export class SelectorParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SelectorParseError";
	}
}
