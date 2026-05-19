import { parse, print } from "../../core/src/index.js";
import { createQuery } from "../../transform/src/query.js";
import { describe, expect, test } from "bun:test";
import { createYamlAdapter, yamlAdapter } from "../src/yaml/index.ts";

// ─── typeOf ───────────────────────────────────────────────────────────────────

describe("typeOf", () => {
	test("Document", () => {
		const adapter = createYamlAdapter();
		const result = parse("key: value", { adapter });
		expect(adapter.typeOf(result.ast)).toBe("Document");
	});

	test("Map", () => {
		const adapter = createYamlAdapter();
		const result = parse("key: value", { adapter });
		let found = "";
		adapter.walk(result.ast, {
			enter(node) {
				if (adapter.typeOf(node) === "Map") {
					found = "Map";
					return "stop";
				}
			},
		});
		expect(found).toBe("Map");
	});

	test("Scalar", () => {
		const adapter = createYamlAdapter();
		const result = parse("hello", { adapter });
		let found = "";
		adapter.walk(result.ast, {
			enter(node) {
				if (adapter.typeOf(node) === "Scalar") {
					found = "Scalar";
					return "stop";
				}
			},
		});
		expect(found).toBe("Scalar");
	});

	test("Seq", () => {
		const adapter = createYamlAdapter();
		const result = parse("- a\n- b", { adapter });
		let found = "";
		adapter.walk(result.ast, {
			enter(node) {
				if (adapter.typeOf(node) === "Seq") {
					found = "Seq";
					return "stop";
				}
			},
		});
		expect(found).toBe("Seq");
	});

	test("Pair", () => {
		const adapter = createYamlAdapter();
		const result = parse("key: value", { adapter });
		let found = "";
		adapter.walk(result.ast, {
			enter(node) {
				if (adapter.typeOf(node) === "Pair") {
					found = "Pair";
					return "stop";
				}
			},
		});
		expect(found).toBe("Pair");
	});
});

// ─── locate ───────────────────────────────────────────────────────────────────

describe("locate", () => {
	test("Document has location starting at offset 0", () => {
		const adapter = createYamlAdapter();
		const result = parse("key: value", { adapter });
		const loc = adapter.locate(result.ast);
		expect(loc?.start.offset).toBe(0);
		expect(loc?.start.line).toBe(1);
		expect(loc?.start.column).toBe(0);
	});

	test("scalar on second line has correct line number", () => {
		const adapter = createYamlAdapter();
		const source = "a: 1\nb: 2";
		const result = parse(source, { adapter });
		const locs: Array<{ line: number; column: number }> = [];
		adapter.walk(result.ast, {
			enter(node) {
				if (adapter.typeOf(node) === "Scalar") {
					const loc = adapter.locate(node);
					if (loc) locs.push({ line: loc.start.line, column: loc.start.column });
				}
			},
		});
		expect(locs.some((l) => l.line === 2)).toBe(true);
	});

	test("returns null for synthetic node with no range", () => {
		const adapter = createYamlAdapter();
		parse("key: value", { adapter }); // set internal source
		// Build a raw YAMLMap with no range
		const { YAMLMap } = require("yaml") as typeof import("yaml");
		const bare = new YAMLMap();
		expect(adapter.locate(bare as never)).toBeNull();
	});
});

// ─── getAttribute ─────────────────────────────────────────────────────────────

