import { describe, expect, test } from "bun:test";
import { evalMini } from "../src/lowering/mini-lang.ts";

describe("evalMini", () => {
	test("literal", () => {
		expect(evalMini({ kind: "literal", value: 42 }, {})).toBe(42);
	});

	test("path", () => {
		expect(evalMini({ kind: "path", path: "a.b" }, { a: { b: "hello" } })).toBe("hello");
	});

	test("path optional returns null when missing", () => {
		expect(evalMini({ kind: "path", path: "x.y", optional: true }, {})).toBeNull();
	});

	test("concat", () => {
		const result = evalMini(
			{ kind: "concat", items: [{ kind: "literal", value: "foo" }, { kind: "literal", value: "bar" }] },
			{},
		);
		expect(result).toBe("foobar");
	});

	test("after extracts the suffix after a separator", () => {
		expect(
			evalMini(
				{
					kind: "after",
					value: { kind: "literal", value: "operation.operation:crm.createAccount" },
					separator: ":",
				},
				{},
			),
		).toBe("crm.createAccount");
	});

	test("pascal normalizes names", () => {
		expect(
			evalMini(
				{ kind: "pascal", value: { kind: "literal", value: "crm.account-record" } },
				{},
			),
		).toBe("CrmAccountRecord");
	});

	test("camel normalizes names", () => {
		expect(
			evalMini(
				{ kind: "camel", value: { kind: "literal", value: "Sales Rep" } },
				{},
			),
		).toBe("salesRep");
	});

	test("camel normalizes acronyms", () => {
		expect(
			evalMini(
				{ kind: "camel", value: { kind: "literal", value: "URL Value" } },
				{},
			),
		).toBe("urlValue");
	});

	test("kebab normalizes names", () => {
		expect(
			evalMini(
				{ kind: "kebab", value: { kind: "literal", value: "SalesReps" } },
				{},
			),
		).toBe("sales-reps");
	});

	test("array evaluates item expressions", () => {
		expect(
			evalMini(
				{
					kind: "array",
					items: [
						{ kind: "path", path: "left" },
						{ kind: "literal", value: "right" },
					],
				},
				{ left: "left" },
			),
		).toEqual(["left", "right"]);
	});

	test("arrayConcat flattens evaluated arrays", () => {
		expect(
			evalMini(
				{
					kind: "arrayConcat",
					items: [
						{ kind: "path", path: "base" },
						{ kind: "array", items: [{ kind: "literal", value: "tail" }] },
					],
				},
				{ base: ["head"] },
			),
		).toEqual(["head", "tail"]);
	});

	test("object", () => {
		expect(
			evalMini({ kind: "object", fields: { x: { kind: "literal", value: 1 } } }, {}),
		).toEqual({ x: 1 });
	});

	test("objectFromEntries builds records from arrays", () => {
		expect(
			evalMini(
				{
					kind: "objectFromEntries",
					path: "methods",
					as: "method",
					key: { kind: "path", path: "method.name" },
					value: {
						kind: "object",
						fields: {
							output: { kind: "path", path: "method.output" },
						},
					},
				},
				{
					methods: [
						{ name: "createAccount", output: "AccountRecord" },
						{ name: "listAccounts", output: "AccountList" },
					],
				},
			),
		).toEqual({
			createAccount: { output: "AccountRecord" },
			listAccounts: { output: "AccountList" },
		});
	});

	test("when truthy", () => {
		expect(
			evalMini(
				{ kind: "when", condition: { kind: "literal", value: true }, then: { kind: "literal", value: "yes" } },
				{},
			),
		).toBe("yes");
	});

	test("when falsy returns null", () => {
		expect(
			evalMini(
				{ kind: "when", condition: { kind: "literal", value: false }, then: { kind: "literal", value: "yes" } },
				{},
			),
		).toBeNull();
	});

	test("equals true", () => {
		expect(
			evalMini({ kind: "equals", left: { kind: "literal", value: "a" }, right: { kind: "literal", value: "a" } }, {}),
		).toBe(true);
	});

	test("equals false", () => {
		expect(
			evalMini({ kind: "equals", left: { kind: "literal", value: "a" }, right: { kind: "literal", value: "b" } }, {}),
		).toBe(false);
	});

	test("map over array", () => {
		expect(
			evalMini(
				{ kind: "map", path: "items", as: "item", value: { kind: "path", path: "item.name" } },
				{ items: [{ name: "a" }, { name: "b" }] },
			),
		).toEqual(["a", "b"]);
	});

	test("find returns the first matching item", () => {
		expect(
			evalMini(
				{
					kind: "find",
					path: "items",
					as: "item",
					condition: {
						kind: "equals",
						left: { kind: "path", path: "item.key" },
						right: { kind: "literal", value: "object_2" },
					},
				},
				{ items: [{ key: "object_1" }, { key: "object_2", name: "Contacts" }] },
			),
		).toEqual({ key: "object_2", name: "Contacts" });
	});

	test("find.value returns a mapped value", () => {
		expect(
			evalMini(
				{
					kind: "find",
					path: "items",
					as: "item",
					condition: {
						kind: "equals",
						left: { kind: "path", path: "item.key" },
						right: { kind: "literal", value: "object_2" },
					},
					value: { kind: "path", path: "item.name" },
				},
				{ items: [{ key: "object_1", name: "Accounts" }, { key: "object_2", name: "Contacts" }] },
			),
		).toBe("Contacts");
	});

	test("find returns default or null when missing", () => {
		expect(
			evalMini(
				{
					kind: "find",
					path: "items",
					as: "item",
					condition: {
						kind: "equals",
						left: { kind: "path", path: "item.key" },
						right: { kind: "literal", value: "object_3" },
					},
					default: { kind: "literal", value: "missing" },
				},
				{ items: [{ key: "object_1" }] },
			),
		).toBe("missing");

		expect(
			evalMini(
				{
					kind: "find",
					path: "items",
					as: "item",
					condition: {
						kind: "equals",
						left: { kind: "path", path: "item.key" },
						right: { kind: "literal", value: "object_3" },
					},
				},
				{ items: [{ key: "object_1" }] },
			),
		).toBeNull();
	});

	test("find resolves a Knack-style connection target object key", () => {
		expect(
			evalMini(
				{
					kind: "find",
					path: "snapshot.application.objects",
					as: "target",
					condition: {
						kind: "equals",
						left: { kind: "path", path: "target.key" },
						right: { kind: "path", path: "connection.object" },
					},
					value: { kind: "path", path: "target.name" },
				},
				{
					connection: { object: "object_2" },
					snapshot: {
						application: {
							objects: [
								{ key: "object_1", name: "Accounts" },
								{ key: "object_2", name: "Contacts" },
							],
						},
					},
				},
			),
		).toBe("Contacts");
	});

	test("unknown kind throws with a descriptive message", () => {
		expect(() =>
			evalMini({ kind: "typo", value: 1 }, {}),
		).toThrow('mini-lang: unknown expression kind "typo"');
	});

	describe("deepCollect", () => {
		test("collects from flat object", () => {
			const result = evalMini(
				{
					kind: "deepCollect",
					path: "root",
					select: {
						kind: "when",
						condition: {
							kind: "equals",
							left: { kind: "path", path: "$node.kind" },
							right: { kind: "literal", value: "ref" },
						},
						then: { kind: "path", path: "$node.name" },
					},
				},
				{ root: { kind: "ref", name: "Foo" } },
			);
			expect(result).toEqual(["Foo"]);
		});

		test("recurses into nested objects", () => {
			const result = evalMini(
				{
					kind: "deepCollect",
					path: "root",
					select: {
						kind: "when",
						condition: {
							kind: "equals",
							left: { kind: "path", path: "$node.kind" },
							right: { kind: "literal", value: "ref" },
						},
						then: { kind: "path", path: "$node.name" },
					},
				},
				{ root: { kind: "array", item: { kind: "ref", name: "Bar" } } },
			);
			expect(result).toContain("Bar");
		});

		test("recurses into arrays", () => {
			const result = evalMini(
				{
					kind: "deepCollect",
					path: "root",
					select: {
						kind: "when",
						condition: {
							kind: "equals",
							left: { kind: "path", path: "$node.kind" },
							right: { kind: "literal", value: "ref" },
						},
						then: { kind: "path", path: "$node.name" },
					},
				},
				{
					root: {
						kind: "union",
						options: [{ kind: "ref", name: "A" }, { kind: "ref", name: "B" }],
					},
				},
			);
			expect(result).toEqual(expect.arrayContaining(["A", "B"]));
		});

		test("returns empty array for null root with optional", () => {
			const result = evalMini(
				{
					kind: "deepCollect",
					path: "missing",
					optional: true,
					select: { kind: "path", path: "$node.name" },
				},
				{},
			);
			expect(result).toEqual([]);
		});

		test("collects from deeply nested tree", () => {
			const result = evalMini(
				{
					kind: "deepCollect",
					path: "root",
					select: {
						kind: "when",
						condition: {
							kind: "equals",
							left: { kind: "path", path: "$node.kind" },
							right: { kind: "literal", value: "ref" },
						},
						then: { kind: "path", path: "$node.name" },
					},
				},
				{
					root: {
						kind: "array",
						item: {
							kind: "union",
							options: [
								{ kind: "ref", name: "X" },
								{ kind: "array", item: { kind: "ref", name: "Y" } },
							],
						},
					},
				},
			);
			expect(result).toEqual(expect.arrayContaining(["X", "Y"]));
		});
	});
});
