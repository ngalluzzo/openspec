import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";
import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import {
	clearStandardOperators,
	init,
	registerStandardOperators,
} from "../runtime/bootstrap/init";
import { apply, applyAsync } from "../runtime/compile/apply";
import { rule } from "../runtime/compile/builder";

describe("runtime regressions", () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	test("applyAsync preserves raw control-flow branches in lazy mode", async () => {
		const value = await applyAsync(
			{
				if: [
					true,
					"selected",
					{ throw: ["should-not-run", "ERR_UNREACHABLE"] },
				],
			},
			{},
		);
		expect(value).toBe("selected");
	});

	test("rule builder in() keeps rule operand as needle", () => {
		const membership = rule().var("x").in([1, 2, 3]);
		expect(membership.build()).toEqual({
			in: [{ var: "x" }, [1, 2, 3]],
		});
		expect(membership.apply({ x: 2 })).toBe(true);
		expect(membership.apply({ x: 9 })).toBe(false);
	});

	test("clearStandardOperators allows clean re-registration", async () => {
		expect(apply({ "==": [1, 1] }, {})).toBe(true);

		clearStandardOperators();
		await registerStandardOperators();

		expect(apply({ "==": [1, 1] }, {})).toBe(true);
	});

	test("path operators and var access reject unsafe prototype paths", () => {
		const input: Record<string, unknown> = {};
		const before = ({} as Record<string, unknown>).polluted;

		const updated = apply<Record<string, unknown>, Record<string, unknown>>(
			{ set: [input, "__proto__.polluted", "yes"] },
			{},
		);

		expect(apply({ get: [updated, "__proto__.polluted"] }, {})).toBeUndefined();
		expect(apply({ has: [updated, "__proto__.polluted"] }, {})).toBe(false);
		expect(apply({ var: "__proto__.polluted" }, {})).toBeUndefined();
		expect(({} as Record<string, unknown>).polluted).toBe(before);
	});
});
