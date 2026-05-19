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

describe("output schema validation", () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	test("keeps existing behavior when validateOutput is false", () => {
		defineSyncOperator("test.bad_output_sync", {
			inputSchema: z.tuple([z.number()]),
			outputSchema: z.number(),
			handler: ([value]) => String(value),
			metadata: metadata("test.bad_output_sync"),
		})();

		expect(apply({ "test.bad_output_sync": [7] }, {})).toBe("7");
	});

	test("throws when sync operator output violates outputSchema", () => {
		defineSyncOperator("test.bad_output_sync_strict", {
			inputSchema: z.tuple([z.number()]),
			outputSchema: z.number(),
			handler: ([value]) => String(value),
			metadata: metadata("test.bad_output_sync_strict"),
		})();

		expect(() =>
			apply(
				{ "test.bad_output_sync_strict": [7] },
				{},
				{ validateOutput: true },
			),
		).toThrow(/Invalid output for operator "test.bad_output_sync_strict"/);
	});

	test("throws when async operator output violates outputSchema", async () => {
		defineAsyncOperator("test.bad_output_async", {
			inputSchema: z.tuple([z.number()]),
			outputSchema: z.number(),
			handler: async ([value]) => String(value),
			metadata: metadata("test.bad_output_async"),
		})();

		await expect(
			applyAsync(
				{ "test.bad_output_async": [9] },
				{},
				{ validateOutput: true },
			),
		).rejects.toThrow(/Invalid output for operator "test.bad_output_async"/);
	});
});
