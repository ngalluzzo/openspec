import {
	createOperatorRegistry,
	type OperatorRegistry,
} from "../operators/registry";

interface GenerateTestsOptions {
	includeDeprecated?: boolean;
	filterCategories?: string[];
}

export class TestGenerator {
	private readonly operators: OperatorRegistry;

	constructor(operators: OperatorRegistry) {
		this.operators = operators;
	}

	getStats(options: GenerateTestsOptions = {}) {
		const allOps = this.operators.getAll();
		let total = 0;
		let withExamples = 0;
		const withExplicitTests = 0;
		let examplesCount = 0;
		const explicitTestsCount = 0;

		for (const [, op] of allOps) {
			if (op.metadata) {
				if (!options.includeDeprecated && op.metadata.deprecated) continue;
				if (
					options.filterCategories &&
					!options.filterCategories.includes(op.metadata.category)
				)
					continue;

				total++;
				if (op.metadata.examples && op.metadata.examples.length > 0) {
					withExamples++;
					examplesCount += op.metadata.examples.length;
				}
			}
		}

		return {
			total,
			withExamples,
			withExplicitTests,
			examplesCount,
			explicitTestsCount,
		};
	}

	generateAllTests(_options: GenerateTestsOptions = {}) {
		console.log("Test generation not yet implemented");
	}
}

export const testGenerator = new TestGenerator(createOperatorRegistry());
