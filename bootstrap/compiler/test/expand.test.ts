import { describe, expect, test } from "bun:test";
import { expandPatterns } from "../src/pattern/expand.ts";

const PATTERN = "openspec.pattern.v1";

describe("expandPatterns", () => {
	test("returns empty result when no pattern documents", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			{ id: "other", protocol: "openspec.model.v1", document: {} },
		]);
		expect(expanded).toEqual([]);
		expect(diagnostics).toEqual([]);
	});

	test("expands a simple pattern application", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			{
				id: "my.patterns",
				protocol: PATTERN,
				document: {
					patterns: [
						{
							id: "my.thing",
							owner: "owner",
							expands: {
								documents: [
									{
										id: { expr: { kind: "path", path: "input.id" } },
										protocol: "openspec.model.v1",
										document: { name: { expr: { kind: "path", path: "input.name" } } },
									},
								],
							},
						},
					],
					applications: [
						{
							id: "my.thing.app",
							pattern: "pattern.declaration:my.thing",
							inputs: { id: "widget", name: "Widget" },
						},
					],
				},
			},
		]);

		expect(diagnostics).toEqual([]);
		expect(expanded).toHaveLength(1);
		expect(expanded[0]?.protocol).toBe("openspec.model.v1");
		expect(expanded[0]?.id).toBe("widget");
		expect((expanded[0]?.document as Record<string, unknown>)?.name).toBe("Widget");
	});

	test("emits diagnostic for unresolved pattern reference", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			{
				id: "my.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "broken.app",
							pattern: "pattern.declaration:does.not.exist",
							inputs: {},
						},
					],
				},
			},
		]);

		expect(expanded).toEqual([]);
		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]?.code).toBe("pattern.application.unresolved");
		expect(diagnostics[0]?.message).toContain("pattern.declaration:does.not.exist");
		expect(diagnostics[0]?.message).toContain("broken.app");
		expect(diagnostics[0]?.details?.sourceDocumentId).toBe("my.app");
	});

	test("includes application id and source document id in unresolved diagnostic details", async () => {
		const { diagnostics } = await expandPatterns([
			{
				id: "source.doc",
				protocol: PATTERN,
				document: {
					applications: [
						{ id: "my.application", pattern: "pattern.declaration:missing", inputs: {} },
					],
				},
			},
		]);

		const diag = diagnostics[0];
		expect(diag?.details?.applicationId).toBe("my.application");
		expect(diag?.details?.pattern).toBe("pattern.declaration:missing");
		expect(diag?.details?.sourceDocumentId).toBe("source.doc");
	});

	test("emits diagnostic when mini-lang throws during expansion", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			{
				id: "bad.patterns",
				protocol: PATTERN,
				document: {
					patterns: [
						{
							id: "bad.thing",
							owner: "owner",
							expands: {
								documents: [
									{
										id: "fixed-id",
										protocol: "openspec.model.v1",
										// unknown kind will throw from evalMini
										document: { expr: { kind: "not-a-real-kind" } },
									},
								],
							},
						},
					],
					applications: [
						{
							id: "bad.thing.app",
							pattern: "pattern.declaration:bad.thing",
							inputs: {},
						},
					],
				},
			},
		]);

		expect(expanded).toEqual([]);
		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]?.code).toBe("pattern.expansion.error");
		expect(diagnostics[0]?.message).toContain("bad.thing.app");
		expect(diagnostics[0]?.message).toContain("not-a-real-kind");
	});

	test("continues expanding other applications after one fails", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			{
				id: "mixed.doc",
				protocol: PATTERN,
				document: {
					patterns: [
						{
							id: "good.thing",
							owner: "owner",
							expands: {
								documents: [
									{ id: "ok", protocol: "openspec.model.v1", document: {} },
								],
							},
						},
					],
					applications: [
						{ id: "missing.app", pattern: "pattern.declaration:does.not.exist", inputs: {} },
						{ id: "good.app", pattern: "pattern.declaration:good.thing", inputs: {} },
					],
				},
			},
		]);

		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]?.code).toBe("pattern.application.unresolved");
		expect(expanded).toHaveLength(1);
		expect(expanded[0]?.id).toBe("ok");
	});
});
