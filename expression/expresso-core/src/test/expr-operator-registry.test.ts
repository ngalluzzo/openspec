import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";
import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import { init } from "../runtime/bootstrap/init";
import { expr } from "../runtime/compile/expr";
import {
	createOperatorTypeRegistry,
	type OperatorTypeDescriptor,
} from "../runtime/compile/operator-types";

type DemoInput = {
	readonly user: {
		readonly age: number;
	};
	readonly items: readonly {
		readonly score: number;
	}[];
};

const demoInput: DemoInput = {
	user: { age: 42 },
	items: [{ score: 10 }, { score: 20 }],
};

const operatorTypes = createOperatorTypeRegistry([
	{
		id: ">",
	} as OperatorTypeDescriptor<">", readonly [number, number], boolean>,
	{
		id: "+",
	} as OperatorTypeDescriptor<"+", readonly [number, number], number>,
] as const);

describe("typed operator registry integration", () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	test("enforces operator ids and tuple args at compile time", () => {
		const typed = expr<DemoInput>().withOperators(operatorTypes);
		const adultExpr = typed.op(">", typed.var("user.age"), 18);
		const boostedScoreExpr = typed.op("+", typed.var("items.0.score"), 7);

		const isAdult: boolean = adultExpr.apply(demoInput);
		const boosted: number = boostedScoreExpr.apply(demoInput);

		expect(isAdult).toBe(true);
		expect(boosted).toBe(17);
		expect(adultExpr.toRule()).toEqual({
			">": [{ var: "user.age" }, 18],
		});

		// biome-ignore lint/correctness/noConstantCondition: type assertions only
		if (false) {
			// @ts-expect-error operator id must exist in registry
			typed.op("<", 1, 2);

			// @ts-expect-error second arg must be number for this descriptor
			typed.op(">", typed.var("user.age"), "18");

			// @ts-expect-error tuple size must match descriptor
			typed.op("+", 1);
		}
	});
});
