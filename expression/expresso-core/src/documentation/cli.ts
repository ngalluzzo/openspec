import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DocumentationGenerator, docsGenerator } from "./generator";
import { createOperatorRegistry } from "../operators/registry";
import type { PluginRegistrationContext } from "../plugin/types";
import type { OperatorMetadata } from "../types/metadata";

function ensureDir(path: string) {
	if (!existsSync(path)) {
		mkdirSync(path, { recursive: true });
	}
}

/**
 * Executes `generateDocs` with the provided inputs.
 *
 * @param type - The `type` argument value.
 *
 * @returns The result produced by `generateDocs`.
 *
 * @example
 * generateDocs(type);
 */

export async function generateDocs(
	input:
		| "all"
		| "markdown"
		| "schema"
		| "types"
		| {
				type?: "all" | "markdown" | "schema" | "types";
				outputDir?: string;
				plugins?: readonly {
					register(context: PluginRegistrationContext): void | Promise<void>;
				}[];
		  } = "all",
) {
	const options =
		typeof input === "string"
			? { type: input, outputDir: undefined, plugins: undefined }
			: input;
	const type = options.type ?? "all";
	const baseDir = resolve(options.outputDir ?? resolve(process.cwd(), "docs"));

	const plugins = options.plugins ?? [];
	const operatorRegistry = createOperatorRegistry();
	if (plugins.length > 0) {
		console.log("Loading plugins...");
		for (const plugin of plugins) {
			plugin.register({ operatorRegistry });
		}
		console.log(`  ${plugins.length} plugins registered`);
	}
	const generator =
		plugins.length > 0
			? new DocumentationGenerator(operatorRegistry)
			: docsGenerator;

	ensureDir(baseDir);

	if (type === "all" || type === "markdown") {
		console.log("Generating Markdown documentation...");
		const markdown = generator.generateMarkdown();
		writeFileSync(resolve(baseDir, "OPERATORS.md"), markdown, "utf-8");
		console.log(`✅ Generated ${resolve(baseDir, "OPERATORS.md")}`);
	}

	if (type === "all" || type === "schema") {
		console.log("Generating JSON Schema...");
		const schema = generator.generateJSONSchema();
		const schemaDir = resolve(baseDir, "schemas");
		ensureDir(schemaDir);
		writeFileSync(
			resolve(schemaDir, "operators.json"),
			JSON.stringify(schema, null, 2),
			"utf-8",
		);
		console.log(`✅ Generated ${resolve(schemaDir, "operators.json")}`);
	}

	if (type === "all" || type === "types") {
		console.log("Generating TypeScript declarations...");
		const types = generator.generateTypeScriptDeclarations();
		const typesDir = resolve(baseDir, "types");
		ensureDir(typesDir);
		writeFileSync(resolve(typesDir, "operators.d.ts"), types, "utf-8");
		console.log(`✅ Generated ${resolve(typesDir, "operators.d.ts")}`);
	}

	console.log("\n🎉 Documentation generation complete!");
}

/**
 * Lists operators.
 *
 * @param category - The `category` argument value.
 * @param tag - The `tag` argument value.
 *
 * @returns The result produced by `listOperators`.
 *
 * @example
 * listOperators(category, tag);
 */

export async function listOperators(
	category?: string | undefined,
	tag?: string | undefined,
) {
	let operators: Map<string, OperatorMetadata>;

	if (category) {
		operators = docsGenerator.getOperatorsByCategory(category);
		console.log(`\nOperators in category "${category}":`);
	} else if (tag) {
		operators = docsGenerator.getOperatorsByTag(tag);
		console.log(`\nOperators with tag "${tag}":`);
	} else {
		operators = docsGenerator.getAllOperators();
		console.log(`\nAll operators (${operators.size}):`);
	}

	console.log("\n");
	for (const [name, metadata] of operators) {
		const deprecated = metadata.deprecated ? " (deprecated)" : "";
		console.log(`  • ${name} - ${metadata.title}${deprecated}`);
	}
}

/**
 * Executes `searchOperators` with the provided inputs.
 *
 * @param query - The `query` argument value.
 *
 * @returns The result produced by `searchOperators`.
 *
 * @example
 * searchOperators(query);
 */

export async function searchOperators(query: string) {
	const results = docsGenerator.searchOperators(query);
	console.log(`\nSearch results for "${query}" (${results.size} matches):\n`);

	for (const [name, metadata] of results) {
		console.log(`  • ${name} - ${metadata.title}`);
		console.log(`    ${metadata.description}`);
		console.log(`    Category: ${metadata.category}`);
		console.log();
	}
}

/**
 * Executes `showOperatorInfo` with the provided inputs.
 *
 * @param name - The `name` argument value.
 *
 * @returns The result produced by `showOperatorInfo`.
 *
 * @example
 * showOperatorInfo(name);
 */

