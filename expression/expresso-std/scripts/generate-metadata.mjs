import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const stdRoot = path.resolve(__dirname, "..");

async function collectCategoryMetadata() {
	const srcRoot = path.join(stdRoot, "src");
	const entries = await readdir(srcRoot, { withFileTypes: true });
	const categories = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const metadataPath = path.join(srcRoot, entry.name, "metadata.json");
		try {
			const raw = await readFile(metadataPath, "utf8");
			const parsed = JSON.parse(raw);
			categories.push({ name: entry.name, metadata: parsed });
		} catch (error) {
			if (error && typeof error === "object" && error.code === "ENOENT") {
				// Category does not provide dedicated metadata yet.
				continue;
			}
			throw error;
		}
	}

	categories.sort((a, b) => a.name.localeCompare(b.name));
	return categories;
}

async function build() {
	const categories = await collectCategoryMetadata();

	const aggregated = {
		plugin: "@gooi/expresso-std",
		version: "1.0.0",
		namespace: "@std",
		categories: {},
		operators: {},
		generatedAt: new Date().toISOString(),
	};

	for (const category of categories) {
		const categoryKey = category.metadata.category || category.name;
		aggregated.categories[categoryKey] = {
			plugin: category.metadata.plugin || `@std/${category.name}`,
			version: category.metadata.version || "1.0.0",
			category: categoryKey,
			operators: category.metadata.operators || {},
		};

		for (const [operatorId, operatorMeta] of Object.entries(
			category.metadata.operators || {},
		)) {
			aggregated.operators[operatorId] = operatorMeta;
		}
	}

	const outputPath = path.join(stdRoot, "metadata.json");
	await writeFile(
		outputPath,
		`${JSON.stringify(aggregated, null, 2)}\n`,
		"utf8",
	);
	console.log(`Wrote ${outputPath}`);
}

await build();
