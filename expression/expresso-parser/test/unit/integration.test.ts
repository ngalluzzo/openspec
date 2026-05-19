import { describe, expect, it } from "bun:test";
import { ruleSchema } from "@gooi/expresso";
import { z } from "zod";
import { parseExpression } from "../../src/index";

const exprEnvelopeSchema = z.object({
	$expr: ruleSchema,
});

describe("integration", () => {
	it("validates output against expresso rule schema", () => {
		const cases = [
			"user.age > 18",
			"a && b || c",
			"!active",
			'"admin" in user.roles',
			'cat("Hello ", name)',
			"map(items, item => item.price * 2)",
			"filter(items, item => item.active)",
			"reduce(nums, (acc, n) => acc + n, 0)",
			'if(x > 0, "pos", "neg")',
			'@data(#{ key: "value" })',
			'var("../parentField")',
			"[1, 2, user.name]",
			"#{ name: user.name, age: 30 }",
		];

		for (const expr of cases) {
			const result = parseExpression(expr);
			expect(result.ok).toBe(true);
			if (!result.ok) {
				console.error(`Failed to parse: ${expr}`);
				console.error(result.error.format());
				continue;
			}

			const ruleValidation = ruleSchema.safeParse(result.rule);
			expect(ruleValidation.success).toBe(true);
			if (!ruleValidation.success) {
				console.error(`Rule validation failed for: ${expr}`);
				console.error(ruleValidation.error);
			}

			const envelopeValidation = exprEnvelopeSchema.safeParse(result.envelope);
			expect(envelopeValidation.success).toBe(true);
			if (!envelopeValidation.success) {
				console.error(`Envelope validation failed for: ${expr}`);
				console.error(envelopeValidation.error);
			}
		}
	});

	it("complex nested expression validates", () => {
		const expr =
			'if(user.age >= 18 && "admin" in user.roles, "allowed", "denied")';
		const result = parseExpression(expr);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.rule).toEqual({
			if: [
				{
					and: [
						{ ">=": [{ var: "user.age" }, 18] },
						{ in: ["admin", { var: "user.roles" }] },
					],
				},
				"allowed",
				"denied",
			],
		});

		const validation = ruleSchema.safeParse(result.rule);
		expect(validation.success).toBe(true);
	});

	it("deeply nested lambdas validate", () => {
		const expr = "map(outer, o => map(inner, i => o.id + i.id))";
		const result = parseExpression(expr);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const validation = ruleSchema.safeParse(result.rule);
		expect(validation.success).toBe(true);
	});
});
