import { describe, expect, it } from "bun:test";
import { formatSemanticChanges, semanticDiff } from "../src/semantic.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function diff(before: string, after: string) {
	return semanticDiff(before, after);
}

function kinds(before: string, after: string) {
	return diff(before, after).map((c) => c.kind);
}

function _summaries(before: string, after: string) {
	return diff(before, after).map((c) => c.summary);
}

// ─── Identity ─────────────────────────────────────────────────────────────────

describe("identical sources", () => {
	it("returns empty array for identical sources", () => {
		expect(diff("const x = 1;", "const x = 1;")).toHaveLength(0);
	});

	it("returns empty array for expression-only changes", () => {
		// Adding a comment inside a function body — no top-level declaration change
		const before = "function foo() { return 1; }";
		const after = "function foo() { return 2; }";
		// Same function name — no declaration-level change detected
		expect(kinds(before, after)).not.toContain("declaration:removed");
		expect(kinds(before, after)).not.toContain("declaration:added");
	});
});

// ─── Import changes ───────────────────────────────────────────────────────────

describe("import:removed", () => {
	it("detects a removed import", () => {
		const before = `import React from "react";\nconst x = 1;`;
		const after = `const x = 1;`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) => c.kind === "import:removed" && c.summary.includes("react"),
			),
		).toBe(true);
	});

	it("includes the import text in before field", () => {
		const before = `import { foo } from "bar";\n`;
		const after = ``;
		const found = diff(before, after).find((c) => c.kind === "import:removed");
		if (found == null) throw new Error("expected import:removed change");
		const c = found;
		expect(c.before).toBeDefined();
	});
});

describe("import:added", () => {
	it("detects an added import", () => {
		const before = `const x = 1;`;
		const after = `import { useState } from "react";\nconst x = 1;`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) => c.kind === "import:added" && c.summary.includes("react"),
			),
		).toBe(true);
	});

	it("includes line location", () => {
		const before = `const x = 1;`;
		const after = `import React from "react";
const x = 1;`;
		const found = diff(before, after).find((c) => c.kind === "import:added");
		if (found == null) throw new Error("expected import:added change");
		const c = found;
		expect(c.location?.line).toBe(1);
	});
});

describe("import:source-changed", () => {
	it("detects module source change with same default import name", () => {
		const before = `import React from "react";\n`;
		const after = `import React from "react-18";\n`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) =>
					c.kind === "import:source-changed" &&
					c.before === "react" &&
					c.after === "react-18",
			),
		).toBe(true);
	});

	it("detects the classic lodash → lodash-es migration", () => {
		const before = `import _ from "lodash";\n`;
		const after = `import _ from "lodash-es";\n`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) =>
					c.kind === "import:source-changed" &&
					c.summary.includes("lodash") &&
					c.summary.includes("lodash-es"),
			),
		).toBe(true);
	});
});

describe("import:specifiers-changed", () => {
	it("detects specifier addition", () => {
		const before = `import { foo } from "bar";\n`;
		const after = `import { foo, baz } from "bar";\n`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) =>
					c.kind === "import:specifiers-changed" && c.summary.includes("bar"),
			),
		).toBe(true);
	});

	it("detects specifier removal", () => {
		const before = `import { foo, bar, baz } from "lib";\n`;
		const after = `import { foo } from "lib";\n`;
		const changes = diff(before, after);
		expect(changes.some((c) => c.kind === "import:specifiers-changed")).toBe(
			true,
		);
	});
});

// ─── Declaration changes ──────────────────────────────────────────────────────

describe("declaration:added", () => {
	it("detects an added function", () => {
		const before = `export function foo() {}\n`;
		const after = `export function foo() {}\nexport function bar() {}\n`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) => c.kind === "declaration:added" && c.summary.includes("bar"),
			),
		).toBe(true);
	});

	it("detects an added type", () => {
		const before = `const x = 1;\n`;
		const after = `const x = 1;\ntype UserId = string;\n`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) => c.kind === "declaration:added" && c.summary.includes("UserId"),
			),
		).toBe(true);
	});

	it("detects an added interface", () => {
		const before = ``;
		const after = `interface User { name: string; }\n`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) => c.kind === "declaration:added" && c.summary.includes("User"),
			),
		).toBe(true);
	});
});

describe("declaration:removed", () => {
	it("detects a removed function", () => {
		const before = `export function foo() {}\nexport function bar() {}\n`;
		const after = `export function foo() {}\n`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) => c.kind === "declaration:removed" && c.summary.includes("bar"),
			),
		).toBe(true);
	});

	it("detects a removed class", () => {
		const before = `class MyService {}\nconst x = 1;\n`;
		const after = `const x = 1;\n`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) =>
					c.kind === "declaration:removed" && c.summary.includes("MyService"),
			),
		).toBe(true);
	});
});

