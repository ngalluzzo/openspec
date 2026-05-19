import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";
import { z } from "zod";
import {
	defineAsyncOperator,
	defineSyncOperator,
} from "../operators/define-operator";
import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import { init } from "../runtime/bootstrap/init";
import { apply, applyAsync } from "../runtime/compile/apply";

function metadata(name: string) {
	return {
		name,
		title: name,
		description: `${name} test operator`,
		category: "misc",
		tags: ["test"],
	};
}

describe("operator definition schema typing", () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	test("infers handler argument and return types from schemas", async () => {
		defineSyncOperator("test.typed_add", {
			inputSchema: z.tuple([z.number(), z.number()]),
			outputSchema: z.number(),
			handler: ([left, right]) => left + right,
			metadata: metadata("test.typed_add"),
		})();

		defineAsyncOperator("test.typed_async_add", {
			inputSchema: z.tuple([z.number(), z.number()]),
			outputSchema: z.number(),
			handler: async ([left, right]) => left + right,
			metadata: metadata("test.typed_async_add"),
		})();

		expect(apply({ "test.typed_add": [2, 3] }, {})).toBe(5);
		expect(await applyAsync({ "test.typed_async_add": [4, 7] }, {})).toBe(11);
	});

	test("preserves legacy generic callsites", () => {
		defineSyncOperator<[number, number], number>("test.legacy_add", {
			handler: (args) => args[0] + args[1],
			inputSchema: z.tuple([z.number(), z.number()]),
			outputSchema: z.number(),
			metadata: metadata("test.legacy_add"),
		})();

		expect(apply({ "test.legacy_add": [3, 9] }, {})).toBe(12);
	});

	test("enforces schema-driven typing at compile time", () => {
		// biome-ignore lint/correctness/noConstantCondition: type assertions only
		if (false) {
			defineSyncOperator("test.type_error", {
				inputSchema: z.tuple([z.number(), z.number()]),
				outputSchema: z.number(),
				// @ts-expect-error handler return type must match output schema
				handler: ([left, right]) => `${left + right}`,
				metadata: metadata("test.type_error"),
			});
		}
	});
});
