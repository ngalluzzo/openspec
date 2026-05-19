import { PluginScaffolder } from "./plugin-scaffolder";

/**
 * Executes `scaffoldPlugin` with the provided inputs.
 *
 * @param name - The `name` argument value.
 * @param outputPath - The `outputPath` argument value.
 *
 * @returns The result produced by `scaffoldPlugin`.
 *
 * @example
 * scaffoldPlugin(name, outputPath);
 */

export async function scaffoldPlugin(name: string, outputPath?: string) {
	try {
		const options = {
			name,
			...(outputPath !== undefined && { outputPath }),
		};

		const scaffolder = new PluginScaffolder(options);

		await scaffolder.scaffold(options);
	} catch (error) {
		if (error instanceof Error) {
			console.error(`\n❌ ${error.message}\n`);
		} else {
			console.error("\n❌ Unknown error occurred\n");
		}
		process.exit(1);
	}
}
