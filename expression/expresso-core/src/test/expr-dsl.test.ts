import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";
import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import { init } from "../runtime/bootstrap/init";
import { apply } from "../runtime/compile/apply";
import { expr } from "../runtime/compile/expr";

type DemoInput = {
	readonly user: {
		readonly age: number;
		readonly profile: {
			readonly name: string;
		};
	};
	readonly items: readonly {
		readonly score: number;
	}[];
};

const demoInput: DemoInput = {
	user: {
		age: 42,
		profile: {
			name: "Ada",
		},
	},
	items: [{ score: 10 }, { score: 20 }],
};

describe("typed expression DSL", () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	test("builds canonical var rules and evaluates them", () => {
		const ageExpr = expr<DemoInput>().var("user.age");
		const scoreExpr = expr<DemoInput>().var("items.0.score");

		expect(ageExpr.toRule()).toEqual({ var: "user.age" });
		expect(ageExpr.apply(demoInput)).toBe(42);
		expect(apply(scoreExpr.toRule(), demoInput)).toBe(10);
	});

	test("supports raw var paths for dynamic jsonlogic semantics", () => {
		const rootExpr = expr<DemoInput>().varRaw("");

		expect(rootExpr.toRule()).toEqual({ var: "" });
		expect(rootExpr.apply(demoInput)).toEqual(demoInput);
	});

	test("enforces input and output typing at compile time", () => {
		const ageExpr = expr<DemoInput>().var("user.age");
		const age: number = ageExpr.apply(demoInput);
		expect(age).toBe(42);

		// biome-ignore lint/correctness/noConstantCondition: type assertions only
		if (false) {
			// @ts-expect-error path must exist on the input shape
			expr<DemoInput>().var("user.unknown");

			// @ts-expect-error resolved path type is number
			const wrongType: string = ageExpr.apply(demoInput);
			void wrongType;

			// @ts-expect-error input object must satisfy DemoInput
			ageExpr.apply({ user: { age: 42 } });
		}
	});
});
