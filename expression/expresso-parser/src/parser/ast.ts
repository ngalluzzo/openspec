/**
 * ASTLiteral contract.
 */
export type ASTLiteral = {
	readonly kind: "literal";
	readonly value: string | number | boolean | null;
};

/**
 * ASTIdentifier contract.
 */
export type ASTIdentifier = {
	readonly kind: "identifier";
	readonly path: string;
};

/**
 * ASTVarCall contract.
 */
export type ASTVarCall = {
	readonly kind: "var-call";
	readonly path: string;
};

/**
 * ASTBinaryExpr contract.
 */
export type ASTBinaryExpr = {
	readonly kind: "binary";
	readonly operator: string;
	readonly left: ASTNode;
	readonly right: ASTNode;
};

/**
 * ASTUnaryExpr contract.
 */
export type ASTUnaryExpr = {
	readonly kind: "unary";
	readonly operator: string;
	readonly operand: ASTNode;
};

/**
 * ASTCallExpr contract.
 */
export type ASTCallExpr = {
	readonly kind: "call";
	readonly callee: string;
	readonly args: (ASTNode | ASTLambda)[];
};

/**
 * ASTLambda contract.
 */
export type ASTLambda = {
	readonly kind: "lambda";
	readonly paramName: string;
	readonly secondParamName?: string;
	readonly body: ASTNode;
};

/**
 * ASTDataLiteral contract.
 */
export type ASTDataLiteral = {
	readonly kind: "data";
	readonly value: ASTNode;
};

/**
 * ASTArrayLiteral contract.
 */
export type ASTArrayLiteral = {
	readonly kind: "array";
	readonly elements: ASTNode[];
};

/**
 * ASTObjectLiteral contract.
 */
export type ASTObjectLiteral = {
	readonly kind: "object";
	readonly entries: Array<{ key: string; value: ASTNode }>;
};

/**
 * ASTNode contract.
 */
export type ASTNode =
	| ASTLiteral
	| ASTIdentifier
	| ASTVarCall
	| ASTBinaryExpr
	| ASTUnaryExpr
	| ASTCallExpr
	| ASTLambda
	| ASTDataLiteral
	| ASTArrayLiteral
	| ASTObjectLiteral;
