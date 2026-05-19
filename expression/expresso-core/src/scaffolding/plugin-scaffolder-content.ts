interface PluginScaffoldDescriptor {
	namespace: string;
	category: string;
}

/**
 * Builds the package manifest for a generated Expresso operator plugin.
 */
/**
 * Executes `generateScaffoldPackageJson` with the provided inputs.
 *
 * @param descriptor - The `descriptor` argument value.
 *
 * @returns The result produced by `generateScaffoldPackageJson`.
 *
 * @example
 * generateScaffoldPackageJson(descriptor);
 */

export function generateScaffoldPackageJson(
	descriptor: PluginScaffoldDescriptor,
): string {
	const { namespace, category } = descriptor;
	const pkg = {
		name: `${namespace}/${category}`,
		version: "1.0.0",
		description: `Standard ${category} operators for Expresso`,
		type: "module",
		main: "./dist/index.js",
		types: "./dist/index.d.ts",
		exports: {
			".": {
				import: "./dist/index.js",
				types: "./dist/index.d.ts",
			},
			"./package.json": "./package.json",
		},
		keywords: ["@gooi/expresso", "plugin", category, "operators", "jsonlogic"],
		author: {
			name: "Expresso Team",
		},
		license: "MIT",
		repository: {
			type: "git",
			url: "github:expresso/expresso",
			directory: `features/expresso-language/packages/expresso-std/${category}`,
		},
		peerDependencies: {
			"@gooi/expresso": ">=1.0.0 <2.0.0",
		},
		devDependencies: {
			"@types/bun": "latest",
			"@gooi/expresso": "workspace:*",
		},
		scripts: {
			build: "bun build src/index.ts --outdir dist --target=bun",
			dev: "bun --watch src/index.ts",
			test: "bun test",
		},
		"@gooi/expresso": {
			type: "operator-package",
			namespace,
			category,
			operators: [],
		},
	};

	return JSON.stringify(pkg, null, 2);
}

/**
 * Builds the default README content for a generated plugin package.
 */
/**
 * Executes `generateScaffoldReadme` with the provided inputs.
 *
 * @param descriptor - The `descriptor` argument value.
 *
 * @returns The result produced by `generateScaffoldReadme`.
 *
 * @example
 * generateScaffoldReadme(descriptor);
 */

export function generateScaffoldReadme(
	descriptor: PluginScaffoldDescriptor,
): string {
	const { namespace, category } = descriptor;
	return `# ${namespace}/${category}

Standard ${category} operators for Expresso, compatible with JsonLogic specification.

## Installation

\`\`\`bash
bun add ${namespace}/${category}
\`\`\`

## Usage

\`\`\`typescript
import { pluginRegistry } from '@gooi/expresso';
import ${category}Plugin from '${namespace}/${category}';

// Load the plugin
await pluginRegistry.load(${category}Plugin);

// Use operators
const result = apply({ 'operator-name': [/* args */] }, {});
\`\`\`

## License

MIT
`;
}

/**
 * Builds scaffold metadata used by tooling to identify generated plugin shape.
 */
/**
 * Executes `generateScaffoldMetadataJson` with the provided inputs.
 *
 * @param descriptor - The `descriptor` argument value.
 *
 * @returns The result produced by `generateScaffoldMetadataJson`.
 *
 * @example
 * generateScaffoldMetadataJson(descriptor);
 */

export function generateScaffoldMetadataJson(
	descriptor: PluginScaffoldDescriptor,
): string {
	const { namespace, category } = descriptor;
	const metadata = {
		plugin: `${namespace}/${category}`,
		version: "1.0.0",
		namespace,
		category,
		operators: {},
		generatedAt: new Date().toISOString(),
	};

	return JSON.stringify(metadata, null, 2);
}
