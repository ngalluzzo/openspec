import type { OperatorMetadata } from "../types/metadata";

/**
 * GenerateMarkdownOptions contract.
 */
export interface GenerateMarkdownOptions {
	/** includeDeprecated value. */
	includeDeprecated?: boolean;
	/** categories value. */
	categories?: string[];
	/** output value. */
	output?: string;
}

/**
 * Renders markdown documentation from operator metadata grouped by category.
 */
/**
 * Executes `generateMarkdownDocumentation` with the provided inputs.
 *
 * @param input - Composite input payload for this operation.
 *
 * @returns The result produced by `generateMarkdownDocumentation`.
 *
 * @example
 * generateMarkdownDocumentation(input);
 */

export function generateMarkdownDocumentation(input: {
	operators: Map<string, OperatorMetadata>;
	options?: GenerateMarkdownOptions;
}): string {
	const { options = {} } = input;
	const { includeDeprecated = false, categories: targetCategories } = options;
	let output = "";

	output += `# Expresso Operators\n\n`;
	output += `> Generated automatically from operator metadata\n\n`;
	output += `**Total Operators:** ${input.operators.size}\n\n`;
	output += `---\n\n`;

	const categories = new Map<string, Map<string, OperatorMetadata>>();

	for (const [name, metadata] of input.operators) {
		if (!includeDeprecated && metadata.deprecated) continue;
		if (targetCategories && !targetCategories.includes(metadata.category))
			continue;

		const category = categories.get(metadata.category) || new Map();
		category.set(name, metadata);
		categories.set(metadata.category, category);
	}

	const sortedCategories = Array.from(categories.entries()).sort((a, b) =>
		a[0].localeCompare(b[0]),
	);

	for (const [category, operators] of sortedCategories) {
		output += `## ${category}\n\n`;
		output += `| Operator | Description |\n`;
		output += `|----------|-------------|\n`;

		for (const [name, metadata] of operators) {
			const badge = metadata.jsonlogicCompatible ? " ✅" : "";
			output += `| [\`${name}\`](#${name})${badge} | ${escapeMdxText(metadata.description).replaceAll("|", "\\|")} |\n`;
		}

		output += `\n---\n\n`;
	}

	for (const [category, operators] of sortedCategories) {
		output += `## ${category}\n\n`;

		for (const [name, metadata] of operators) {
			output += generateOperatorMarkdown(name, metadata);
		}
	}

	return output;
}

function generateOperatorMarkdown(
	name: string,
	metadata: OperatorMetadata,
): string {
	let output = "";

	output += `### \`${name}\`\n\n`;

	if (metadata.deprecated) {
		output += `> ⚠️ **DEPRECATED**: ${escapeMdxText(metadata.deprecationMessage || "This operator is deprecated.")}\n\n`;
	}

	output += `**Title:** ${escapeMdxText(metadata.title)}\n\n`;
	output += `**Category:** \`${metadata.category}\`\n\n`;
	output += `**Version:** ${metadata.version}\n\n`;

	if (metadata.jsonlogicCompatible !== undefined) {
		output += `**JsonLogic Compatible:** ${metadata.jsonlogicCompatible ? "✅ Yes" : "❌ No"}\n\n`;
	}

	if (metadata.complexity) {
		output += `**Complexity:** ${metadata.complexity}\n\n`;
	}

	output += `${escapeMdxText(metadata.description)}\n\n`;

	if (metadata.tags.length > 0) {
		output += `**Tags:** ${metadata.tags.map((tag) => `\`${tag}\``).join(", ")}\n\n`;
	}

	if (metadata.aliases && metadata.aliases.length > 0) {
		output += `**Aliases:** ${metadata.aliases.map((alias) => `\`${alias}\``).join(", ")}\n\n`;
	}

	if (metadata.performanceNotes) {
		output += `> 💡 **Performance Notes:** ${escapeMdxText(metadata.performanceNotes)}\n\n`;
	}

	output += `#### Examples\n\n`;

	for (const example of metadata.examples) {
		output += `${escapeMdxText(example.description)}\n\n`;
		output += `**Input:**\n\`\`\`json\n${JSON.stringify(example.input, null, 2)}\n\`\`\`\n\n`;
		output += `**Rule:**\n\`\`\`json\n${JSON.stringify(example.rule, null, 2)}\n\`\`\`\n\n`;
		output += `**Output:**\n\`\`\`json\n${JSON.stringify(example.output, null, 2)}\n\`\`\`\n\n`;
	}

	if (metadata.seeAlso && metadata.seeAlso.length > 0) {
		output += `#### See Also\n\n`;
		for (const operator of metadata.seeAlso) {
			output += `- [\`${operator}\`](#${operator})\n`;
		}
		output += `\n`;
	}

	if (metadata.relatedOperators && metadata.relatedOperators.length > 0) {
		output += `#### Related Operators\n\n`;
		for (const operator of metadata.relatedOperators) {
			output += `- [\`${operator}\`](#${operator})\n`;
		}
		output += `\n`;
	}

	output += `---\n\n`;

	return output;
}

function escapeMdxText(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("{", "\\{")
		.replaceAll("}", "\\}");
}
