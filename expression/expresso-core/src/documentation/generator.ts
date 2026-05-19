import { z } from "zod";
import {
	createOperatorRegistry,
	getDefaultOperatorRegistry,
	type OperatorRegistry,
} from "../operators/registry";
import type { OperatorMetadata } from "../types/metadata";
import {
	type GenerateMarkdownOptions,
	generateMarkdownDocumentation,
} from "./generator-markdown";
import { zodSchemaToTypescript } from "./zod-schema-to-typescript";

interface GenerateJSONSchemaOptions {
	includeDeprecated?: boolean;
	output?: string;
}

interface GenerateTypeScriptOptions {
	includeDeprecated?: boolean;
	output?: string;
}

export class DocumentationGenerator {
	private readonly operators: OperatorRegistry;

	constructor(operators?: OperatorRegistry) {
		if (!operators) {
			operators = getDefaultOperatorRegistry();
		}

		this.operators = operators;
	}

	getAllOperators(): Map<string, OperatorMetadata> {
		const result = new Map<string, OperatorMetadata>();
		const allOps = this.operators.getAll();

		for (const [name, op] of allOps) {
			if (op.metadata) {
				result.set(name, op.metadata);
			}
		}

		return result;
	}

	getOperatorsByCategory(category: string): Map<string, OperatorMetadata> {
		const result = new Map<string, OperatorMetadata>();
		const allOps = this.getAllOperators();

		for (const [name, metadata] of allOps) {
			if (metadata.category === category) {
				result.set(name, metadata);
			}
		}

		return result;
	}

	getOperatorsByTag(tag: string): Map<string, OperatorMetadata> {
		const result = new Map<string, OperatorMetadata>();
		const allOps = this.getAllOperators();

		for (const [name, metadata] of allOps) {
			if (metadata.tags.includes(tag)) {
				result.set(name, metadata);
			}
		}

		return result;
	}

	searchOperators(query: string): Map<string, OperatorMetadata> {
		const result = new Map<string, OperatorMetadata>();
		const allOps = this.getAllOperators();
		const lowerQuery = query.toLowerCase();

		for (const [name, metadata] of allOps) {
			const searchFields = [
				metadata.id,
				metadata.name,
				metadata.title,
				metadata.description,
				metadata.tags.join(" "),
			]
				.join(" ")
				.toLowerCase();

			if (searchFields.includes(lowerQuery)) {
				result.set(name, metadata);
			}
		}

		return result;
	}

	getDeprecatedOperators(): Map<string, OperatorMetadata> {
		const result = new Map<string, OperatorMetadata>();
		const allOps = this.getAllOperators();

		for (const [name, metadata] of allOps) {
			if (metadata.deprecated) {
				result.set(name, metadata);
			}
		}

		return result;
	}

	getStats() {
		const allOps = this.getAllOperators();
		const categories = new Map<string, number>();
		const tags = new Map<string, number>();
		let deprecated = 0;
		let jsonlogicCompatible = 0;

		for (const metadata of allOps.values()) {
			const catCount = categories.get(metadata.category) || 0;
			categories.set(metadata.category, catCount + 1);

			for (const tag of metadata.tags) {
				const tagCount = tags.get(tag) || 0;
				tags.set(tag, tagCount + 1);
			}

			if (metadata.deprecated) deprecated++;
			if (metadata.jsonlogicCompatible) jsonlogicCompatible++;
		}

		return {
			total: allOps.size,
			categories: Object.fromEntries(categories),
			tags: Object.fromEntries(tags),
			deprecated,
			jsonlogicCompatible,
			nonJsonLogicCompatible: allOps.size - jsonlogicCompatible,
		};
	}

	generateMarkdown(options: GenerateMarkdownOptions = {}): string {
		return generateMarkdownDocumentation({
			operators: this.getAllOperators(),
			options,
		});
	}