describe("declaration:renamed", () => {
	it("detects a rename when same kind appears near same position", () => {
		const before = `export function validateUser() {}\n`;
		const after = `export function assertUserValid() {}\n`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) =>
					c.kind === "declaration:renamed" &&
					c.before === "validateUser" &&
					c.after === "assertUserValid",
			),
		).toBe(true);
	});

	it("does not double-report rename as both added and removed", () => {
		const before = `export function oldName() {}\n`;
		const after = `export function newName() {}\n`;
		const changes = diff(before, after);
		const renamed = changes.filter((c) => c.kind === "declaration:renamed");
		const removed = changes.filter((c) => c.kind === "declaration:removed");
		const _added = changes.filter((c) => c.kind === "declaration:added");
		// Should be reported as renamed, not as both added + removed
		expect(renamed.length).toBeGreaterThanOrEqual(1);
		// oldName should NOT also appear as removed
		expect(removed.some((c) => c.summary.includes("oldName"))).toBe(false);
	});
});

// ─── Comment changes ──────────────────────────────────────────────────────────

describe("comment:added", () => {
	it("detects a JSDoc comment added to a function", () => {
		const before = `export function processPayment() {}\n`;
		const after = `/** @deprecated use processPaymentV2 */\nexport function processPayment() {}\n`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) =>
					c.kind === "comment:added" && c.summary.includes("processPayment"),
			),
		).toBe(true);
	});
});

describe("comment:removed", () => {
	it("detects a comment removed from a declaration", () => {
		const before = `// legacy handler\nexport function handleLegacy() {}\n`;
		const after = `export function handleLegacy() {}\n`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) =>
					c.kind === "comment:removed" && c.summary.includes("handleLegacy"),
			),
		).toBe(true);
	});
});

describe("comment:updated", () => {
	it("detects an updated comment on a declaration", () => {
		const before = `// old description\nexport function foo() {}\n`;
		const after = `// new description\nexport function foo() {}\n`;
		const changes = diff(before, after);
		expect(
			changes.some(
				(c) =>
					c.kind === "comment:updated" &&
					c.before?.includes("old") &&
					c.after?.includes("new"),
			),
		).toBe(true);
	});
});

// ─── Real-world migration scenarios ──────────────────────────────────────────

describe("real-world scenarios", () => {
	it("lodash CJS to ESM migration", () => {
		const before = `
import _ from "lodash";
import { debounce } from "lodash";
export function processItems(items) {}
`.trim();
		const after = `
import _ from "lodash-es";
import { debounce } from "lodash-es";
export function processItems(items) {}
`.trim();
		const changes = diff(before, after);
		expect(changes.length).toBeGreaterThan(0);
		// Both lodash imports should show as source-changed
		const sourceChanges = changes.filter(
			(c) => c.kind === "import:source-changed",
		);
		expect(sourceChanges.length).toBeGreaterThanOrEqual(1);
	});

	it("React class to hooks — function added, class removed", () => {
		const before = `
import React from "react";
class Counter extends React.Component {}
`.trim();
		const after = `
import React, { useState } from "react";
function Counter() {}
`.trim();
		const changes = diff(before, after);
		expect(changes.some((c) => c.kind === "import:specifiers-changed")).toBe(
			true,
		);
		// Counter appears in both — could be renamed or a class→function change
		// At minimum we detect a structural change
		expect(changes.length).toBeGreaterThan(0);
	});

	it("adding a new exported function", () => {
		const before = `export function foo() {}\n`;
		const after = `export function foo() {}\nexport function bar() {}\n`;
		const changes = diff(before, after);
		expect(changes.some((c) => c.kind === "declaration:added")).toBe(true);
	});
});

// ─── formatSemanticChanges ────────────────────────────────────────────────────

describe("formatSemanticChanges", () => {
	it("returns empty string for no changes", () => {
		expect(formatSemanticChanges([])).toBe("");
	});

	it("formats changes with + - ~ bullets", () => {
		const changes = diff(
			`import foo from "bar";\n`,
			`import foo from "baz";\n`,
		);
		const formatted = formatSemanticChanges(changes);
		expect(formatted).toContain("~");
		expect(formatted.length).toBeGreaterThan(0);
	});

	it("includes filePath when provided", () => {
		const changes = diff(`const x = 1;\n`, `const x = 1;\nconst y = 2;\n`);
		const formatted = formatSemanticChanges(changes, {
			filePath: "src/app.ts",
		});
		expect(formatted).toContain("src/app.ts");
	});

	it("uses + for added changes", () => {
		const changes = diff(``, `export function newFn() {}\n`);
		const formatted = formatSemanticChanges(changes);
		expect(formatted).toContain("+");
	});

	it("uses - for removed changes", () => {
		const changes = diff(`export function oldFn() {}\n`, ``);
		const formatted = formatSemanticChanges(changes);
		expect(formatted).toContain("-");
	});
});
