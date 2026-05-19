/**
 * Applies lightweight prettier formatting to generated scaffold files.
 */
/**
 * Executes `formatScaffoldFile` with the provided inputs.
 *
 * @param code - The `code` argument value.
 * @param filePath - The `filePath` argument value.
 *
 * @returns The result produced by `formatScaffoldFile`.
 *
 * @example
 * formatScaffoldFile(code, filePath);
 */

export async function formatScaffoldFile(
	code: string,
	filePath: string,
): Promise<string> {
	try {
		const { format } = await import("prettier");
		const extension = filePath.split(".").pop();
		const parser: "json" | "typescript" | "markdown" | "babel" =
			extension === "json"
				? "json"
				: extension === "md"
					? "markdown"
					: "typescript";

		const formatted = await format(code, {
			parser,
			semi: extension === "ts",
			singleQuote: extension === "ts",
			tabWidth: 2,
			trailingComma: extension === "ts" ? "es5" : "none",
		});
		return formatted;
	} catch (error) {
		console.warn("Prettier formatting failed for file", filePath, error);
		return code;
	}
}
