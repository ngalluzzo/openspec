import { describe, expect, it } from "bun:test";
import { createOperatorRegistry, mergeRegistries } from "../../src/index";

describe("operator registry", () => {
	it("creates empty registry", () => {
		const reg = createOperatorRegistry();
		expect(reg.has("foo")).toBe(false);
	});

	it("registers function operator", () => {
		const reg = createOperatorRegistry().registerFunction({
			kind: "function",
			ruleKey: "custom",
			minArgs: 1,
			maxArgs: 2,
		});
		expect(reg.has("custom")).toBe(true);
		expect(reg.getFunction("custom")).toEqual({
			kind: "function",
			ruleKey: "custom",
			minArgs: 1,
			maxArgs: 2,
		});
	});

	it("registers prefix operator", () => {
		const reg = createOperatorRegistry().registerPrefix({
			kind: "prefix-unary",
			ruleKey: "not",
		});
		expect(reg.getPrefix("not")).toEqual({
			kind: "prefix-unary",
			ruleKey: "not",
		});
	});

	it("registers infix operator", () => {
		const reg = createOperatorRegistry().registerInfix({
			kind: "infix",
			ruleKey: "++",
			precedence: 5,
		});
		expect(reg.getInfix("++")).toEqual({
			kind: "infix",
			ruleKey: "++",
			precedence: 5,
		});
	});

	it("is immutable", () => {
		const reg1 = createOperatorRegistry();
		const reg2 = reg1.registerFunction({
			kind: "function",
			ruleKey: "test",
			minArgs: 0,
			maxArgs: 0,
		});
		expect(reg1.has("test")).toBe(false);
		expect(reg2.has("test")).toBe(true);
	});

	it("merges registries", () => {
		const reg1 = createOperatorRegistry().registerFunction({
			kind: "function",
			ruleKey: "a",
			minArgs: 0,
			maxArgs: 0,
		});
		const reg2 = createOperatorRegistry().registerFunction({
			kind: "function",
			ruleKey: "b",
			minArgs: 0,
			maxArgs: 0,
		});
		const merged = mergeRegistries(reg1, reg2);
		expect(merged.has("a")).toBe(true);
		expect(merged.has("b")).toBe(true);
	});
});
