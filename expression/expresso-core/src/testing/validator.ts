import {
	createOperatorRegistry,
	type OperatorRegistry,
} from "../operators/registry";
import { validateOperatorMetadata } from "./validator-operator-metadata";
import { printValidationReport } from "./validator-report";
import type { ValidationError, ValidationResult } from "./validator-types";

export class MetadataValidator {
	private readonly operators: OperatorRegistry;

	constructor(operators: OperatorRegistry) {
		this.operators = operators;
	}

	validateOperator = validateOperatorMetadata;

	validateAll(): ValidationResult {
		const allOps = this.operators.getAll();
		const allErrors: ValidationError[] = [];
		const allWarnings: ValidationError[] = [];
		const summary = {
			total: 0,
			valid: 0,
			hasErrors: 0,
			hasWarnings: 0,
			missingExamples: 0,
			missingDescription: 0,
			deprecated: 0,
		};

		for (const [name, op] of allOps) {
			if (!op.metadata) {
				allErrors.push({
					operator: name,
					field: "metadata",
					message: "No metadata defined",
					severity: "error",
				});
				summary.hasErrors++;
				summary.total++;
				continue;
			}

			const result = this.validateOperator(name, op.metadata);
			summary.total++;

			if (result.valid) {
				summary.valid++;
			} else {
				summary.hasErrors++;
			}

			if (result.warnings.length > 0) {
				summary.hasWarnings++;
			}

			if (!op.metadata.examples || op.metadata.examples.length === 0) {
				summary.missingExamples++;
			}

			if (
				!op.metadata.description ||
				op.metadata.description.trim().length === 0
			) {
				summary.missingDescription++;
			}

			if (op.metadata.deprecated) {
				summary.deprecated++;
			}

			allErrors.push(...result.errors);
			allWarnings.push(...result.warnings);
		}

		return {
			valid: allErrors.length === 0,
			errors: allErrors,
			warnings: allWarnings,
			summary,
		};
	}

	printReport(result: ValidationResult): void {
		printValidationReport(result);
	}
}

export const metadataValidator = new MetadataValidator(
	createOperatorRegistry(),
);

export type { ValidationError, ValidationResult } from "./validator-types";
