import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Project } from "ts-morph";
import {
	generateScaffoldMetadataJson,
	generateScaffoldPackageJson,
	generateScaffoldReadme,
} from "./plugin-scaffolder-content";
import { formatScaffoldFile } from "./plugin-scaffolder-formatting";

interface ScaffoldingOptions {
	name: string;
	namespace?: string;
	outputPath?: string;
}

export class PluginScaffolder {
	private project: Project;
	namespace: string;
	category: string;

	constructor(options: ScaffoldingOptions) {
		this.project = new Project({ useInMemoryFileSystem: true });

		// Parse name to extract namespace and category
		const parts = options.name.split("/");
		let namespace: string;
		let category: string;

		if (parts.length === 2 && parts[0] && parts[1]) {
			namespace = parts[0];
			category = parts[1];
		} else {
			namespace = options.namespace || "@std";
			category = options.name;
		}

		this.namespace = namespace;
		this.category = category;
	}

	private getOutputPath(options: ScaffoldingOptions): string {
		if (options.outputPath) {
			return join(options.outputPath, this.category);
		}
		return join(
			process.cwd(),
			"packages",
			"expression",
			"expresso-std",
			this.category,
		);
	}

	private validatePath(path: string): void {
		if (existsSync(path)) {
			throw new Error(`Directory already exists: ${path}`);
		}
	}

	generateOperatorsFile(): string {
		const sourceFile = this.project.createSourceFile("operators.ts");

		sourceFile.addImportDeclaration({
			moduleSpecifier: "@gooi/expresso",
			namedImports: ["defineSyncOperator"],
		});

		sourceFile.addImportDeclaration({
			moduleSpecifier: "zod",
			namedImports: ["z"],
		});

		sourceFile.addStatements(`
// Add your operators here using defineSyncOperator

// Example:
// export function registerFilter() {
//   defineSyncOperator<[unknown[], Function], unknown[]>('filter', {
//     handler: ([array, predicate]) => {
//       if (typeof predicate !== 'function') {
//         throw new Error('Predicate must be a function');
//       }
//       return array.filter(predicate);
//     },
//     inputSchema: z.tuple([z.array(z.any()), z.function()]),
//     outputSchema: z.array(z.any()),
//     metadata: {
//       name: 'filter',
//       title: 'Filter',
//       description: 'Filter array elements',
//       category: '${this.category}',
//       tags: ['array', 'filtering'],
//       examples: [
//         {
//           description: 'Filter even numbers',
//           input: {},
//           rule: { 'filter': [[1, 2, 3, 4], '(x) => x % 2 === 0'] },
//           output: [2, 4],
//         },
//       ],
//       complexity: 'O(n)',
//       jsonlogicCompatible: false,
//     },
//   })();
// }
`);

		return sourceFile.getFullText();
	}

	generateIndexFile(): string {
		const sourceFile = this.project.createSourceFile("index.ts");

		sourceFile.addImportDeclaration({
			moduleSpecifier: "@gooi/expresso",
			namedImports: ["type Plugin"],
		});

		sourceFile.addStatements(`
const ${this.category}Plugin: Plugin = {
  name: '${this.namespace}/${this.category}',
  version: '1.0.0',
  description: 'Standard ${this.category} operators for Expresso',
  operators: [], // Add your operator names here

  register() {
    // Register your operators here
    // Example:
    // registerFilter();
  },

  unregister() {
    // Unregister all operators when plugin is unloaded
    // This requires the registry to support unregistration
  },
};

export default ${this.category}Plugin;

// Also export operator registrations for direct use
export * from './operators';
`);

		return sourceFile.getFullText();
	}

	generateTestFile(): string {
		const sourceFile = this.project.createSourceFile(
			`${this.category}.test.ts`,
		);

		sourceFile.addImportDeclaration({
			moduleSpecifier: "@gooi/expresso/testing/verify-plugin",
			namedImports: ["verifyPlugin"],
		});

		sourceFile.addImportDeclaration({
			moduleSpecifier: "./index",
			defaultImport: `${this.category}Plugin`,
		});

		sourceFile.addImportDeclaration({
			moduleSpecifier: "@gooi/expresso/registry",
			namedImports: ["clearRegistry"],
		});

		sourceFile.addImportDeclaration({
			moduleSpecifier: "bun:test",
			namedImports: ["beforeEach"],
		});

		sourceFile.addStatements(`
// Ensure clean registry before tests
beforeEach(() => {
  clearRegistry();
});

verifyPlugin(${this.category}Plugin);
`);

		return sourceFile.getFullText();
	}

	async scaffold(options: ScaffoldingOptions): Promise<void> {
		const outputPath = this.getOutputPath(options);
		const srcPath = join(outputPath, "src");

		this.validatePath(outputPath);

		console.log(
			`\n📦 Scaffolding plugin: ${this.namespace}/${this.category}\n`,
		);

		try {
			// Create directories
			mkdirSync(srcPath, { recursive: true });

			// Generate files
			const files = [
				{ name: "src/operators.ts", content: this.generateOperatorsFile() },
				{ name: "src/index.ts", content: this.generateIndexFile() },
				{
					name: "package.json",
					content: generateScaffoldPackageJson({
						namespace: this.namespace,
						category: this.category,
					}),
				},
				{
					name: "README.md",
					content: generateScaffoldReadme({
						namespace: this.namespace,
						category: this.category,
					}),
				},
				{
					name: "metadata.json",
					content: generateScaffoldMetadataJson({
						namespace: this.namespace,
						category: this.category,
					}),
				},
				{
					name: `src/${this.category}.test.ts`,
					content: this.generateTestFile(),
				},
			];

			for (const file of files) {
				const filePath = join(outputPath, file.name);
				const formatted = await formatScaffoldFile(file.content, filePath);
				writeFileSync(filePath, formatted);
				console.log(`  ✅ ${file.name}`);
			}

			console.log(`\n✅ Plugin scaffolded at: ${outputPath}\n`);
			console.log("Next steps:");
			console.log("  1. Add your operators to src/operators.ts");
			console.log("  2. Update src/index.ts to register your operators");
			console.log("  3. Update package.json with operator names");
			console.log("  4. Run tests: bun test\n");
		} catch (error) {
			// Cleanup on failure
			if (existsSync(outputPath)) {
				console.error(`\n❌ Scaffolding failed, cleaning up...\n`);
				// Simple cleanup - in production you might want more robust cleanup
			}
			throw error;
		}
	}
}
