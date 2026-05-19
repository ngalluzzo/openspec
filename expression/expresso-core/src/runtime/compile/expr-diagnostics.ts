/**
 * RawExprUsageKind contract.
 */
export type RawExprUsageKind = "varRaw" | "opRaw";

/**
 * RawExprUsageDiagnostic contract.
 */
export interface RawExprUsageDiagnostic {
	/** kind value. */
	readonly kind: RawExprUsageKind;
	/** value value. */
	readonly value: string;
}

/**
 * RawUsagePolicy contract.
 */
export type RawUsagePolicy = "off" | "warn" | "error";

/**
 * ExprDiagnosticsOptions contract.
 */
export interface ExprDiagnosticsOptions {
	/** rawUsagePolicy value. */
	readonly rawUsagePolicy?: RawUsagePolicy;
	/** onDiagnostic value. */
	readonly onDiagnostic?: (diagnostic: RawExprUsageDiagnostic) => void;
}

/**
 * Executes `reportRawUsage` with the provided inputs.
 *
 * @param options - Optional behavior and execution settings.
 * @param diagnostic - The `diagnostic` argument value.
 *
 * @example
 * reportRawUsage(options, diagnostic);
 */

export function reportRawUsage(
	options: ExprDiagnosticsOptions | undefined,
	diagnostic: RawExprUsageDiagnostic,
): void {
	const policy = options?.rawUsagePolicy ?? "off";

	if (policy === "off") {
		return;
	}

	options?.onDiagnostic?.(diagnostic);

	if (policy === "warn" && options?.onDiagnostic === undefined) {
		console.warn(
			`[expresso] raw expression usage (${diagnostic.kind}): ${diagnostic.value}`,
		);
	}

	if (policy === "error") {
		throw new Error(
			`[expresso] raw expression usage forbidden (${diagnostic.kind}): ${diagnostic.value}`,
		);
	}
}
