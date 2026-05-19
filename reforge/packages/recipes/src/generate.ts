import { lstat, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { resolveOptions } from "./options.js";
import type { GeneratedFile, Template } from "./types.js";

// ─── Plan types ──────────────────────────────────────────────────────────────

export type ExistingFilePolicy = "fail" | "skip" | "replace";

export type GeneratePlanItemAction = "write" | "replace" | "skip";

export type PlannedFileState = "missing" | "file" | "directory" | "other";

export type GeneratePlanErrorCode =
	| "duplicate_path"
	| "existing_file"
	| "filesystem"
	| "generate"
	| "options"
	| "target_not_file"
	| "unsafe_path";

export interface GeneratePlanError {
	code: GeneratePlanErrorCode;
	template: string;
	path: string;
	message: string;
}

export interface GeneratePlanItem {
	template: string;
	path: string;
	absolutePath: string;
	content: string;
	action: GeneratePlanItemAction;
	reason?: "exists" | "missing";
	expectedFileState: PlannedFileState;
}

export interface GeneratePlan {
	valid: boolean;
	projectRoot: string;
	existingFilePolicy: ExistingFilePolicy;
	items: GeneratePlanItem[];
	errors: GeneratePlanError[];
	writeCount: number;
	replaceCount: number;
	skippedCount: number;
	errorCount: number;
}

export interface CreateGeneratePlanOptions {
	templates: Template<any>[];
	variables: Record<string, unknown>;
	projectRoot: string;
	existingFilePolicy: ExistingFilePolicy;
}

// ─── Apply types ─────────────────────────────────────────────────────────────

export type GenerateApplyOutcome =
	| {
			kind: "written";
			template: string;
			path: string;
			absolutePath: string;
			action: "write" | "replace";
			bytesWritten: number;
	  }
	| {
			kind: "skipped";
			template: string;
			path: string;
			absolutePath: string;
			reason: "exists";
	  }
	| {
			kind: "error";
			template: string;
			path: string;
			absolutePath?: string;
			error: string;
	  };

export interface GenerateApplyResult {
	outcomes: GenerateApplyOutcome[];
	writtenCount: number;
	skippedCount: number;
	errorCount: number;
}

// ─── Planning ────────────────────────────────────────────────────────────────

export async function createGeneratePlan(
	options: CreateGeneratePlanOptions,
): Promise<GeneratePlan> {
	const projectRoot = resolve(options.projectRoot);
	const errors: GeneratePlanError[] = [];
	const items: GeneratePlanItem[] = [];
	const seenPaths = new Map<string, string>();

	if (!isExistingFilePolicy(options.existingFilePolicy)) {
		return summarizePlan({
			projectRoot,
			existingFilePolicy: options.existingFilePolicy,
			items,
			errors: [
				{
					code: "options",
					template: "(generate)",
					path: "(existingFilePolicy)",
					message: "existingFilePolicy must be one of: fail, skip, replace.",
				},
			],
		});
	}

	for (const template of options.templates) {
		let vars: Record<string, unknown>;
		try {
			vars = resolveOptions(template.options, options.variables, template.name);
		} catch (error) {
			errors.push({
				code: "options",
				template: template.name,
				path: "(options)",
				message: errorMessage(error),
			});
			continue;
		}

		let files: GeneratedFile[];
		try {
			files = await template.generate(vars);
		} catch (error) {
			errors.push({
				code: "generate",
				template: template.name,
				path: "(generate)",
				message: errorMessage(error),
			});
			continue;
		}

		for (const file of files) {
			const pathResult = safeRelativePath(file.path, projectRoot);
			if (!pathResult.ok) {
				errors.push({
					code: "unsafe_path",
					template: template.name,
					path: file.path,
					message: pathResult.message,
				});
				continue;
			}

			const duplicateTemplate = seenPaths.get(pathResult.path);
			if (duplicateTemplate) {
				errors.push({
					code: "duplicate_path",
					template: template.name,
					path: pathResult.path,
					message: `Target path already planned by ${duplicateTemplate}.`,
				});
				continue;
			}
			seenPaths.set(pathResult.path, template.name);

			let expectedFileState: PlannedFileState;
			try {
				expectedFileState = await fileState(pathResult.absolutePath);
			} catch (error) {
				errors.push({
					code: "filesystem",
					template: template.name,
					path: pathResult.path,
					message: errorMessage(error),
				});
				continue;
			}

			if (expectedFileState === "directory" || expectedFileState === "other") {
				errors.push({
					code: "target_not_file",
					template: template.name,
					path: pathResult.path,
					message: "Target path exists but is not a regular file.",
				});
				continue;
			}

			if (
				expectedFileState === "file" &&
				options.existingFilePolicy === "fail"
			) {
				errors.push({
					code: "existing_file",
					template: template.name,
					path: pathResult.path,
					message: "Target file already exists.",
				});
				continue;
			}

			items.push({
				template: template.name,
				path: pathResult.path,
				absolutePath: pathResult.absolutePath,
				content: file.content,
				action: planAction(expectedFileState, options.existingFilePolicy),
				reason: expectedFileState === "file" ? "exists" : "missing",
				expectedFileState,
			});
		}
	}

	items.sort(
		(a, b) =>
			a.path.localeCompare(b.path) || a.template.localeCompare(b.template),
	);

	return summarizePlan({
		projectRoot,
		existingFilePolicy: options.existingFilePolicy,
		items,
		errors,
	});
}

function summarizePlan(input: {
	projectRoot: string;
	existingFilePolicy: ExistingFilePolicy;
	items: GeneratePlanItem[];
	errors: GeneratePlanError[];
}): GeneratePlan {
	return {
		valid: input.errors.length === 0,
		projectRoot: input.projectRoot,
		existingFilePolicy: input.existingFilePolicy,
		items: input.items,
		errors: input.errors,
		writeCount: input.items.filter((item) => item.action === "write").length,
		replaceCount: input.items.filter((item) => item.action === "replace")
			.length,
		skippedCount: input.items.filter((item) => item.action === "skip").length,
		errorCount: input.errors.length,
	};
}

function planAction(
	state: PlannedFileState,
	policy: ExistingFilePolicy,
): GeneratePlanItemAction {
	if (state === "file" && policy === "skip") return "skip";
	if (state === "file" && policy === "replace") return "replace";
	return "write";
}

function isExistingFilePolicy(value: unknown): value is ExistingFilePolicy {
	return value === "fail" || value === "skip" || value === "replace";
}

type SafePathResult =
	| { ok: true; path: string; absolutePath: string }
	| { ok: false; message: string };

function safeRelativePath(path: string, projectRoot: string): SafePathResult {
	if (typeof path !== "string" || path.length === 0) {
		return { ok: false, message: "Generated path must be a non-empty string." };
	}
	if (path.includes("\0")) {
		return {
			ok: false,
			message: "Generated path must not contain null chars.",
		};
	}
	if (path.includes("\\")) {
		return {
			ok: false,
			message: "Generated path must use slash separators, not backslashes.",
		};
	}
	if (isAbsolute(path) || /^[A-Za-z]:\//.test(path)) {
		return { ok: false, message: "Generated path must be relative." };
	}

	const segments = path.split("/");
	if (
		segments.length === 0 ||
		segments.some(
			(segment) => segment === "" || segment === "." || segment === "..",
		)
	) {
		return {
			ok: false,
			message:
				"Generated path segments must be non-empty and may not be . or ...",
		};
	}

	const normalizedPath = segments.join("/");
	const absolutePath = resolve(projectRoot, ...segments);
	const relativePath = relative(projectRoot, absolutePath);
	if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
		return {
			ok: false,
			message: "Generated path must stay within the project root.",
		};
	}

	return { ok: true, path: normalizedPath, absolutePath };
}

