import { describe, expect, it } from "bun:test";
import ts from "typescript";
import { parse, print, snippet } from "../../core/src/index.js";
import { createQuery } from "../../transform/src/query.js";
import { tsAdapter } from "../src/typescript/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function transform(
	source: string,
	fn: (
		query: ReturnType<typeof createQuery<ts.Node>>,
		result: ReturnType<typeof parse<ts.Node>>,
	) => void,
): string {
	const result = parse(source, { adapter: tsAdapter });
	fn(createQuery(result), result);
	return print(result).code;
}

// ─── Identity guarantee ───────────────────────────────────────────────────────

describe("identity guarantee", () => {
	const sources = [
		`const x = 1;`,
		`import React from "react";`,
		`export function add(a: number, b: number): number {\n  return a + b;\n}`,
		`// comment\nconst   x   =   42; // trailing`,
		`type Foo = { bar: string; baz: number };`,
		`const fn = async () => {\n  await something();\n};`,
		`class MyClass {\n  constructor(private name: string) {}\n}`,
		// Weird formatting — the whole point of reforge
		`const   obj   =   {   a:   1,   b:   2   };`,
		`function  weirdSpacing  (  a ,  b  )  {  return  a  +  b  }`,
	];

	for (const source of sources) {
		it(`round-trips: ${source.slice(0, 50).replace(/\n/g, "↵")}`, () => {
			const result = parse(source, { adapter: tsAdapter });
			expect(print(result).code).toBe(source);
		});
	}
});

// ─── typeOf ───────────────────────────────────────────────────────────────────

describe("typeOf", () => {
	it("identifies SourceFile", () => {
		const sf = tsAdapter.parse("const x = 1;") as ts.SourceFile;
		expect(tsAdapter.typeOf(sf)).toBe("SourceFile");
	});

	it("identifies ImportDeclaration", () => {
		const sf = tsAdapter.parse(`import React from "react";`) as ts.SourceFile;
		expect(tsAdapter.typeOf(sf.statements[0]!)).toBe("ImportDeclaration");
	});
});

// ─── locate ───────────────────────────────────────────────────────────────────

describe("locate", () => {
	it("returns correct offset for an identifier", () => {
		const source = `const hello = 1;`;
		const sf = tsAdapter.parse(source) as ts.SourceFile;
		const stmt = sf.statements[0];
		if (!stmt) throw new Error("No statements");
		const decl = stmt as ts.VariableStatement;
		const firstDecl = decl.declarationList.declarations[0];
		if (!firstDecl) throw new Error("No declarations");
		const binding = firstDecl.name;
		const loc = tsAdapter.locate(binding)!;
		expect(loc.start.offset).toBe(6); // "hello" starts at index 6
		expect(source.slice(loc.start.offset, loc.end.offset)).toBe("hello");
	});

	it("returns null for synthetic nodes", () => {
		const synthetic = ts.factory.createIdentifier("foo");
		expect(tsAdapter.locate(synthetic)).toBeNull();
	});
});

// ─── walk ─────────────────────────────────────────────────────────────────────

describe("walk", () => {
	it("visits all nodes depth-first", () => {
		const source = `const x = foo();`;
		const sf = tsAdapter.parse(source);
		const types: string[] = [];
		tsAdapter.walk(sf, {
			enter: (n) => {
				types.push(tsAdapter.typeOf(n));
				return undefined;
			},
		});
		expect(types).toContain("SourceFile");
		expect(types).toContain("VariableStatement");
		expect(types).toContain("CallExpression");
		expect(types).toContain("Identifier");
	});

	it("skip stops descent into children", () => {
		const source = `function foo() { const x = bar(); }`;
		const sf = tsAdapter.parse(source);
		const types: string[] = [];
		tsAdapter.walk(sf, {
			enter(n) {
				types.push(tsAdapter.typeOf(n));
				if (tsAdapter.typeOf(n) === "FunctionDeclaration") return "skip";
			},
		});
		expect(types).toContain("FunctionDeclaration");
		expect(types).not.toContain("CallExpression"); // inside the skipped fn
	});

	it("stop halts the entire walk", () => {
		const source = `const a = 1;\nconst b = 2;\nconst c = 3;`;
		const sf = tsAdapter.parse(source);
		const types: string[] = [];
		tsAdapter.walk(sf, {
			enter(n) {
				types.push(tsAdapter.typeOf(n));
				if (types.length >= 3) return "stop";
			},
		});
		expect(types.length).toBeLessThanOrEqual(3);
	});
});

