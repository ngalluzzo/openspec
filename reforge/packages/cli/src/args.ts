/**
 * Minimal argv parser — no dependencies.
 *
 * Supports:
 *   --flag           boolean true
 *   --no-flag        boolean false
 *   --key value      string
 *   --key=value      string
 *   positional args  collected into `_`
 */
export interface ParsedArgs {
	_: string[]; // positional arguments
	[key: string]: string | boolean | string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
	const result: ParsedArgs = { _: [] };
	let i = 0;

	while (i < argv.length) {
		const arg = argv[i];

		if (!arg) continue;

		if (arg.startsWith("--")) {
			const withoutDashes = arg.slice(2);

			// --key=value
			const eqIdx = withoutDashes.indexOf("=");
			if (eqIdx !== -1) {
				const key = withoutDashes.slice(0, eqIdx);
				const val = withoutDashes.slice(eqIdx + 1);
				result[camel(key)] = val;
				i++;
				continue;
			}

			// --no-flag
			if (withoutDashes.startsWith("no-")) {
				result[camel(withoutDashes.slice(3))] = false;
				i++;
				continue;
			}

			// --flag (peek next: if it's a value, consume it)
			const next = argv[i + 1];
			if (next !== undefined && !next.startsWith("-")) {
				result[camel(withoutDashes)] = next;
				i += 2;
			} else {
				result[camel(withoutDashes)] = true;
				i++;
			}
			continue;
		}

		// -s (single dash short flags — only boolean for now)
		if (arg.startsWith("-") && arg.length === 2) {
			if (!arg[1]) continue;
			result[arg[1]] = true;
			i++;
			continue;
		}

		result._.push(arg);
		i++;
	}

	return result;
}

function camel(str: string): string {
	return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// ─── CLI options (typed view over ParsedArgs) ─────────────────────────────────

export interface CliOptions {
	/** Path to the transform file */
	transform: string;
	/** Glob patterns (positional args) */
	patterns: string[];
	/** --dry-run */
	dryRun: boolean;
	/** --concurrency N */
	concurrency: number;
	/** --ext comma-separated */
	extensions: string[];
	/** --ignore glob */
	ignore: string[];
	/** --verbose */
	verbose: boolean;
	/** --help */
	help: boolean;
	/** --version */
	version: boolean;
}

export function toCliOptions(args: ParsedArgs): CliOptions {
	return {
		transform: String(args.transform ?? args.t ?? ""),
		patterns: args._.length > 0 ? args._ : ["**/*.ts", "**/*.tsx"],
		dryRun: Boolean(args.dryRun ?? args.d ?? false),
		concurrency: Number(args.concurrency ?? args.j ?? 8),
		extensions: String(args.ext ?? "ts,tsx,js,jsx,mjs,cjs")
			.split(",")
			.map((s) => s.trim()),
		ignore: toArray(args.ignore ?? args.i),
		verbose: Boolean(args.verbose ?? args.v ?? false),
		help: Boolean(args.help ?? args.h ?? false),
		version: Boolean(args.version ?? false),
	};
}

function toArray(v: unknown): string[] {
	if (!v) return [];
	if (Array.isArray(v)) return v.map(String);
	return [String(v)];
}
