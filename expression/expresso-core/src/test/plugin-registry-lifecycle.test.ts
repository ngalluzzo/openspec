import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";
import numericPlugin from "../../../expresso-std/src/numeric/plugin";
import { clearRegistry } from "../operators/registry";
import { getPluginRuntimeOperatorIds } from "../plugin/operator-ids";
import { pluginRegistry } from "../plugin/registry";
import type { Plugin } from "../plugin/types";

describe("plugin registry lifecycle", () => {
	beforeEach(() => {
		clearRegistry();
		pluginRegistry.clear();
	});

	test("tracks logical operator ids in namespace state and removes them on unload", async () => {
		const loadResult = pluginRegistry.loadSynchronously(numericPlugin, {
			autoRegister: false,
		});

		expect(loadResult.success).toBe(true);
		expect(pluginRegistry.getOperatorsInNamespace("@std")).toEqual([
			"gt",
			"gte",
			"lt",
			"lte",
			"between",
			"min",
			"max",
			"plus",
			"minus",
			"multiply",
			"divide",
			"modulo",
			"abs",
			"to_number",
			"to_integer",
		]);

		expect(await pluginRegistry.unload(numericPlugin.name)).toBe(true);
		expect(pluginRegistry.getOperatorsInNamespace("@std")).toEqual([]);
	});

	test("includes both bound runtime ids and unbound operators for mixed plugins", () => {
		expect(getPluginRuntimeOperatorIds(numericPlugin)).toEqual([
			"between",
			"min",
			"max",
			"plus",
			"minus",
			"multiply",
			"divide",
			"modulo",
			"abs",
			"to_number",
			"to_integer",
			">",
			">=",
			"<",
			"<=",
		]);
	});

	test("distinguishes declared operators from live registered operators", () => {
		const loadResult = pluginRegistry.loadSynchronously(numericPlugin, {
			autoRegister: false,
		});

		expect(loadResult.success).toBe(true);
		expect(pluginRegistry.declaresOperator("between")).toBe(true);
		expect(pluginRegistry.getByDeclaredOperator("between")?.name).toBe(
			numericPlugin.name,
		);
		expect(pluginRegistry.hasRegisteredOperator("between")).toBe(false);
		expect(pluginRegistry.getByRegisteredOperator("between")).toBeUndefined();
	});

	test("rolls back namespace state when async registration fails", async () => {
		const failingPlugin: Plugin = {
			name: "@test/failing-async",
			version: "1.0.0",
			category: "misc",
			operators: ["test.logical"],
			operatorBindings: [
				{
					logicalId: "test.logical",
					runtimeId: "test_runtime",
				},
			],
			register: async () => {
				throw new Error("boom");
			},
		};

		const loadResult = await pluginRegistry.load(failingPlugin, {
			autoRegister: true,
		});

		expect(loadResult.success).toBe(false);
		expect(pluginRegistry.getOperatorsInNamespace("@test")).toEqual([]);
		expect(pluginRegistry.has(failingPlugin.name)).toBe(false);
	});

	test("requires dependencies to already be loaded", async () => {
		const dependentPlugin: Plugin = {
			name: "@test/dependent",
			version: "1.0.0",
			category: "misc",
			operators: ["test.dependent"],
			dependencies: ["@test/base"],
			register: () => {},
		};

		const loadResult = await pluginRegistry.load(dependentPlugin, {
			autoRegister: false,
		});

		expect(loadResult.success).toBe(false);
		expect(loadResult.errors).toContain(
			"Missing loaded dependency plugin: @test/base",
		);
	});
});