// ─── query integration ────────────────────────────────────────────────────────

describe("query + tsAdapter", () => {
	it("finds ImportDeclaration nodes", () => {
		const source = `import React from "react";\nimport { useState } from "react";`;
		const result = parse(source, { adapter: tsAdapter });
		const query = createQuery(result);
		expect(query.find("ImportDeclaration").count()).toBe(2);
	});

	it("finds by nested attribute — callee name", () => {
		const source = `require("lodash");\nrequire("react");`;
		const result = parse(source, { adapter: tsAdapter });
		const query = createQuery(result);
		// CallExpression where expression is Identifier "require"
		const calls = query.find("CallExpression").where((p) => {
			const node = p.node as ts.CallExpression;
			return (
				ts.isIdentifier(node.expression) && node.expression.text === "require"
			);
		});
		expect(calls.count()).toBe(2);
	});

	it("maps to extract data from nodes", () => {
		const source = `import a from "alpha";\nimport b from "beta";`;
		const result = parse(source, { adapter: tsAdapter });
		const query = createQuery(result);
		const specifiers = query.find("ImportDeclaration").map((p) => {
			const node = p.node as ts.ImportDeclaration;
			return (node.moduleSpecifier as ts.StringLiteral).text;
		});
		expect(specifiers.sort()).toEqual(["alpha", "beta"]);
	});
});

// ─── format-preserving mutations ─────────────────────────────────────────────

describe("format-preserving mutations", () => {
	it("preserves surrounding formatting when renaming a variable", () => {
		const source = `const   hello   =   42;`;
		const output = transform(source, (query) => {
			query
				.find("Identifier")
				.where((p) => (p.node as ts.Identifier).text === "hello")
				.mutate((p) => {
					// text is a getter derived from escapedText — mutate via Object.defineProperty
					Object.defineProperty(p.node, "escapedText", { value: "world" });
				});
		});
		// Weird spacing around = should be preserved
		expect(output).toContain("=   42");
	});

	it("remove() splices a node out of its parent NodeArray", () => {
		const source = `const a = 1;\nconst b = 2;\nconst c = 3;`;
		const result = parse(source, { adapter: tsAdapter });
		const query = createQuery(result);

		query
			.find("VariableStatement")
			.where((p) => {
				const decls = (p.node as ts.VariableStatement).declarationList
					.declarations;
				const firstDecl = decls[0];
				if (!firstDecl) return false;
				const name = firstDecl.name as ts.Identifier;
				return name.text === "b";
			})
			.remove();

		const sf = result.ast as ts.SourceFile;
		const names = sf.statements.filter(ts.isVariableStatement).map((s) => {
			const firstDecl = s.declarationList.declarations[0];
			if (!firstDecl) return "";
			return (firstDecl.name as ts.Identifier).text;
		});

		expect(names).not.toContain("b");
		expect(names).toContain("a");
		expect(names).toContain("c");
	});
});

// ─── snippet ─────────────────────────────────────────────────────────────────

