import type { MutationRecord } from "./path.js";
import type { IOriginalSourceMap as OriginalSourceMap } from "@reforge/core";

/**
 * Apply all recorded mutations to the AST in a single pass.
 *
 * Mutations are recorded during the walk as intents (replace, remove,
 * insertBefore, insertAfter) rather than applied immediately. This
 * prevents mid-walk mutations from corrupting the traversal cursor.
 *
 * Reconciliation rules:
 * 1. Process removes and replacements before insertions.
 * 2. For array operations, work back-to-front so earlier indices
 *    stay valid as we splice.
 * 3. After each mutation, mark affected nodes in the OriginalSourceMap.
 * 4. If two mutations target the same node, last-write-wins with a warning.
 */
export function reconcile<TNode extends object>(
	mutations: MutationRecord<TNode>[],
	originalMap: OriginalSourceMap<TNode>,
): void {
	if (mutations.length === 0) return;

	// Deduplicate: if the same node is targeted twice, keep the last mutation
	// and warn. Deterministic behaviour is better than a silent conflict.
	const byNode = new Map<TNode, MutationRecord<TNode>>();
	for (const mut of mutations) {
		const key = mut.path.node;
		if (byNode.has(key)) {
			console.warn(
				`[reforge] Multiple mutations targeting the same node ` +
					`(${mut.kind} over ${byNode.get(key)?.kind}) — keeping last.`,
			);
		}
		byNode.set(key, mut);
	}

	// Separate into array ops (need index-aware splicing) and property ops
	const arrayOps: MutationRecord<TNode>[] = [];
	const propOps: MutationRecord<TNode>[] = [];

	for (const mut of byNode.values()) {
		if (mut.path.index !== null) {
			arrayOps.push(mut);
		} else {
			propOps.push(mut);
		}
	}

	// ── Property mutations (replace on named key) ────────────────────────────
	for (const mut of propOps) {
		const { path } = mut;
		if (!path.parent || !path.key) continue;
		const parent = path.parent as Record<string, unknown>;

		if (mut.kind === "replace") {
			parent[path.key] = mut.replacement;
			originalMap.markNew(mut.replacement);
		} else if (mut.kind === "remove") {
			// Setting a required property to undefined will likely cause
			// downstream errors — the caller's problem, not ours.
			parent[path.key] = undefined;
		}
		// insertBefore/After on non-array nodes validated away in Path
	}

	// ── Array mutations ───────────────────────────────────────────────────────
	// Group by (parent, key) so we splice each array once.
	type ArrayKey = string;
	const groups = new Map<
		ArrayKey,
		{
			arr: TNode[];
			parent: TNode;
			key: string;
			ops: MutationRecord<TNode>[];
		}
	>();

	for (const mut of arrayOps) {
		const { path } = mut;
		if (!path.parent || !path.key || path.index === null) continue;
		const groupKey: ArrayKey = `${String(path.parent)}::${path.key}`;

		if (!groups.has(groupKey)) {
			const arr = (path.parent as Record<string, unknown>)[path.key] as TNode[];
			groups.set(groupKey, {
				arr,
				parent: path.parent,
				key: path.key,
				ops: [],
			});
		}
		groups.get(groupKey)?.ops.push(mut);
	}

	for (const { arr, parent, key, ops } of groups.values()) {
		// Sort descending by index so splices don't shift earlier indices
		ops.sort((a, b) => (b.path.index ?? 0) - (a.path.index ?? 0));

		for (const mut of ops) {
			const idx = mut.path.index;
			if (idx == null) continue;

			switch (mut.kind) {
				case "replace":
					arr[idx] = mut.replacement;
					originalMap.markNew(mut.replacement);
					break;

				case "remove":
					arr.splice(idx, 1);
					break;

				case "insertBefore":
					arr.splice(idx, 0, mut.node);
					originalMap.markNew(mut.node);
					break;

				case "insertAfter":
					arr.splice(idx + 1, 0, mut.node);
					originalMap.markNew(mut.node);
					break;
			}
		}

		// Write the mutated array back (in case it was a copy)
		(parent as Record<string, unknown>)[key] = arr;
	}
}
