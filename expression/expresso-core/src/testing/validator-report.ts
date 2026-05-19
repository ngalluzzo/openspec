import type { ValidationResult } from "./validator-types";

/**
 * Executes `printValidationReport` with the provided inputs.
 *
 * @param result - The `result` argument value.
 *
 * @example
 * printValidationReport(result);
 */

export function printValidationReport(result: ValidationResult): void {
	console.log("\n📋 Metadata Validation Report\n");
	console.log(`${"=".repeat(60)}\n`);

	console.log(`Summary:`);
	console.log(`  Total Operators:    ${result.summary.total}`);
	console.log(`  Valid:              ${result.summary.valid}`);
	console.log(`  With Errors:        ${result.summary.hasErrors}`);
	console.log(`  With Warnings:      ${result.summary.hasWarnings}`);
	console.log(`  Missing Examples:   ${result.summary.missingExamples}`);
	console.log(`  Missing Desc:       ${result.summary.missingDescription}`);
	console.log(`  Deprecated:         ${result.summary.deprecated}`);
	console.log();

	if (result.errors.length > 0) {
		console.log(`❌ Errors (${result.errors.length}):\n`);

		for (const error of result.errors) {
			console.log(`  • [${error.operator}] ${error.field}: ${error.message}`);
		}
		console.log();
	}

	if (result.warnings.length > 0) {
		console.log(`⚠️  Warnings (${result.warnings.length}):\n`);

		for (const warning of result.warnings) {
			console.log(
				`  • [${warning.operator}] ${warning.field}: ${warning.message}`,
			);
		}
		console.log();
	}

	console.log(`${"=".repeat(60)}\n`);

	if (result.valid) {
		console.log("✅ All operator metadata is valid!\n");
	} else {
		console.log(`❌ Validation failed with ${result.errors.length} errors.\n`);
	}
}
