import { testGenerator } from "./generator";
import { metadataValidator } from "./validator";

/**
 * Executes `generateTests` with the provided inputs.
 *
 * @param category - The `category` argument value.
 *
 * @returns The result produced by `generateTests`.
 *
 * @example
 * generateTests(category);
 */

export async function generateTests(category?: string) {
	console.log("🧪 Generating tests from operator metadata...\n");

	const options = {
		includeDeprecated: false,
		...(category !== undefined && { filterCategories: [category] }),
	};

	const stats = testGenerator.getStats(options);

	console.log("📊 Test Statistics:");
	console.log(`   Total operators:        ${stats.total}`);
	console.log(`   Operators with examples: ${stats.withExamples}`);
	console.log(`   Operators with tests:   ${stats.withExplicitTests}`);
	console.log(`   Example count:          ${stats.examplesCount}`);
	console.log(`   Explicit test count:    ${stats.explicitTestsCount}`);
	console.log(
		`   Total tests to generate: ${stats.examplesCount + stats.explicitTestsCount}`,
	);
	console.log();

	if (stats.examplesCount + stats.explicitTestsCount === 0) {
		console.log(
			"⚠️  No tests to generate. Add examples or explicit tests to operator metadata.\n",
		);
		return;
	}

	testGenerator.generateAllTests(options);
}

/**
 * Validates metadata.
 *
 * @returns The result produced by `validateMetadata`.
 *
 * @example
 * validateMetadata();
 */

export async function validateMetadata() {
	console.log("🔍 Validating operator metadata...\n");

	const result = metadataValidator.validateAll();

	metadataValidator.printReport(result);

	if (!result.valid) {
		process.exit(1);
	}
}

/**
 * Executes `testStats` with the provided inputs.
 *
 * @returns The result produced by `testStats`.
 *
 * @example
 * testStats();
 */

export async function testStats() {
	console.log("📊 Test Generation Statistics\n");

	const stats = testGenerator.getStats();

	console.log("All Operators:");
	console.log(`   Total:               ${stats.total}`);
	console.log(
		`   With examples:       ${stats.withExamples} (${((stats.withExamples / stats.total) * 100).toFixed(1)}%)`,
	);
	console.log(
		`   With explicit tests:  ${stats.withExplicitTests} (${((stats.withExplicitTests / stats.total) * 100).toFixed(1)}%)`,
	);
	console.log();

	console.log("Test Count:");
	console.log(`   Example tests:       ${stats.examplesCount}`);
	console.log(`   Explicit tests:      ${stats.explicitTestsCount}`);
	console.log(
		`   Total:               ${stats.examplesCount + stats.explicitTestsCount}`,
	);
	console.log();

	if (stats.total - stats.withExamples > 0) {
		console.log(
			`⚠️  ${stats.total - stats.withExamples} operators without examples`,
		);
	}

	if (stats.total - stats.withExplicitTests > 0) {
		console.log(
			`⚠️  ${stats.total - stats.withExplicitTests} operators without explicit tests`,
		);
	}

	console.log();
}