export async function showOperatorInfo(name: string) {
	const op = docsGenerator.getAllOperators().get(name);

	if (!op) {
		console.error(`\n❌ Operator "${name}" not found`);
		process.exit(1);
	}

	console.log(`\n${"=".repeat(60)}`);
	console.log(`${op.title}`);
	console.log(`${"=".repeat(60)}\n`);

	console.log(`ID:          ${op.id}`);
	console.log(`Category:    ${op.category}`);
	console.log(`Version:     ${op.version}`);

	if (op.deprecated) {
		console.log(
			`Status:      ⚠️  DEPRECATED - ${op.deprecationMessage || "No message"}`,
		);
	}

	console.log(
		`JsonLogic:   ${op.jsonlogicCompatible ? "✅ Compatible" : "❌ Not compatible"}`,
	);
	console.log(`Eager:       ${op.eager ? "Yes" : "No"}`);

	if (op.complexity) {
		console.log(`Complexity:  ${op.complexity}`);
	}

	if (op.aliases && op.aliases.length > 0) {
		console.log(`Aliases:     ${op.aliases.join(", ")}`);
	}

	if (op.tags.length > 0) {
		console.log(`Tags:        ${op.tags.join(", ")}`);
	}

	console.log(`\n${op.description}\n`);

	if (op.performanceNotes) {
		console.log(`💡 Performance Notes:\n  ${op.performanceNotes}\n`);
	}

	if (op.examples.length > 0) {
		console.log(`Examples (${op.examples.length}):\n`);
		for (let i = 0; i < op.examples.length; i++) {
			const ex = op.examples[i];
			if (!ex) continue;
			console.log(`  ${i + 1}. ${ex.description}`);
			console.log(`     Rule:   ${JSON.stringify(ex.rule)}`);
			console.log(`     Output: ${JSON.stringify(ex.output)}`);
		}
		console.log();
	}

	if (op.seeAlso && op.seeAlso.length > 0) {
		console.log(`See Also:\n  ${op.seeAlso.join(", ")}\n`);
	}

	if (op.relatedOperators && op.relatedOperators.length > 0) {
		console.log(`Related:\n  ${op.relatedOperators.join(", ")}\n`);
	}
}

/**
 * Executes `showDeprecated` with the provided inputs.
 *
 * @returns The result produced by `showDeprecated`.
 *
 * @example
 * showDeprecated();
 */

export async function showDeprecated() {
	const deprecated = docsGenerator.getDeprecatedOperators();
	console.log(`\nDeprecated operators (${deprecated.size}):\n`);

	for (const [name, metadata] of deprecated) {
		console.log(`  • ${name} - ${metadata.title}`);
		if (metadata.deprecationMessage) {
			console.log(`    Reason: ${metadata.deprecationMessage}`);
		}
		console.log();
	}
}

interface GenerateSpecOptions {
	output?: string;
	includeDeprecated?: boolean;
	plugins?: readonly {
		register(context: PluginRegistrationContext): void | Promise<void>;
	}[];
}

/**
 * Executes `generateSpec` with the provided inputs.
 *
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `generateSpec`.
 *
 * @example
 * generateSpec(options);
 */

export async function generateSpec(options: GenerateSpecOptions = {}) {
	const outputPath = resolve(
		options.output ??
			resolve(
				import.meta.dir,
				"../../../../../../generated/operators.spec.json",
			),
	);

	const plugins = options.plugins ?? [];
	const operatorRegistry = createOperatorRegistry();
	console.log("Loading plugins...");
	for (const plugin of plugins) {
		plugin.register({ operatorRegistry });
	}
	console.log(`  ${plugins.length} plugins registered`);

	const generator =
		plugins.length > 0
			? new DocumentationGenerator(operatorRegistry)
			: docsGenerator;
	const spec = generator.generateJSONSchema({
		includeDeprecated: options.includeDeprecated ?? false,
	});

	const outputDir = dirname(outputPath);
	ensureDir(outputDir);
	writeFileSync(outputPath, JSON.stringify(spec, null, 2), "utf-8");

	const operatorCount = Object.keys(
		(spec as { operators: Record<string, unknown> }).operators,
	).length;

	console.log(`\n✅ Spec written to: ${outputPath}`);
	console.log(`   operators : ${operatorCount}`);
	console.log(
		`   categories: ${Object.keys((spec as { categories: Record<string, unknown> }).categories).length}`,
	);
}

/**
 * Executes `showStats` with the provided inputs.
 *
 * @returns The result produced by `showStats`.
 *
 * @example
 * showStats();
 */

export async function showStats() {
	const stats = docsGenerator.getStats();

	console.log("\n📊 Expresso Operator Statistics\n");
	console.log(`Total Operators:               ${stats.total}`);
	console.log(`JsonLogic Compatible:          ${stats.jsonlogicCompatible}`);
	console.log(`Custom Expresso:              ${stats.nonJsonLogicCompatible}`);
	console.log(`Deprecated:                   ${stats.deprecated}`);
	console.log();

	console.log("By Category:");
	for (const [category, count] of Object.entries(stats.categories).sort(
		(a, b) => b[1] - a[1],
	)) {
		console.log(`  ${category.padEnd(25)} ${count}`);
	}
	console.log();

	console.log("Top 10 Tags:");
	const sortedTags = Object.entries(stats.tags)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10);
	for (const [tag, count] of sortedTags) {
		console.log(`  ${tag.padEnd(25)} ${count}`);
	}
	console.log();
}