	generateJSONSchema(
		options: GenerateJSONSchemaOptions = {},
	): Record<string, unknown> {
		const { includeDeprecated = false } = options;

		const spec: {
			$schema: string;
			title: string;
			description: string;
			version: string;
			generatedAt: string;
			operators: Record<string, unknown>;
			categories: Record<string, string[]>;
		} = {
			$schema: "https://json-schema.org/draft/2020-12/schema",
			title: "Expresso Operators",
			description:
				"Portable operator spec for the Expresso rule engine. Includes JSON Schema for inputs/outputs and TDD-ready test cases.",
			version: "1.0.0",
			generatedAt: new Date().toISOString(),
			operators: {},
			categories: {},
		};

		const categories = new Map<string, string[]>();

		for (const [name, op] of this.operators.getAll()) {
			if (!op.metadata) continue;
			if (!includeDeprecated && op.metadata.deprecated) continue;

			const meta = op.metadata;

			const entry: Record<string, unknown> = {
				id: meta.id,
				name: meta.name,
				title: meta.title,
				description: meta.description,
				category: meta.category,
				tags: meta.tags,
				version: meta.version,
				async: op.async ?? false,
				eager: op.eager ?? false,
				preserveRules: op.preserveRules ?? false,
				preserveRawArrays: op.preserveRawArrays ?? false,
				jsonlogicCompatible: meta.jsonlogicCompatible ?? false,
			};

			if (meta.aliases && meta.aliases.length > 0) {
				entry.aliases = meta.aliases;
			}

			if (meta.complexity) {
				entry.complexity = meta.complexity;
			}

			if (meta.relatedOperators && meta.relatedOperators.length > 0) {
				entry.relatedOperators = meta.relatedOperators;
			}

			if (op.inputSchema) {
				entry.inputSchema = z.toJSONSchema(op.inputSchema as z.ZodTypeAny);
			}

			if (op.outputSchema) {
				entry.outputSchema = z.toJSONSchema(op.outputSchema as z.ZodTypeAny);
			}

			if (meta.examples && meta.examples.length > 0) {
				entry.examples = meta.examples;
			}

			if (meta.tests && meta.tests.length > 0) {
				entry.tests = meta.tests;
			}

			if (meta.deprecated) {
				entry.deprecated = true;
				if (meta.deprecationMessage) {
					entry.deprecationMessage = meta.deprecationMessage;
				}
			}

			spec.operators[name] = entry;

			const catOps = categories.get(meta.category) ?? [];
			catOps.push(name);
			categories.set(meta.category, catOps);
		}

		spec.categories = Object.fromEntries(categories);

		return spec;
	}

	generateTypeScriptDeclarations(
		options: GenerateTypeScriptOptions = {},
	): string {
		const { includeDeprecated = false } = options;
		let output = "";

		output += `// Auto-generated TypeScript declarations for Expresso operators\n`;
		output += `// Generated at: ${new Date().toISOString()}\n\n`;

		output += `declare module '@gooi/expresso' {\n\n`;
		output += `  export interface OperatorSignatures {\n`;

		const _allOps = this.getAllOperators();

		for (const [name, op] of this.operators.getAll()) {
			if (!op.metadata) continue;
			if (!includeDeprecated && op.metadata.deprecated) continue;

			const meta = op.metadata;
			const deprecated = meta.deprecated
				? " * @deprecated " +
					(meta.deprecationMessage || "This operator is deprecated.") +
					"\n"
				: "";

			output += `    /**\n`;
			output += `     * ${meta.title}\n`;
			output += `     * @category ${meta.category}\n`;
			output += `     * @description ${meta.description}\n`;
			if (deprecated) {
				output += `     * ${deprecated}`;
			}
			output += `     * @since ${meta.version}\n`;
			output += `     */\n`;
			const argsType =
				op.inputSchema !== undefined
					? zodSchemaToTypescript(op.inputSchema as z.ZodTypeAny)
					: "unknown";
			const returnType =
				op.outputSchema !== undefined
					? zodSchemaToTypescript(op.outputSchema as z.ZodTypeAny)
					: "unknown";
			output += `    '${name}': (args: ${argsType}) => ${returnType};\n\n`;
		}

		output += `  }\n\n`;
		output += `}\n`;

		return output;
	}
}

export const docsGenerator = new DocumentationGenerator(
	createOperatorRegistry(),
);