describe("parseSnippet", () => {
	it("returns the expression for a single expression statement", () => {
		const node = tsAdapter.parseSnippet(`foo()`);
		expect(tsAdapter.typeOf(node)).toBe("CallExpression");
	});

	it("returns the statement for a declaration", () => {
		const node = tsAdapter.parseSnippet(`const x = 1;`);
		expect(tsAdapter.typeOf(node)).toBe("VariableStatement");
	});

	it("snippet() helper round-trips through the adapter", () => {
		const node = snippet(`import fs from "node:fs";`, { adapter: tsAdapter });
		expect(tsAdapter.typeOf(node)).toBe("ImportDeclaration");
	});
});

// ─── optional printer ─────────────────────────────────────────────────────────

describe("tsAdapter.print", () => {
	it("prints a synthetic identifier", () => {
		const ident = ts.factory.createIdentifier("hello");
		expect(tsAdapter.print?.(ident)).toBe("hello");
	});

	it("prints a synthetic import declaration", () => {
		const imp = ts.factory.createImportDeclaration(
			undefined,
			ts.factory.createImportClause(
				false,
				ts.factory.createIdentifier("React"),
				undefined,
			),
			ts.factory.createStringLiteral("react"),
		);
		const output = tsAdapter.print?.(imp);
		expect(output).toContain("React");
		expect(output).toContain("react");
	});
});

// ─── extractDeclarations ──────────────────────────────────────────────────────

import { semanticDiff } from "@reforge/core";
import { extractDeclarations } from "../src/typescript/index.js";

describe("extractDeclarations", () => {
	function parse(source: string) {
		return ts.createSourceFile("test.ts", source, ts.ScriptTarget.Latest, true);
	}

	function first<T>(arr: T[]): T {
		if (!arr[0]) throw new Error("Array is empty");
		return arr[0];
	}

	it("extracts function declarations", () => {
		const sf = parse(`export function foo() {}\nexport function bar() {}`);
		const decls = extractDeclarations(sf, sf.text);
		expect(decls.map((d) => d.name)).toContain("foo");
		expect(decls.map((d) => d.name)).toContain("bar");
		expect(decls.every((d) => d.kind === "function")).toBe(true);
	});

	it("extracts class declarations", () => {
		const sf = parse(`class MyService {}\n`);
		const decls = extractDeclarations(sf, sf.text);
		expect(first(decls).kind).toBe("class");
		expect(first(decls).name).toBe("MyService");
	});

	it("extracts interface declarations", () => {
		const sf = parse(`interface User { name: string; }\n`);
		const decls = extractDeclarations(sf, sf.text);
		expect(first(decls).kind).toBe("interface");
		expect(first(decls).name).toBe("User");
	});

	it("extracts type aliases", () => {
		const sf = parse(`type UserId = string;\n`);
		const decls = extractDeclarations(sf, sf.text);
		expect(first(decls).kind).toBe("type");
		expect(first(decls).name).toBe("UserId");
	});

	it("extracts enum declarations", () => {
		const sf = parse(`enum Direction { Up, Down }\n`);
		const decls = extractDeclarations(sf, sf.text);
		expect(first(decls).kind).toBe("enum");
		expect(first(decls).name).toBe("Direction");
	});

	it("extracts const variable declarations", () => {
		const sf = parse(`export const authMiddleware = () => {};\n`);
		const decls = extractDeclarations(sf, sf.text);
		expect(first(decls).kind).toBe("variable");
		expect(first(decls).name).toBe("authMiddleware");
	});

	it("extracts import declarations with specifiers", () => {
		const sf = parse(`import { useState, useEffect } from "react";\n`);
		const decls = extractDeclarations(sf, sf.text);
		const d = first(decls);
		expect(d.kind).toBe("import");
		expect(d.source).toBe("react");
		expect(d.specifiers).toContain("useState");
		expect(d.specifiers).toContain("useEffect");
	});

	it("extracts import with default import", () => {
		const sf = parse(`import React from "react";\n`);
		const decls = extractDeclarations(sf, sf.text);
		const d = first(decls);
		expect(d.kind).toBe("import");
		expect(d.name).toBe("React");
		expect(d.source).toBe("react");
	});

	it("extracts import with namespace import", () => {
		const sf = parse(`import * as ts from "typescript";\n`);
		const decls = extractDeclarations(sf, sf.text);
		expect(first(decls).kind).toBe("import");
		expect(first(decls).specifiers).toContain("* as ts");
	});

	it("extracts leading JSDoc comment", () => {
		const src = `/** @param x the value */\nexport function foo(x: string) {}\n`;
		const sf = parse(src);
		const decls = extractDeclarations(sf, sf.text);
		expect(first(decls).leadingComment).toContain("@param");
	});

	it("provides correct line numbers", () => {
		const sf = parse(`const a = 1;\nconst b = 2;\nconst c = 3;\n`);
		const decls = extractDeclarations(sf, sf.text);
		expect(decls[0]?.line).toBe(1);
		expect(decls[1]?.line).toBe(2);
		expect(decls[2]?.line).toBe(3);
	});
});

