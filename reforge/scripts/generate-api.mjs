#!/usr/bin/env node
/**
 * Generate API reference pages from typedoc JSON output.
 *
 * Usage: node scripts/generate-api.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TYPEDOC_DIR = ".typedoc/json";
const API_OUTPUT_DIR = "docs/api";

// Map package names to their typedoc entry point directories
const PACKAGE_MAP = {
	core: "packages/core",
	transform: "packages/transform",
	adapters: "packages/adapters",
	recipes: "packages/recipes",
};

/**
 * Convert a typedoc JSON model to a VitePress markdown page.
 */
function modelToMarkdown(model, packageName) {
	const lines = [];

	// Frontmatter
	lines.push(`---
outline: [2, 3]
---`);
	lines.push("");

	// Title
	const title = packageName.charAt(0).toUpperCase() + packageName.slice(1);
	lines.push(`# ${title} API Reference`);
	lines.push("");

	// Intro
	lines.push(`Auto-generated API reference for **@reforge/${packageName}**.`);
	lines.push("");

	// Group by category
	const categories = new Map();
	for (const item of model.children || []) {
		const category = item.kindString || "Other";
		if (!categories.has(category)) categories.set(category, []);
		categories.get(category).push(item);
	}

	for (const [category, items] of categories) {
		lines.push(`## ${category}`);
		lines.push("");

		for (const item of items) {
			// Signature
			const signature = item.signatures?.[0]?.comment?.summary
				?.map((s) => s.text)
				.join("");
			if (signature && signature !== item.name) {
				lines.push(`### ${item.name}`);
				lines.push("");
				lines.push(signature);
				lines.push("");
			} else {
				lines.push(`### ${item.name}`);
				lines.push("");
			}

			// Type signature
			if (item.kind === 256 || item.kind === 64) {
				// Interface or Class
				const typeSignature = getTypeSignature(item);
				if (typeSignature) {
					lines.push("```ts");
					lines.push(typeSignature);
					lines.push("```");
					lines.push("");
				}
			} else if (item.kind === 32) {
				// Function
				const typeSignature = getFunctionSignature(item);
				if (typeSignature) {
					lines.push("```ts");
					lines.push(typeSignature);
					lines.push("```");
					lines.push("");
				}
			} else if (item.kind === 1024) {
				// Module/namespace
				lines.push("```ts");
				lines.push(`declare module "@reforge/${packageName}" {`);
				for (const child of item.children || []) {
					lines.push(`  // ${child.name}`);
				}
				lines.push("}");
				lines.push("```");
				lines.push("");
			}

			// Parameters
			const parameters = item.signatures?.[0]?.parameters;
			if (parameters && parameters.length > 0) {
				lines.push("**Parameters:**");
				lines.push("");
				for (const param of parameters) {
					const type = param.type?.type || "unknown";
					lines.push(`- \`${param.name}\` — ${type}`);
				}
				lines.push("");
			}

			// Return type
			const returnType = item.signatures?.[0]?.type?.type;
			if (returnType) {
				lines.push(`**Returns:** \`${returnType}\``);
				lines.push("");
			}

			// Type parameters
			const typeParams = item.typeParameters;
			if (typeParams && typeParams.length > 0) {
				lines.push(
					`**Type parameters:** ${typeParams.map((p) => `\`${p.name}\``).join(", ")}`,
				);
				lines.push("");
			}

			// Properties (for interfaces/classes)
			const properties = item.children?.filter(
				(c) => c.kind === 1024 || c.kind === 2048,
			);
			if (properties && properties.length > 0) {
				lines.push("**Properties:**");
				lines.push("");
				for (const prop of properties) {
					const type = prop.type?.type || "unknown";
					const optional = prop.flags?.isOptional ? "?" : "";
					lines.push(`- \`${prop.name}${optional}\`: ${type}`);
				}
				lines.push("");
			}

			// Enum members
			if (item.kind === 32768) {
				lines.push("**Members:**");
				lines.push("");
				for (const member of item.children || []) {
					const value = member.defaultValue ?? "(no default)";
					lines.push(`- \`${member.name}\` = ${value}`);
				}
				lines.push("");
			}

			// Inherited from
			if (item.comment?.summary) {
				const text = item.comment.summary.map((s) => s.text).join("");
				if (text && !signature?.includes(text)) {
					lines.push(text);
					lines.push("");
				}
			}
		}
	}

	return lines.join("\n");
}

function getTypeSignature(item) {
	const parts = [];
	if (item.kind === 256) parts.push("interface");
	else if (item.kind === 64) parts.push("class");

	parts.push(item.name);

	if (item.typeParameters) {
		parts.push(`<${item.typeParameters.map((p) => p.name).join(", ")}>`);
	}

	if (item.extends) {
		parts.push(`extends ${item.extends}`);
	}

	return parts.join(" ");
}

function getFunctionSignature(item) {
	const sig = item.signatures?.[0];
	if (!sig) return null;

	const params = (sig.parameters || []).map((p) => {
		const optional = p.flags?.isOptional ? "?" : "";
		const type = p.type?.type || "unknown";
		return `${p.name}${optional}: ${type}`;
	});

	const returnType = sig.type?.type || "void";
	return `(${params.join(", ")}) => ${returnType}`;
}

// Main
async function main() {
	if (!existsSync(TYPEDOC_DIR)) {
		console.error("No typedoc output found. Run `typedoc` first.");
		process.exit(1);
	}

	// Ensure output directory exists
	mkdirSync(API_OUTPUT_DIR, { recursive: true });

	// Process each package
	for (const [packageName] of Object.entries(PACKAGE_MAP)) {
		// typedoc with entryPointStrategy "packages" creates one JSON per package
		const jsonPath = join(TYPEDOC_DIR, `${packageName}.json`);

		if (!existsSync(jsonPath)) {
			console.warn(`No typedoc output for @reforge/${packageName}, skipping.`);
			continue;
		}

		const model = JSON.parse(readFileSync(jsonPath, "utf8"));
		const markdown = modelToMarkdown(model, packageName);

		writeFileSync(join(API_OUTPUT_DIR, `${packageName}.md`), markdown);
		console.log(`Generated docs/api/${packageName}.md`);
	}

	console.log("Done.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