async function fileState(path: string): Promise<PlannedFileState> {
	try {
		const stat = await lstat(path);
		if (stat.isFile()) return "file";
		if (stat.isDirectory()) return "directory";
		return "other";
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			(error as { code?: unknown }).code === "ENOENT"
		) {
			return "missing";
		}
		throw error;
	}
}

// ─── Apply ──────────────────────────────────────────────────────────────────

export async function applyGeneratePlan(
	plan: GeneratePlan,
): Promise<GenerateApplyResult> {
	if (!plan.valid) {
		throw new Error("Cannot apply invalid generate plan.");
	}

	const driftErrors = await preflightPlan(plan);
	if (driftErrors.length > 0) {
		return summarizeApply(driftErrors);
	}

	const outcomes: GenerateApplyOutcome[] = [];

	for (const item of plan.items) {
		if (item.action === "skip") {
			outcomes.push({
				kind: "skipped",
				template: item.template,
				path: item.path,
				absolutePath: item.absolutePath,
				reason: "exists",
			});
			continue;
		}

		try {
			await mkdir(dirname(item.absolutePath), { recursive: true });
			await writeFile(item.absolutePath, item.content, "utf8");
			outcomes.push({
				kind: "written",
				template: item.template,
				path: item.path,
				absolutePath: item.absolutePath,
				action: item.action,
				bytesWritten: Buffer.byteLength(item.content, "utf8"),
			});
		} catch (error) {
			outcomes.push({
				kind: "error",
				template: item.template,
				path: item.path,
				absolutePath: item.absolutePath,
				error: errorMessage(error),
			});
		}
	}

	return summarizeApply(outcomes);
}

async function preflightPlan(
	plan: GeneratePlan,
): Promise<GenerateApplyOutcome[]> {
	const outcomes: GenerateApplyOutcome[] = [];
	for (const item of plan.items) {
		let currentState: PlannedFileState;
		try {
			currentState = await fileState(item.absolutePath);
		} catch (error) {
			outcomes.push({
				kind: "error",
				template: item.template,
				path: item.path,
				absolutePath: item.absolutePath,
				error: errorMessage(error),
			});
			continue;
		}

		if (currentState !== item.expectedFileState) {
			outcomes.push({
				kind: "error",
				template: item.template,
				path: item.path,
				absolutePath: item.absolutePath,
				error: `Target file state changed between plan and apply: expected ${item.expectedFileState}, found ${currentState}.`,
			});
		}
	}
	return outcomes;
}

function summarizeApply(outcomes: GenerateApplyOutcome[]): GenerateApplyResult {
	return {
		outcomes,
		writtenCount: outcomes.filter((outcome) => outcome.kind === "written")
			.length,
		skippedCount: outcomes.filter((outcome) => outcome.kind === "skipped")
			.length,
		errorCount: outcomes.filter((outcome) => outcome.kind === "error").length,
	};
}

// ─── Format generate results for reporting ──────────────────────────────────

export function formatGenerateApplyOutcome(
	outcome: GenerateApplyOutcome,
): string {
	switch (outcome.kind) {
		case "written":
			return `${outcome.action === "replace" ? "Replaced" : "Generated"} ${
				outcome.path
			}`;
		case "skipped":
			return `Skipped ${outcome.path} (already exists)`;
		case "error":
			return `Failed to generate ${outcome.path}: ${outcome.error}`;
	}
}

export function formatGeneratePlanError(error: GeneratePlanError): string {
	return `Failed to plan ${error.path}: ${error.message}`;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