describe("semanticDiff with TS adapter extractDeclarations", () => {
	function makeAst(source: string) {
		return ts.createSourceFile("test.ts", source, ts.ScriptTarget.Latest, true);
	}

	it("uses adapter extractor for precise import diffs", () => {
		const before = `import { foo } from "lib";\n`;
		const after = `import { foo, bar } from "lib";\n`;
		const changes = semanticDiff(before, after, {
			extractDeclarations,
			beforeAst: makeAst(before),
			afterAst: makeAst(after),
		});
		expect(changes.some((c) => c.kind === "import:specifiers-changed")).toBe(
			true,
		);
	});

	it("detects function rename with TS extractor", () => {
		const before = `export function validateUser(u: User): boolean { return true; }\n`;
		const after = `export function assertUserValid(u: User): boolean { return true; }\n`;
		const changes = semanticDiff(before, after, {
			extractDeclarations,
			beforeAst: makeAst(before),
			afterAst: makeAst(after),
		});
		expect(
			changes.some(
				(c) =>
					c.kind === "declaration:renamed" &&
					c.before === "validateUser" &&
					c.after === "assertUserValid",
			),
		).toBe(true);
	});

	it("detects interface added", () => {
		const before = `export function foo() {}\n`;
		const after = `export function foo() {}\nexport interface FooOptions { timeout: number; }\n`;
		const changes = semanticDiff(before, after, {
			extractDeclarations,
			beforeAst: makeAst(before),
			afterAst: makeAst(after),
		});
		expect(
			changes.some(
				(c) =>
					c.kind === "declaration:added" && c.summary.includes("FooOptions"),
			),
		).toBe(true);
	});

	it("detects JSDoc added with TS extractor", () => {
		const before = `export function processPayment(amount: number) {}\n`;
		const after = `/** @deprecated use processPaymentV2 */\nexport function processPayment(amount: number) {}\n`;
		const changes = semanticDiff(before, after, {
			extractDeclarations,
			beforeAst: makeAst(before),
			afterAst: makeAst(after),
		});
		expect(
			changes.some(
				(c) =>
					c.kind === "comment:added" && c.summary.includes("processPayment"),
			),
		).toBe(true);
	});

	it("real-world: lodash → lodash-es migration", () => {
		const before = `
import _ from "lodash";
import { debounce } from "lodash";
export function processItems(items: string[]) { return _.map(items, x => x); }
`.trim();
		const after = `
import _ from "lodash-es";
import { debounce } from "lodash-es";
export function processItems(items: string[]) { return _.map(items, x => x); }
`.trim();
		const changes = semanticDiff(before, after, {
			extractDeclarations,
			beforeAst: makeAst(before),
			afterAst: makeAst(after),
		});
		const sourceChanges = changes.filter(
			(c) => c.kind === "import:source-changed",
		);
		expect(sourceChanges.length).toBeGreaterThanOrEqual(1);
		expect(
			sourceChanges.some(
				(c) => c.before === "lodash" && c.after === "lodash-es",
			),
		).toBe(true);
	});
});
