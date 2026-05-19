/**
 * ValidationError contract.
 */
export interface ValidationError {
	/** operator value. */
	operator: string;
	/** field value. */
	field: string;
	/** message value. */
	message: string;
	/** severity value. */
	severity: "error" | "warning";
}

/**
 * ValidationResult contract.
 */
export interface ValidationResult {
	/** valid value. */
	valid: boolean;
	/** errors value. */
	errors: ValidationError[];
	/** warnings value. */
	warnings: ValidationError[];
	/** summary value. */
	summary: {
		total: number;
		valid: number;
		hasErrors: number;
		hasWarnings: number;
		missingExamples: number;
		missingDescription: number;
		deprecated: number;
	};
}
