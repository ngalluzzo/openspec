import { parse, print, snippet as coreSnippet } from "@reforge/core";
import { createQuery } from "../query.js";
import { unifiedDiff } from "./diff.js";
import type { CodemodOptions, FileResult, TransformContext } from "./types.js";

/**
 * Process a single file through the transform pipeline.
 *
 * Pure(-ish) function: reads source, runs transform, returns a result.
 * Writing to disk is the runner's job, not this function's.
 */
export async function processFile<TNode extends object>(
	filePath: string,
	source: string,
	options: CodemodOptions<TNode>,
): Promise<FileResult> {
	const adapter = options.adapterFor(filePath);

	if (!adapter) {
		return {
			kind: "skipped",
			filePath,
			reason: "no adapter returned for file",
		};
	}

	let parsed: ReturnType<typeof parse<TNode>>;
	try {
		parsed = parse(source, { adapter });
	} catch (err) {
		// Parse failure treated as skip with reason, not an error —
		// malformed files shouldn't crash the whole codemod run.
		return {
			kind: "skipped",
			filePath,
			reason: `parse failed: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	const query = createQuery(parsed);

	const ctx: TransformContext<TNode> = {
		source,
		filePath,
		adapter,
		query,
		snippet: (src) => coreSnippet(src, { adapter }),
	};

	await options.transform(ctx);

	const { code: output } = print(parsed);

	if (output === source) {
		return { kind: "unchanged", filePath };
	}

	const diff = unifiedDiff(source, output, {
		fromFile: filePath,
		toFile: filePath,
	});

	return { kind: "changed", filePath, output, diff };
}
