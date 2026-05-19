import { describe, expect, test } from "bun:test";
import {
	expression,
	isExpressionEnvelope,
	parseExpressionEnvelope,
	toExpressionEnvelope,
	unwrapExpression,
} from "../src/expresso";

describe("@gooi/expresso wire contract", () => {
	test("creates a canonical serialized expression envelope", () => {
		const value = expression({ var: "data.tracks" });

		expect(value).toEqual({
			$expr: {
				var: "data.tracks",
			},
		});
		expect(isExpressionEnvelope(value)).toBe(true);
		expect(unwrapExpression(value)).toEqual({
			var: "data.tracks",
		});
	});

	test("parses structurally serialized expressions without branding", () => {
		const serialized = JSON.parse(
			JSON.stringify({
				$expr: {
					"==": [{ var: "route.trackId" }, "LAS-18"],
				},
			}),
		);

		expect(isExpressionEnvelope(serialized)).toBe(true);
		expect(parseExpressionEnvelope(serialized)).toEqual(serialized);
	});

	test("normalizes bare rules into the canonical envelope", () => {
		expect(toExpressionEnvelope({ var: "session.email" })).toEqual({
			$expr: {
				var: "session.email",
			},
		});
	});

	test("rejects non-rule envelopes", () => {
		expect(
			isExpressionEnvelope({
				$expr: {
					nested: () => "not serializable",
				},
			}),
		).toBe(false);

		expect(() =>
			parseExpressionEnvelope({
				$expr: {
					nested: () => "not serializable",
				},
			}),
		).toThrow();
	});
});
