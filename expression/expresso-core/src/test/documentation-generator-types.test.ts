import { describe, expect, test } from "bun:test";
import "./register-std";
import { z } from "zod";
import { DocumentationGenerator } from "../documentation/generator";
import { defineSyncOperator } from "../operators/define-operator";
import { clearRegistry } from "../operators/registry";

function metadata(name: string) {
	return {
		name,
		title: name,
		description: `${name} test operator`,
		category: "misc",
		tags: ["test"],
	};
}

describe("documentation generator type signatures", () => {
	test("emits schema-derived args and return types", () => {
		clearRegistry();

		defineSyncOperator("test.docs.typed", {
			inputSchema: z.tuple([z.number(), z.string()]),
			outputSchema: z.boolean(),
			handler: ([left, right]) => left.toString() === right,
			metadata: metadata("test.docs.typed"),
		})();

		const declarations =
			new DocumentationGenerator().generateTypeScriptDeclarations({
				includeDeprecated: true,
			});

		expect(declarations).toContain(
			"'test.docs.typed': (args: [number, string]) => boolean;",
		);
	});
});
