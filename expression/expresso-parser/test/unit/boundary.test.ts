import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_GOOI_PACKAGES = new Set(["@gooi/expresso"]);
const IMPORT_SPECIFIER_RE =
	/from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

const walkFiles = (dir: string, files: string[] = []): string[] => {
	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			walkFiles(fullPath, files);
			continue;
		}

		if (fullPath.endsWith(".ts")) {
			files.push(fullPath);
		}
	}

	return files;
};

const readPackageJson = (): Readonly<Record<string, unknown>> => {
	const packagePath = fileURLToPath(
		new URL("../../package.json", import.meta.url),
	);
	const raw = readFileSync(packagePath, "utf8");
	return JSON.parse(raw) as Readonly<Record<string, unknown>>;
};

const extractGooiImports = (source: string): readonly string[] => {
	const matches: string[] = [];
	IMPORT_SPECIFIER_RE.lastIndex = 0;

	for (let match = IMPORT_SPECIFIER_RE.exec(source); match; ) {
		const specifier = match[1] ?? match[2];
		if (specifier?.startsWith("@gooi/")) {
			matches.push(specifier);
		}
		match = IMPORT_SPECIFIER_RE.exec(source);
	}

	return matches;
};

describe("dependency boundary", () => {
	it("package dependencies only include expresso from @gooi/*", () => {
		const pkg = readPackageJson();
		const dependencySections = [
			pkg.dependencies,
			pkg.devDependencies,
			pkg.peerDependencies,
			pkg.optionalDependencies,
		];
		const gooiPackages = dependencySections
			.flatMap((section) =>
				section && typeof section === "object"
					? Object.keys(section).filter((name) => name.startsWith("@gooi/"))
					: [],
			)
			.filter((name, index, arr) => arr.indexOf(name) === index);
		const disallowed = gooiPackages.filter(
			(name) => !ALLOWED_GOOI_PACKAGES.has(name),
		);

		expect(disallowed).toEqual([]);
	});

	it("source imports only use expresso from @gooi/*", () => {
		const srcDir = fileURLToPath(new URL("../../src", import.meta.url));
		const tsFiles = walkFiles(srcDir);
		const violations: { readonly file: string; readonly specifier: string }[] =
			[];

		for (const file of tsFiles) {
			const source = readFileSync(file, "utf8");
			const imports = extractGooiImports(source);
			for (const specifier of imports) {
				if (!ALLOWED_GOOI_PACKAGES.has(specifier)) {
					violations.push({ file, specifier });
				}
			}
		}

		expect(violations).toEqual([]);
	});
});
