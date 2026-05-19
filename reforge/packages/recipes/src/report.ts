// ─── Change records ───────────────────────────────────────────────────────────

export interface RecipeChange {
	filePath: string;
	recipeName: string;
	description: string;
}

export interface RecipeWarning {
	filePath: string;
	recipeName: string;
	message: string;
}

export interface RecipeNeedsReview {
	filePath: string;
	recipeName: string;
	reason: string;
}

export interface RecipeFileSummary {
	filePath: string;
	changed: boolean;
	diff: string;
	changes: RecipeChange[];
	warnings: RecipeWarning[];
	needsReview: RecipeNeedsReview[];
	/** Semantic changes detected in this file — concepts, not line noise. */
	semanticChanges: import("@reforge/core").SemanticChange[];
}

// ─── RecipeReport ─────────────────────────────────────────────────────────────

export interface RecipeReport {
	/** High-level counts. */
	summary: {
		totalFiles: number;
		changedFiles: number;
		skippedFiles: number;
		erroredFiles: number;
		durationMs: number;
		/** Per-recipe change counts. */
		byRecipe: Record<string, number>;
	};

	/** All recorded changes, one per report.change() call. */
	changes: RecipeChange[];
	/** Non-fatal warnings from report.warn(). */
	warnings: RecipeWarning[];
	/** Files flagged for manual follow-up via report.needsReview(). */
	needsReview: RecipeNeedsReview[];
	/** Per-file details including diffs. */
	files: RecipeFileSummary[];

	/** Human-readable Markdown report — paste into a PR description. */
	toMarkdown(): string;
	/** Machine-readable JSON — for CI integrations. */
	toJson(): string;
}

// ─── Mutable builder (used internally by runRecipes) ─────────────────────────

export interface ReportBuilder {
	addChange(c: RecipeChange): void;
	addWarning(w: RecipeWarning): void;
	addNeedsReview(n: RecipeNeedsReview): void;
	addFile(f: RecipeFileSummary): void;
	build(opts: {
		totalFiles: number;
		skippedFiles: number;
		erroredFiles: number;
		durationMs: number;
	}): RecipeReport;
}

export function createReportBuilder(): ReportBuilder {
	const changes: RecipeChange[] = [];
	const warnings: RecipeWarning[] = [];
	const needsReview: RecipeNeedsReview[] = [];
	const files: RecipeFileSummary[] = [];

	return {
		addChange(c) {
			changes.push(c);
		},
		addWarning(w) {
			warnings.push(w);
		},
		addNeedsReview(n) {
			needsReview.push(n);
		},
		addFile(f) {
			files.push(f);
		},

		build({ totalFiles, skippedFiles, erroredFiles, durationMs }) {
			const changedFiles = files.filter((f) => f.changed).length;

			// Count changes per recipe
			const byRecipe: Record<string, number> = {};
			for (const c of changes) {
				byRecipe[c.recipeName] = (byRecipe[c.recipeName] ?? 0) + 1;
			}

			const report: RecipeReport = {
				summary: {
					totalFiles,
					changedFiles,
					skippedFiles,
					erroredFiles,
					durationMs,
					byRecipe,
				},
				changes,
				warnings,
				needsReview,
				files,

				toMarkdown() {
					return buildMarkdown(report);
				},

				toJson() {
					return JSON.stringify(
						{
							summary: report.summary,
							changes: report.changes,
							warnings: report.warnings,
							needsReview: report.needsReview,
						},
						null,
						2,
					);
				},
			};

			return report;
		},
	};
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function buildMarkdown(report: RecipeReport): string {
	const { summary, changes, warnings, needsReview } = report;
	const lines: string[] = [];

	const dur =
		summary.durationMs < 1000
			? `${summary.durationMs}ms`
			: `${(summary.durationMs / 1000).toFixed(1)}s`;

	lines.push(`## Reforge migration report`);
	lines.push(``);
	lines.push(`| | |`);
	lines.push(`|---|---|`);
	lines.push(
		`| Files changed | **${summary.changedFiles}** of ${summary.totalFiles} |`,
	);
	if (summary.skippedFiles > 0)
		lines.push(`| Files skipped | ${summary.skippedFiles} |`);
	if (summary.erroredFiles > 0)
		lines.push(`| Errors | ${summary.erroredFiles} |`);
	if (needsReview.length > 0)
		lines.push(`| Needs review | ${needsReview.length} |`);
	lines.push(`| Duration | ${dur} |`);
	lines.push(``);

	// Per-recipe summary
	const recipeNames = Object.keys(summary.byRecipe);
	if (recipeNames.length > 0) {
		lines.push(`### Changes by recipe`);
		lines.push(``);
		for (const name of recipeNames) {
			lines.push(`- **${name}**: ${summary.byRecipe[name]} change(s)`);
		}
		lines.push(``);
	}

	// Needs review
	if (needsReview.length > 0) {
		lines.push(`### Files needing manual review`);
		lines.push(``);
		for (const nr of needsReview) {
			lines.push(`- \`${nr.filePath}\` — ${nr.reason} *(${nr.recipeName})*`);
		}
		lines.push(``);
	}

	// Warnings
	if (warnings.length > 0) {
		lines.push(`### Warnings`);
		lines.push(``);
		for (const w of warnings) {
			lines.push(`- \`${w.filePath}\`: ${w.message} *(${w.recipeName})*`);
		}
		lines.push(``);
	}

	// Changed files with semantic summary + recipe descriptions
	if (report.files.some((f) => f.changed)) {
		lines.push(`### Change log`);
		lines.push(``);

		for (const file of report.files.filter((f) => f.changed)) {
			lines.push(`**\`${file.filePath}\`**`);

			// Semantic changes first — the "what changed" story
			if (file.semanticChanges?.length > 0) {
				for (const sc of file.semanticChanges) {
					const bullet = sc.kind.endsWith(":added")
						? "+"
						: sc.kind.endsWith(":removed")
							? "-"
							: "~";
					lines.push(`- \`${bullet}\` ${sc.summary}`);
				}
			}

			// Recipe descriptions — the "why it changed" story
			const fileRecipeChanges = changes.filter(
				(c) => c.filePath === file.filePath,
			);
			if (fileRecipeChanges.length > 0) {
				for (const c of fileRecipeChanges) {
					lines.push(`  - ${c.description} *(${c.recipeName})*`);
				}
			}
		}
		lines.push(``);
	}

	return lines.join("\n");
}
