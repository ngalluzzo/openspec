import type { EvaluationTrace } from "../contracts/types";

/**
 * FormatTraceOptions contract.
 */
export interface FormatTraceOptions {
	/** showTimestamps value. */
	showTimestamps?: boolean;
	/** showArgs value. */
	showArgs?: boolean;
	/** showDepth value. */
	showDepth?: boolean;
	/** indentSpaces value. */
	indentSpaces?: number;
	/** colorize value. */
	colorize?: boolean;
}

const colors = {
	reset: "\x1b[0m",
	operator: "\x1b[36m",
	result: "\x1b[32m",
	depth: "\x1b[33m",
	args: "\x1b[90m",
	separator: "\x1b[37m",
};

/**
 * Executes `formatTrace` with the provided inputs.
 *
 * @param trace - The `trace` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `formatTrace`.
 *
 * @example
 * formatTrace(trace, options);
 */

export function formatTrace(
	trace: EvaluationTrace[],
	options: FormatTraceOptions = {},
): string {
	const {
		showTimestamps = false,
		showArgs = true,
		showDepth = true,
		indentSpaces = 2,
		colorize = process.stdout.isTTY,
	} = options;

	const c = colorize
		? colors
		: {
				reset: "",
				operator: "",
				result: "",
				depth: "",
				args: "",
				separator: "",
			};

	return trace
		.map((entry, index) => {
			const indent = " ".repeat(entry.depth * indentSpaces);
			const depthStr = showDepth
				? `${c.depth}[depth ${entry.depth}]${c.separator} `
				: "";
			const operatorStr = `${c.operator}${entry.operator}${c.separator}`;
			const resultStr = `${c.result}${JSON.stringify(entry.result)}${c.reset}`;
			const timestampStr = showTimestamps
				? `${c.separator}(t: ${entry.timestamp})`
				: "";
			const argsStr = showArgs
				? ` ${c.args}args: ${JSON.stringify(entry.args)}${c.separator}`
				: "";

			return `${indent}${index + 1}. ${depthStr}${operatorStr} → ${resultStr}${timestampStr}${argsStr}`;
		})
		.join("\n");
}

/**
 * Executes `formatTraceSummary` with the provided inputs.
 *
 * @param trace - The `trace` argument value.
 *
 * @returns The result produced by `formatTraceSummary`.
 *
 * @example
 * formatTraceSummary(trace);
 */

export function formatTraceSummary(trace: EvaluationTrace[]): string {
	const operators = [...new Set(trace.map((t) => t.operator))];
	const maxDepth = Math.max(...trace.map((t) => t.depth), 0);
	const evaluationsByOp = trace.reduce(
		(acc, t) => {
			acc[t.operator] = (acc[t.operator] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>,
	);

	const lines = [
		`Total evaluations: ${trace.length}`,
		`Max depth: ${maxDepth}`,
		`Operators used: ${operators.length}`,
		`Evaluations by operator:`,
	];

	for (const [op, count] of Object.entries(evaluationsByOp)) {
		lines.push(`  - ${op}: ${count}`);
	}

	return lines.join("\n");
}

/**
 * Executes `findTraceEntries` with the provided inputs.
 *
 * @param trace - The `trace` argument value.
 * @param predicate - The `predicate` argument value.
 *
 * @returns The result produced by `findTraceEntries`.
 *
 * @example
 * findTraceEntries(trace, predicate);
 */

export function findTraceEntries(
	trace: EvaluationTrace[],
	predicate: (entry: EvaluationTrace) => boolean,
): EvaluationTrace[] {
	return trace.filter(predicate);
}

/**
 * Executes `getTraceByOperator` with the provided inputs.
 *
 * @param trace - The `trace` argument value.
 * @param operator - The `operator` argument value.
 *
 * @returns The result produced by `getTraceByOperator`.
 *
 * @example
 * getTraceByOperator(trace, operator);
 */

export function getTraceByOperator(
	trace: EvaluationTrace[],
	operator: string,
): EvaluationTrace[] {
	return findTraceEntries(trace, (t) => t.operator === operator);
}

/**
 * Executes `getTraceByDepth` with the provided inputs.
 *
 * @param trace - The `trace` argument value.
 * @param depth - The `depth` argument value.
 *
 * @returns The result produced by `getTraceByDepth`.
 *
 * @example
 * getTraceByDepth(trace, depth);
 */

export function getTraceByDepth(
	trace: EvaluationTrace[],
	depth: number,
): EvaluationTrace[] {
	return findTraceEntries(trace, (t) => t.depth === depth);
}

/**
 * Executes `getTraceEntriesWithResult` with the provided inputs.
 *
 * @param trace - The `trace` argument value.
 * @param result - The `result` argument value.
 *
 * @returns The result produced by `getTraceEntriesWithResult`.
 *
 * @example
 * getTraceEntriesWithResult(trace, result);
 */

export function getTraceEntriesWithResult(
	trace: EvaluationTrace[],
	result: unknown,
): EvaluationTrace[] {
	return findTraceEntries(trace, (t) => t.result === result);
}
