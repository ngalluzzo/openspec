#!/usr/bin/env bun
/**
 * Generates a portable Expresso operator spec (operators.spec.json).
 *
 * The spec serializes every registered operator's Zod inputSchema /
 * outputSchema to JSON Schema (via z.toJSONSchema) and bundles them with
 * operator metadata and TDD-ready test cases. The result is language-agnostic:
 * Python, Rust, Go, etc. can load the file and drive implementation with TDD.
 *
 * Usage:
 *   bun scripts/gen-spec.ts [--output <path>] [--include-deprecated]
 *
 * Defaults:
 *   --output  ../../../../../generated/operators.spec.json  (repo-level generated/ dir)
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stdPlugins } from "@gooi/expresso-std";
import { DocumentationGenerator } from "../src/documentation/generator";

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function flag(name: string): boolean {
	return args.includes(name);
}

function option(name: string, fallback: string): string {
	const idx = args.indexOf(name);
	return idx !== -1 && args[idx + 1] !== undefined
		? (args[idx + 1] as string)
		: fallback;
}

const includeDeprecated = flag("--include-deprecated");
const outputPath = resolve(
	option(
		"--output",
		resolve(import.meta.dir, "../../../../../generated/operators.spec.json"),
	),
);

// ---------------------------------------------------------------------------
// Bootstrap: register all std plugins so the registry is populated
// ---------------------------------------------------------------------------

console.log("Loading expresso-std plugins...");
for (const plugin of stdPlugins) {
	plugin.register();
}
console.log(`  ${stdPlugins.length} plugins registered`);

// ---------------------------------------------------------------------------
// Generate spec
// ---------------------------------------------------------------------------

const generator = new DocumentationGenerator();
const spec = generator.generateJSONSchema({ includeDeprecated });

const operatorCount = Object.keys(
	(spec as { operators: Record<string, unknown> }).operators,
).length;

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

const outputDir = dirname(outputPath);
if (!existsSync(outputDir)) {
	mkdirSync(outputDir, { recursive: true });
}

writeFileSync(outputPath, JSON.stringify(spec, null, 2), "utf-8");

console.log(`\nSpec written to: ${outputPath}`);
console.log(`  operators : ${operatorCount}`);
console.log(
	`  categories: ${Object.keys((spec as { categories: Record<string, unknown> }).categories).length}`,
);
console.log(
	`  deprecated: ${includeDeprecated ? "included" : "excluded (pass --include-deprecated to include)"}`,
);
