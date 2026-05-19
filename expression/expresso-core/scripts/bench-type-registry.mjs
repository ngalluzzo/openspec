#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");
const benchRoot = join(packageRoot, ".bench-tmp");
const sizes = process.argv
	.slice(2)
	.map((value) => Number(value))
	.filter((value) => Number.isInteger(value) && value > 0);
const targets = sizes.length > 0 ? sizes : [100, 1000, 5000];

function descriptorLine(index) {
	return `	{ id: "op_${index}" } as OperatorTypeDescriptor<"op_${index}", readonly [number], number>,`;
}

function generateBenchSource(size) {
	const lines = [];
	for (let i = 0; i < size; i += 1) {
		lines.push(descriptorLine(i));
	}

	const middle = Math.floor(size / 2);
	const last = size - 1;

	return `import {
	type OperatorTypeDescriptor,
	createOperatorTypeRegistry,
} from "../src/runtime/compile/operator-types";
import { expr } from "../src/runtime/compile/expr";

type Input = { readonly value: number };

const registry = createOperatorTypeRegistry([
${lines.join("\n")}
] as const);

const typed = expr<Input>().withOperators(registry);

export const sample = [
	typed.op("op_0", 1).toRule(),
	typed.op("op_${middle}", 2).toRule(),
	typed.op("op_${last}", 3).toRule(),
];

export type RegistryId = typeof registry.descriptors[number]["id"];
export type RegistryDescriptor = (typeof registry.descriptors)[number];
`;
}

function runTypecheck(filePath) {
	const started = performance.now();
	const result = spawnSync(
		"bun",
		[
			"x",
			"tsc",
			"--noEmit",
			"--pretty",
			"false",
			"--skipLibCheck",
			"true",
			"--module",
			"ESNext",
			"--moduleResolution",
			"Bundler",
			"--target",
			"ES2022",
			"--strict",
			"--types",
			"bun",
			filePath,
		],
		{
			cwd: packageRoot,
			encoding: "utf-8",
		},
	);
	const elapsedMs = Math.round(performance.now() - started);

	if (result.status !== 0) {
		process.stderr.write(result.stdout ?? "");
		process.stderr.write(result.stderr ?? "");
		throw new Error(`typecheck failed for ${filePath}`);
	}

	return elapsedMs;
}

function main() {
	rmSync(benchRoot, { recursive: true, force: true });
	mkdirSync(benchRoot, { recursive: true });

	const rows = [];
	for (const size of targets) {
		const filePath = join(benchRoot, `registry-${size}.ts`);
		writeFileSync(filePath, generateBenchSource(size), "utf-8");
		const elapsedMs = runTypecheck(filePath);
		rows.push({ size, elapsedMs });
	}

	console.log("Type Registry Typecheck Benchmark");
	console.log("");
	console.log("| descriptors | tsc_ms |");
	console.log("|---:|---:|");
	for (const row of rows) {
		console.log(`| ${row.size} | ${row.elapsedMs} |`);
	}

	if (process.env.EXPRESSO_BENCH_KEEP !== "1") {
		rmSync(benchRoot, { recursive: true, force: true });
	}
}

main();
