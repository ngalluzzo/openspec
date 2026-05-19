import { describe, expect, it } from "bun:test";
import { defineRecipe } from "../src/define.js";
import { defineTemplate, isTemplate } from "../src/template.js";

const minimalTemplate = {
	name: "test/minimal-template",
	displayName: "Minimal template",
	description: "A minimal template for testing",
	generate: () => [],
	run: () => {},
};

describe("defineTemplate", () => {
	it("creates a template with required fields", () => {
		const t = defineTemplate(minimalTemplate);
		expect(t.name).toBe("test/minimal-template");
		expect(typeof t.generate).toBe("function");
		expect(typeof t.run).toBe("function");
	});

	it("template satisfies the Recipe interface", () => {
		const t = defineTemplate(minimalTemplate);
		// Should have all Recipe fields
		expect(t.displayName).toBe("Minimal template");
		expect(t.description).toBe("A minimal template for testing");
	});

	it("attaches .with() for composition", () => {
		const t = defineTemplate<{ path: string }>({
			...minimalTemplate,
			options: {
				path: { type: "string", description: "path", required: true },
			},
		});
		const bound = t.with({ path: "src/auth" });
		expect(bound.recipe).toBe(t);
		expect(bound.options).toEqual({ path: "src/auth" });
	});

	it("generate() can return GeneratedFile array", async () => {
		const t = defineTemplate<{ authPath: string }>({
			...minimalTemplate,
			options: {
				authPath: { type: "string", description: "path", default: "src/auth" },
			},
			generate(vars) {
				return [
					{ path: `${vars.authPath}/index.ts`, content: `// auth\n` },
					{ path: `${vars.authPath}/types.ts`, content: `// types\n` },
				];
			},
		});
		const files = await t.generate({ authPath: "src/auth" });
		expect(files).toHaveLength(2);
		expect(files[0]?.path).toBe("src/auth/index.ts");
		expect(files[0]?.content).toContain("// auth");
	});

	it("generate() can be async", async () => {
		const t = defineTemplate({
			...minimalTemplate,
			generate: async () => [{ path: "a.ts", content: "async content" }],
		});
		const files = await t.generate({});
		expect(files[0]?.content).toBe("async content");
	});

	it("throws when generate is missing", () => {
		expect(() =>
			defineTemplate({ ...minimalTemplate, generate: undefined as any }),
		).toThrow(/generate/);
	});

	it("throws when name is missing", () => {
		expect(() => defineTemplate({ ...minimalTemplate, name: "" })).toThrow(
			/name/,
		);
	});
});

describe("isTemplate", () => {
	it("returns true for templates", () => {
		expect(isTemplate(defineTemplate(minimalTemplate))).toBe(true);
	});

	it("returns false for plain recipes", () => {
		const r = defineRecipe({
			name: "r",
			displayName: "r",
			description: "r",
			run: () => {},
		});
		expect(isTemplate(r)).toBe(false);
	});
});
