import type {
	OriginalSourceMap as IOriginalSourceMap,
	ParserAdapter,
	SourceLocation,
} from "./types.js";

interface OriginalEntry {
	slice: string;
	location: SourceLocation;
	/**
	 * A shallow structural snapshot taken at parse time.
	 * We store a JSON-serialisable fingerprint of the node's
	 * own properties (excluding child nodes) so isModified()
	 * can detect mutations to scalars like identifiers and literals
	 * without a full deep-clone of the tree.
	 */
	fingerprint: string;
}

export class OriginalSourceMap<TNode extends object>
	implements IOriginalSourceMap<TNode>
{
	private readonly entries = new WeakMap<object, OriginalEntry>();
	private readonly newNodes = new WeakSet<object>();
	private readonly adapter: ParserAdapter<TNode>;
	private readonly source: string;

	constructor(adapter: ParserAdapter<TNode>, source: string) {
		this.adapter = adapter;
		this.source = source;
	}

	/**
	 * Called once per node during the initial parse walk.
	 * Snapshots the source slice and a scalar fingerprint.
	 */
	snapshot(node: TNode): void {
		const loc = this.adapter.locate(node);
		if (!loc) return; // synthetic nodes some parsers emit — skip

		const slice = this.source.slice(loc.start.offset, loc.end.offset);
		const fingerprint = this.fingerprint(node);

		this.entries.set(node, { slice, location: loc, fingerprint });
	}

	originalSlice(node: TNode): string | null {
		return this.entries.get(node)?.slice ?? null;
	}

	originalLocation(node: TNode): SourceLocation | null {
		return this.entries.get(node)?.location ?? null;
	}

	isModified(node: TNode): boolean {
		if (this.newNodes.has(node)) return true;
		const entry = this.entries.get(node);
		if (!entry) return true; // no entry = new node
		return this.fingerprint(node) !== entry.fingerprint;
	}

	markNew(node: TNode): void {
		this.newNodes.add(node);
	}

	/**
	 * Produces a stable string fingerprint of a node's scalar properties.
	 *
	 * We intentionally skip child-node properties — those are handled
	 * recursively by the printer when it walks the tree. We only need
	 * to detect mutations to the node's own values: identifier names,
	 * literal values, operator strings, flag booleans, etc.
	 *
	 * Strategy: ask the adapter for the node's type + location, then
	 * JSON-serialize all own enumerable properties that are primitives.
	 * This is fast (no deep clone) and catches the mutations that matter.
	 */
	private fingerprint(node: TNode): string {
		const type = this.adapter.typeOf(node);
		const primitives: Record<string, unknown> = { __type: type };

		for (const [key, value] of Object.entries(node)) {
			if (
				value === null ||
				typeof value === "string" ||
				typeof value === "number" ||
				typeof value === "boolean"
			) {
				primitives[key] = value;
			}
		}

		return JSON.stringify(primitives);
	}
}
