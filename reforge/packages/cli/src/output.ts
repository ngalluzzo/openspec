/**
 * Terminal output helpers — ANSI colours, progress reporting, summary table.
 * Auto-disables colour when NO_COLOR is set or stdout is not a TTY.
 */

const useColor = !process.env.NO_COLOR && process.stdout.isTTY;

const c = {
	reset: useColor ? "\x1b[0m" : "",
	bold: useColor ? "\x1b[1m" : "",
	dim: useColor ? "\x1b[2m" : "",
	green: useColor ? "\x1b[32m" : "",
	yellow: useColor ? "\x1b[33m" : "",
	red: useColor ? "\x1b[31m" : "",
	cyan: useColor ? "\x1b[36m" : "",
	gray: useColor ? "\x1b[90m" : "",
};

export function bold(s: string) {
	return `${c.bold}${s}${c.reset}`;
}
export function dim(s: string) {
	return `${c.dim}${s}${c.reset}`;
}
export function green(s: string) {
	return `${c.green}${s}${c.reset}`;
}
export function yellow(s: string) {
	return `${c.yellow}${s}${c.reset}`;
}
export function red(s: string) {
	return `${c.red}${s}${c.reset}`;
}
export function cyan(s: string) {
	return `${c.cyan}${s}${c.reset}`;
}
export function gray(s: string) {
	return `${c.gray}${s}${c.reset}`;
}

// ─── File result lines ────────────────────────────────────────────────────────

export function formatChanged(filePath: string, dryRun: boolean): string {
	const tag = dryRun ? yellow("[dry]") : green("  ok ");
	return `${tag} ${filePath}`;
}

export function formatUnchanged(filePath: string): string {
	return `${gray("  --")} ${gray(filePath)}`;
}

export function formatSkipped(filePath: string, reason: string): string {
	return `${yellow("skip")} ${filePath} ${dim(`(${reason})`)}`;
}

export function formatError(filePath: string, err: unknown): string {
	const msg = err instanceof Error ? err.message : String(err);
	return `${red(" err")} ${filePath}\n     ${dim(msg)}`;
}

// ─── Diff display ─────────────────────────────────────────────────────────────

export function formatDiff(diff: string): string {
	return diff
		.split("\n")
		.map((line) => {
			if (line.startsWith("+++") || line.startsWith("---")) return gray(line);
			if (line.startsWith("@@")) return cyan(line);
			if (line.startsWith("+")) return green(line);
			if (line.startsWith("-")) return red(line);
			return dim(line);
		})
		.join("\n");
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export function formatSummary(opts: {
	total: number;
	changed: number;
	unchanged: number;
	skipped: number;
	errored: number;
	durationMs: number;
	dryRun: boolean;
}): string {
	const { total, changed, unchanged, skipped, errored, durationMs, dryRun } =
		opts;
	const dur =
		durationMs < 1000
			? `${durationMs}ms`
			: `${(durationMs / 1000).toFixed(1)}s`;

	const changedLabel = dryRun ? "would change" : "changed";
	const lines = [
		"",
		bold("Results"),
		`  ${green(String(changed).padStart(5))}  ${changedLabel}`,
		`  ${dim(String(unchanged).padStart(5))}  unchanged`,
		skipped > 0 ? `  ${yellow(String(skipped).padStart(5))}  skipped` : null,
		errored > 0 ? `  ${red(String(errored).padStart(5))}  errored` : null,
		`  ${dim("─────")}`,
		`  ${String(total).padStart(5)}  total  ${dim(dur)}`,
		"",
	].filter((l): l is string => l !== null);

	if (dryRun) {
		lines.push(yellow("Dry run — no files were written."), "");
	}

	return lines.join("\n");
}

// ─── Help ─────────────────────────────────────────────────────────────────────

export const HELP = `
${bold("reforge")} — format-preserving codemod runner

${bold("Usage")}
  reforge -t <transform> [patterns...] [options]

${bold("Options")}
  -t, --transform <file>   Transform file to run (required)
  -d, --dry-run            Preview changes without writing
  -j, --concurrency <n>    Parallel workers (default: 8)
      --ext <exts>         Comma-separated extensions (default: ts,tsx,js,jsx)
  -i, --ignore <glob>      Glob pattern to exclude (repeatable)
  -v, --verbose            Show unchanged files and diffs
  -h, --help               Show this help
      --version            Show version

${bold("Transform file format")}
  Your transform file must export a default function:

  ${cyan("// my-transform.ts")}
  ${cyan("export default function({ query, filePath, snippet }) {")}
  ${cyan('  query.find("ImportDeclaration[moduleSpecifier=lodash]")')}
  ${cyan('       .mutate(p => { p.node.moduleSpecifier = "lodash-es"; });')}
  ${cyan("}")}

${bold("Examples")}
  reforge -t ./transforms/rename-import.ts src/
  reforge -t ./transforms/add-types.ts "**/*.js" --ext js --dry-run
  reforge -t ./transforms/cleanup.ts src/ --ignore "**/*.test.ts"
`.trimStart();