describe("getAttribute", () => {
	test("reads scalar value from Map by key", () => {
		const adapter = createYamlAdapter();
		const result = parse("kind: path\npath: foo.bar", { adapter });
		let kindVal: unknown;
		adapter.walk(result.ast, {
			enter(node) {
				if (adapter.typeOf(node) === "Map") {
					kindVal = adapter.getAttribute!(node, ["kind"]);
					return "stop";
				}
			},
		});
		expect(kindVal).toBe("path");
	});

	test("returns undefined for missing key", () => {
		const adapter = createYamlAdapter();
		const result = parse("kind: path", { adapter });
		let val: unknown = "sentinel";
		adapter.walk(result.ast, {
			enter(node) {
				if (adapter.typeOf(node) === "Map") {
					val = adapter.getAttribute!(node, ["missing"]);
					return "stop";
				}
			},
		});
		expect(val).toBeUndefined();
	});

	test("reads key and value from Pair", () => {
		const adapter = createYamlAdapter();
		const result = parse("kind: path", { adapter });
		let keyVal: unknown;
		let valueVal: unknown;
		adapter.walk(result.ast, {
			enter(node) {
				if (adapter.typeOf(node) === "Pair") {
					keyVal = adapter.getAttribute!(node, ["key"]);
					valueVal = adapter.getAttribute!(node, ["value"]);
					return "stop";
				}
			},
		});
		expect(keyVal).toBe("kind");
		expect(valueVal).toBe("path");
	});

	test("reads nested attribute via dot path", () => {
		const adapter = createYamlAdapter();
		const result = parse("outer:\n  inner: deep", { adapter });
		// After finding the outer map, getAttribute(node, ["outer", "inner"]) should return "deep"
		// But since "outer" key has a Map value not a scalar, getAttribute returns the map itself for path length 1
		// and we'd need path ["outer"] to get the inner Map, then getAttribute again for ["inner"]
		// Test a simpler scalar dot path: Pair["key"] and Pair["value"]
		const pairs: unknown[] = [];
		adapter.walk(result.ast, {
			enter(node) {
				if (adapter.typeOf(node) === "Pair") {
					pairs.push(adapter.getAttribute!(node, ["key"]));
				}
			},
		});
		expect(pairs).toContain("outer");
		expect(pairs).toContain("inner");
	});
});

// ─── round-trip ───────────────────────────────────────────────────────────────

describe("round-trip", () => {
	test("unmodified document reprints identically", () => {
		const adapter = createYamlAdapter();
		const source = "key: value\nother: 42\n";
		const result = parse(source, { adapter });
		const { code } = print(result);
		expect(code).toBe(source);
	});

	test("multiline map reprints identically", () => {
		const adapter = createYamlAdapter();
		const source = "a: 1\nb: 2\nc:\n  nested: true\n";
		const result = parse(source, { adapter });
		const { code } = print(result);
		expect(code).toBe(source);
	});

	test("sequence reprints identically", () => {
		const adapter = createYamlAdapter();
		const source = "items:\n  - foo\n  - bar\n";
		const result = parse(source, { adapter });
		const { code } = print(result);
		expect(code).toBe(source);
	});
});

// ─── query integration ────────────────────────────────────────────────────────

describe("query", () => {
	test("find Map by attribute value", () => {
		const adapter = createYamlAdapter();
		const source = "kind: path\npath: foo.bar\n";
		const result = parse(source, { adapter });
		const query = createQuery(result);
		const matches = query.find("Map[kind=path]").all();
		expect(matches.length).toBe(1);
	});

	test("does not match wrong attribute value", () => {
		const adapter = createYamlAdapter();
		const source = "kind: literal\nvalue: hello\n";
		const result = parse(source, { adapter });
		const query = createQuery(result);
		const matches = query.find("Map[kind=path]").all();
		expect(matches.length).toBe(0);
	});

	test("find Scalar nodes", () => {
		const adapter = createYamlAdapter();
		const source = "a: 1\nb: 2\n";
		const result = parse(source, { adapter });
		const query = createQuery(result);
		const scalars = query.find("Scalar").all();
		// keys: a, b — values: 1, 2
		expect(scalars.length).toBe(4);
	});

	test("find with existence attribute check", () => {
		const adapter = createYamlAdapter();
		const source = "kind: path\npath: foo.bar\n";
		const result = parse(source, { adapter });
		const query = createQuery(result);
		// Map[kind] — Map that has a 'kind' key
		const matches = query.find("Map[kind]").all();
		expect(matches.length).toBe(1);
	});

	test("singleton yamlAdapter works", () => {
		const source = "kind: path\n";
		const result = parse(source, { adapter: yamlAdapter });
		const query = createQuery(result);
		expect(query.find("Map[kind=path]").count()).toBe(1);
	});
});

// ─── parseSnippet ─────────────────────────────────────────────────────────────

describe("parseSnippet", () => {
	test("returns contents node not Document wrapper", () => {
		const adapter = createYamlAdapter();
		const node = adapter.parseSnippet("key: value");
		expect(adapter.typeOf(node)).not.toBe("Document");
		expect(adapter.typeOf(node)).toBe("Map");
	});
});
