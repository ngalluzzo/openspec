import { cssAdapter } from "@reforge/adapters/css";
import { tsAdapter } from "@reforge/adapters/typescript";
import type { ParserAdapter } from "@reforge/core";
import { codemod } from "@reforge/transform/runner";
import type { CliOptions } from "./args.js";
import { loadTransform, TransformLoadError } from "./loadTransform.js";
import {
	dim,
	formatChanged,
	formatDiff,
	formatError,
	formatSkipped,
	formatSummary,
	formatUnchanged,
	HELP,
	red,
} from "./output.js";

// ─── Built-in adapter registry ────────────────────────────────────────────────

const ADAPTER_MAP: Record<string, ParserAdapter<any>> = {
	".ts": tsAdapter,
	".tsx": tsAdapter,
	".js": tsAdapter,
	".jsx": tsAdapter,
	".mjs": tsAdapter,
	".cjs": tsAdapter,
	".css": cssAdapter,
};

function adapterForFile(filePath: string): ParserAdapter<any> | null {
	const ext = `.${filePath.split(".").pop()?.toLowerCase()}`;
	return ADAPTER_MAP[ext] ?? null;
}

// ─── run() ────────────────────────────────────────────────────────────────────

export interface RunResult {
	exitCode: number;
}

export async function run(
	options: CliOptions,
	out = process.stdout,
	err = process.stderr,
): Promise<RunResult> {
	const write = (s: string) => out.write(`${s}\n`);
	const writeErr = (s: string) => err.write(`${s}\n`);

	// ── --help ─────────────────────────────────────────────────────────────────
	if (options.help) {
		write(HELP);
		return { exitCode: 0 };
	}

	// ── --version ──────────────────────────────────────────────────────────────
	if (options.version) {
		// Read from own package.json
		const { createRequire } = await import("node:module");
		const req = createRequire(import.meta.url);
		const pkg = req("../package.json") as { version: string };
		write(`reforge ${pkg.version}`);
		return { exitCode: 0 };
	}

	// ── Validate required args ─────────────────────────────────────────────────
	if (!options.transform) {
		writeErr(red("Error: --transform (-t) is required\n"));
		writeErr(dim('Run "reforge --help" for usage.'));
		return { exitCode: 1 };
	}

	// ── Load transform file ────────────────────────────────────────────────────
	let transformFn: Awaited<ReturnType<typeof loadTransform>>;
	try {
		transformFn = await loadTransform(options.transform);
	} catch (e) {
		if (e instanceof TransformLoadError) {
			writeErr(red("Error: ") + e.message);
			return { exitCode: 1 };
		}
		throw e;
	}

	write(dim(`Transform: ${transformFn.filePath}`));
	write(dim(`Patterns:  ${options.patterns.join(", ")}`));
	if (options.dryRun) write(dim(`Dry run:   yes\n`));
	else write("");

	// ── Run codemod ────────────────────────────────────────────────────────────
	const summary = await codemod({
		include: options.patterns,
		exclude: options.ignore,
		concurrency: options.concurrency,
		dryRun: options.dryRun,
		adapterFor: adapterForFile,

		transform: transformFn.fn,

		onResult(result) {
			if (result.kind === "changed") {
				write(formatChanged(result.filePath, options.dryRun));
				if (options.verbose && result.diff) {
					write(formatDiff(result.diff));
				}
			} else if (result.kind === "unchanged") {
				if (options.verbose) write(formatUnchanged(result.filePath));
			} else if (result.kind === "skipped") {
				if (options.verbose)
					write(formatSkipped(result.filePath, result.reason));
			}
		},

		onError({ filePath, error }) {
			writeErr(formatError(filePath, error));
		},
	});

	// ── Summary ────────────────────────────────────────────────────────────────
	write(formatSummary({ ...summary, dryRun: options.dryRun }));

	return { exitCode: summary.errored > 0 ? 1 : 0 };
}
