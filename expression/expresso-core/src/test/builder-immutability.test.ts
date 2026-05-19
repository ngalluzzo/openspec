import { describe, expect, test } from "bun:test";
import "./register-std";
import { rule } from "../runtime/compile/builder";

describe("legacy builder immutability", () => {
	test("does not mutate source builder instances", () => {
		const base = rule().var("user.age");
		const gtRule = base.gt(18);
		const ltRule = base.lt(65);

		expect(base.build()).toEqual({ var: "user.age" });
		expect(gtRule.build()).toEqual({ ">": [{ var: "user.age" }, 18] });
		expect(ltRule.build()).toEqual({ "<": [{ var: "user.age" }, 65] });
	});

	test("compose returns a new builder and leaves original untouched", () => {
		const base = rule().var("user.age");
		const composed = base.compose({ var: "user.score" });

		expect(base.build()).toEqual({ var: "user.age" });
		expect(composed.build()).toEqual({ var: "user.score" });
	});
});
