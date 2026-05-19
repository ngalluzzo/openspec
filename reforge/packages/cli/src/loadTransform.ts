import { isAbsolute, resolve } from "node:path";
import type { TransformContext } from "@reforge/transform/runner";
import type ts from "typescript";

export type TransformFn = (
	ctx: TransformContext<ts.Node>,
) => void | Promise<void>;

export interface LoadedTransform {
	fn: TransformFn;
	filePath: string;
}

/**
 * Dynamically import a user-supplied transform file and validate its shape.
 *
 * The transform file must export a default function:
 *   export default function({ query, filePath, snippet }) { ... }
 *
 * Works with both .ts files (via tsx/ts-node in the user's environment)
 * and pre-compiled .js files.
 */
export async function loadTransform(pathArg: string): Promise<LoadedTransform> {
	const filePath = isAbsolute(pathArg)
		? pathArg
		: resolve(process.cwd(), pathArg);

	let mod: unknown;
	try {
		mod = await import(filePath);
	} catch (err) {
		throw new TransformLoadError(
			`Could not import transform file: ${filePath}\n` +
				`  ${err instanceof Error ? err.message : String(err)}\n\n` +
				`  Tip: if your transform is a .ts file, run reforge via:\n` +
				`       npx tsx $(which reforge) -t ${pathArg} ...`,
		);
	}

	const modAny = mod as Record<string, unknown> | undefined;
	const fn =
		modAny?.default ??
		modAny?.transform ?? // also accept named export `transform`
		(typeof mod === "function" ? mod : null);

	if (typeof fn !== "function") {
		throw new TransformLoadError(
			`Transform file must export a default function.\n` +
				`  Got: ${typeof fn}\n` +
				`  File: ${filePath}`,
		);
	}

	return { fn: fn as TransformFn, filePath };
}

export class TransformLoadError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TransformLoadError";
	}
}
