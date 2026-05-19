import { beforeEach, describe, expect, test } from "bun:test";
import { clearRegistry, createOperatorRegistry } from "../operators/registry";
import { getPluginRuntimeOperatorIds } from "../plugin/operator-ids";
import { createPluginRegistry } from "../plugin/registry";
import type { Plugin } from "../plugin/types";
import { apply, applyAsync } from "../runtime/compile/apply";
import type { Rule } from "../runtime/contracts/types";
import type { OperatorMetadata } from "../types/metadata";

export type VerifyPluginDependencyResolver = (
	dependencyName: string,
) => Promise<Plugin | undefined> | Plugin | undefined;

export type VerifyPluginOptions = {
	resolveDependency?: VerifyPluginDependencyResolver;
};

/**
 * Executes `verifyPlugin` with the provided inputs.
 *
 * @param plugin - The `plugin` argument value.
 *
 * @returns The result produced by `verifyPlugin`.
 *
 * @example
 * verifyPlugin(plugin);
 */

async function ensurePluginRegistration(
	plugin: Plugin,
	pluginRegistry: ReturnType<typeof createPluginRegistry>,
	resolveDependency: VerifyPluginDependencyResolver | undefined,
): Promise<void> {
	const visited = new Set<string>();

	const loadPlugin = async (target: Plugin): Promise<void> => {
		if (visited.has(target.name)) {
			return;
		}
		visited.add(target.name);

		for (const depName of target.dependencies ?? []) {
			if (pluginRegistry.has(depName)) {
				continue;
			}

			if (!resolveDependency) {
				throw new Error(
					`Plugin dependency "${depName}" is not loaded and no resolver was provided for "${target.name}".`,
				);
			}

			const dep = await resolveDependency(depName);
			if (!dep) {
				throw new Error(
					`Unable to resolve plugin dependency "${depName}" for "${target.name}".`,
				);
			}

			await loadPlugin(dep);
		}

		if (!pluginRegistry.has(target.name)) {
			const result = pluginRegistry.loadSynchronously(target);
			if (!result.success) {
				throw new Error(
					`Failed to load plugin "${target.name}": ${result.errors?.join(", ")}`,
				);
			}
		}
	};

	await loadPlugin(plugin);
}

export async function verifyPlugin(
	plugin: Plugin,
	options: VerifyPluginOptions = {},
) {
	const operatorRegistry = createOperatorRegistry();
	const pluginRegistry = createPluginRegistry({ operatorRegistry });

	// Clear both registries immediately to ensure clean state
	// This must happen before registering operators
	clearRegistry(operatorRegistry);
	pluginRegistry.clear();

	// Ensure plugin graph is available before test definitions are built.
	// Without a resolver this keeps the old behavior for legacy callers.
	if (plugin.dependencies?.length || plugin.operators.length > 0) {
		await ensurePluginRegistration(
			plugin,
			pluginRegistry,
			options.resolveDependency,
		);
	}

	describe(`Plugin: ${plugin.name}`, async () => {
		// Clear both registries before each test
		beforeEach(async () => {
			clearRegistry(operatorRegistry);
			pluginRegistry.clear();
			await ensurePluginRegistration(
				plugin,
				pluginRegistry,
				options.resolveDependency,
			);
		});

		// Collect all operators registered by this plugin
		// We filter registry by the operators listed in the plugin definition
		const pluginOps = getPluginRuntimeOperatorIds(plugin);

		if (pluginOps.length === 0) {
			test("Plugin should have operators", () => {
				expect(pluginOps.length).toBeGreaterThan(0);
			});
			return;
		}

		pluginOps.forEach((opName: string) => {
			const op = operatorRegistry.get(opName);
			if (!op) {
				test(`Operator ${opName} should be registered`, () => {
					expect(op).toBeDefined();
				});
				return;
			}

			if (!op.metadata) {
				test(`Operator ${opName} should have metadata`, () => {
					expect(op.metadata).toBeDefined();
				});
				return;
			}

			const metadata: OperatorMetadata = op.metadata;

			describe(`${metadata.title} (${opName})`, () => {
				const isAsync = op.async;

				if (metadata.examples && metadata.examples.length > 0) {
					describe("Examples", () => {
						metadata.examples.forEach((example, i) => {
							test(`${i + 1}. ${example.description}`, async () => {
								const rule = example.rule as Rule;
								const input = example.input;
								const expected = example.output;

								let result: unknown;
								if (isAsync) {
									result = await applyAsync(rule, input, {
										operatorRegistry,
									});
								} else {
									try {
										result = apply(rule, input, {
											operatorRegistry,
										});
										if (result instanceof Promise) {
											result = await result;
										}
									} catch (e) {
										if (e instanceof Promise) {
											result = await e;
										} else {
											throw e;
										}
									}
								}

								if (expected === undefined) {
									expect(result).toBeUndefined();
								} else if (expected instanceof RegExp) {
									expect(result).toMatch(expected);
								} else {
									expect(result).toEqual(expected);
								}
							});
						});
					});
				}

				if (metadata.tests && metadata.tests.length > 0) {
					describe("Explicit Tests", () => {
						metadata.tests?.forEach((testDef, i) => {
							test(`${i + 1}. ${testDef.description}`, async () => {
								// If test defines arguments directly, construct rule
								const rule = { [opName]: testDef.args } as Rule;
								const input = testDef.input;

								if (testDef.throws) {
									const run = () =>
										isAsync
											? applyAsync(rule, input, { operatorRegistry })
											: apply(rule, input, { operatorRegistry });
									try {
										await run();
										expect().fail(
											`Should have thrown error containing "${testDef.throws}"`,
										);
									} catch (e) {
										expect((e as Error).message).toContain(testDef.throws);
									}
								} else {
									const expected = testDef.expected;
									let result: unknown;
									if (isAsync) {
										result = await applyAsync(rule, input, {
											operatorRegistry,
										});
									} else {
										result = apply(rule, input, {
											operatorRegistry,
										});
										if (result instanceof Promise) {
											result = await result;
										}
									}

									if (expected instanceof RegExp) {
										expect(result).toMatch(expected);
									} else {
										expect(result).toEqual(expected);
									}
								}
							});
						});
					});
				}
			});
		});
	});
}
