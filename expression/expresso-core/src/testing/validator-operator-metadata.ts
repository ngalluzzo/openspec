import type { OperatorMetadata } from "../types/metadata";
import type { ValidationError } from "./validator-types";

/**
 * Validates operator metadata.
 *
 * @param name - The `name` argument value.
 * @param metadata - The `metadata` argument value.
 *
 * @returns The result produced by `validateOperatorMetadata`.
 *
 * @example
 * validateOperatorMetadata(name, metadata);
 */

export function validateOperatorMetadata(
	name: string,
	metadata: OperatorMetadata,
): {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationError[];
} {
	const errors: ValidationError[] = [];
	const warnings: ValidationError[] = [];

	const addError = (field: string, message: string): void => {
		errors.push({ operator: name, field, message, severity: "error" });
	};
	const addWarning = (field: string, message: string): void => {
		warnings.push({ operator: name, field, message, severity: "warning" });
	};

	const requiredFields = [
		"id",
		"name",
		"title",
		"description",
		"category",
		"tags",
		"examples",
		"version",
	];

	for (const field of requiredFields) {
		if (
			!(field in metadata) ||
			metadata[field as keyof OperatorMetadata] === undefined
		) {
			addError(field, `Required field "${field}" is missing`);
		}
	}

	if (metadata.id && metadata.id !== name) {
		addError(
			"id",
			`ID "${metadata.id}" does not match operator name "${name}"`,
		);
	}
	if (metadata.name && metadata.name.trim().length === 0) {
		addError("name", "Name cannot be empty");
	}
	if (metadata.title && metadata.title.trim().length === 0) {
		addError("title", "Title cannot be empty");
	}
	if (metadata.description && metadata.description.trim().length === 0) {
		addError("description", "Description cannot be empty");
	}
	if (metadata.category && metadata.category.trim().length === 0) {
		addError("category", "Category cannot be empty");
	}

	if (metadata.tags) {
		if (!Array.isArray(metadata.tags)) {
			addError("tags", "Tags must be an array");
		} else if (metadata.tags.length === 0) {
			addWarning("tags", "No tags defined");
		} else {
			for (let i = 0; i < metadata.tags.length; i++) {
				const tag = metadata.tags[i];
				if (typeof tag !== "string" || tag.trim().length === 0) {
					addError(`tags[${i}]`, "Tag must be a non-empty string");
				}
			}
		}
	}

	if (metadata.examples) {
		if (!Array.isArray(metadata.examples)) {
			addError("examples", "Examples must be an array");
		} else if (metadata.examples.length === 0) {
			addWarning("examples", "No examples defined");
		} else {
			for (let i = 0; i < metadata.examples.length; i++) {
				const example = metadata.examples[i];
				if (!example) {
					addError(`examples[${i}]`, "Example is null or undefined");
					continue;
				}
				if (
					!example.description ||
					typeof example.description !== "string" ||
					example.description.trim().length === 0
				) {
					addError(
						`examples[${i}].description`,
						"Example must have a non-empty description",
					);
				}
				if (!example.input) {
					addError(`examples[${i}].input`, "Example must have input data");
				}
				if (!example.rule) {
					addError(`examples[${i}].rule`, "Example must have a rule");
				} else if (
					typeof example.rule !== "object" ||
					Array.isArray(example.rule)
				) {
					addError(`examples[${i}].rule`, "Example rule must be an object");
				}
				if (example.output === undefined) {
					addError(
						`examples[${i}].output`,
						"Example must have expected output",
					);
				}
			}
		}
	}

	if (metadata.tests) {
		if (!Array.isArray(metadata.tests)) {
			addError("tests", "Tests must be an array");
		} else {
			for (let i = 0; i < metadata.tests.length; i++) {
				const test = metadata.tests[i];
				if (!test) {
					addError(`tests[${i}]`, "Test is null or undefined");
					continue;
				}
				if (
					!test.name ||
					typeof test.name !== "string" ||
					test.name.trim().length === 0
				) {
					addError(`tests[${i}].name`, "Test must have a non-empty name");
				}
				if (
					!test.description ||
					typeof test.description !== "string" ||
					test.description.trim().length === 0
				) {
					addError(
						`tests[${i}].description`,
						"Test must have a non-empty description",
					);
				}
				if (!test.args || !Array.isArray(test.args)) {
					addError(`tests[${i}].args`, "Test must have args array");
				}
				if (test.input === undefined) {
					addError(`tests[${i}].input`, "Test must have input data");
				}
				if (test.throws && typeof test.throws !== "string") {
					addError(`tests[${i}].throws`, "throws must be a string");
				}
				if (!test.throws && test.expected === undefined) {
					addError(`tests[${i}].expected`, "Test must have expected output");
				}
			}
		}
	}

	if (metadata.deprecated && !metadata.deprecationMessage) {
		addWarning(
			"deprecationMessage",
			"Deprecated operator should have a deprecation message",
		);
	}
	if (metadata.complexity && typeof metadata.complexity !== "string") {
		addError(
			"complexity",
			'Complexity must be a string (e.g., "O(1)", "O(n)")',
		);
	}
	if (metadata.version && typeof metadata.version !== "string") {
		addError("version", "Version must be a string");
	} else if (metadata.version && !/^\d+\.\d+\.\d+/.test(metadata.version)) {
		addWarning(
			"version",
			'Version should follow semantic versioning (e.g., "1.0.0")',
		);
	}

	return { valid: errors.length === 0, errors, warnings };
}
