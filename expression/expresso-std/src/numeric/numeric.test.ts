import { describe, expect, test } from "bun:test";
import { apply, createOperatorRegistry } from "@gooi/expresso-core";
import { verifyPlugin } from "@gooi/expresso-std/testing/verify-plugin";
import numericPlugin from "./plugin";

verifyPlugin(numericPlugin);

const operatorRegistry = createOperatorRegistry();
numericPlugin.register({ operatorRegistry });

describe("@std/numeric coercion", () => {
	test("coerces number-like strings", () => {
		expect(apply({ to_number: ["42.5"] }, {}, { operatorRegistry })).toBe(42.5);
		expect(apply({ to_integer: ["42"] }, {}, { operatorRegistry })).toBe(42);
	});

	test("returns null for invalid numeric coercions", () => {
		expect(apply({ to_number: ["abc"] }, {}, { operatorRegistry })).toBeNull();
		expect(
			apply({ to_integer: ["42.5"] }, {}, { operatorRegistry }),
		).toBeNull();
		expect(apply({ to_integer: [""] }, {}, { operatorRegistry })).toBeNull();
	});
});
