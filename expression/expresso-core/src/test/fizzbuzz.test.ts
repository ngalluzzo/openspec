import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";

import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import { init } from "../runtime/bootstrap/init";
import { applyAsync } from "../runtime/compile/apply";

describe("FizzBuzz", () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	test("should solve FizzBuzz with map and if operators", async () => {
		const rule = {
			map: [
				{ var: "list" },
				{
					if: [
						{ "==": [{ "%": [{ var: "" }, 15] }, 0] },
						"fizzbuzz",

						{ "==": [{ "%": [{ var: "" }, 3] }, 0] },
						"fizz",

						{ "==": [{ "%": [{ var: "" }, 5] }, 0] },
						"buzz",

						{ var: "" },
					],
				},
			],
		};

		const data = {
			list: [
				1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
			],
		};
		const result = await applyAsync(rule, data);

		expect(result).toEqual([
			1,
			2,
			"fizz",
			4,
			"buzz",
			"fizz",
			7,
			8,
			"fizz",
			"buzz",
			11,
			"fizz",
			13,
			14,
			"fizzbuzz",
			16,
			17,
			"fizz",
			19,
			"buzz",
		]);
	});
});
