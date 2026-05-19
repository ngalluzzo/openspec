import * as ts from "typescript";
import { createDefaultTruthiness, createIdentifier } from "../ast";
import { UnsupportedTypeScriptExpressionError } from "../errors";
import type { TypeScriptNativeOperatorLowerer } from "./shared";

function lowerRequiredExpression(argument: ts.Expression): ts.Expression {
	return ts.factory.createCallExpression(
		ts.factory.createParenthesizedExpression(
			ts.factory.createArrowFunction(
				undefined,
				undefined,
				[
					ts.factory.createParameterDeclaration(
						undefined,
						undefined,
						createIdentifier("value"),
					),
				],
				undefined,
				ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
				ts.factory.createParenthesizedExpression(
					ts.factory.createBinaryExpression(
						ts.factory.createBinaryExpression(
							ts.factory.createBinaryExpression(
								createIdentifier("value"),
								ts.SyntaxKind.ExclamationEqualsEqualsToken,
								ts.factory.createNull(),
							),
							ts.SyntaxKind.AmpersandAmpersandToken,
							ts.factory.createBinaryExpression(
								createIdentifier("value"),
								ts.SyntaxKind.ExclamationEqualsEqualsToken,
								createIdentifier("undefined"),
							),
						),
						ts.SyntaxKind.AmpersandAmpersandToken,
						ts.factory.createParenthesizedExpression(
							ts.factory.createBinaryExpression(
								ts.factory.createBinaryExpression(
									ts.factory.createTypeOfExpression(createIdentifier("value")),
									ts.SyntaxKind.ExclamationEqualsEqualsToken,
									ts.factory.createStringLiteral("string"),
								),
								ts.SyntaxKind.BarBarToken,
								ts.factory.createBinaryExpression(
									ts.factory.createCallExpression(
										ts.factory.createPropertyAccessExpression(
											createIdentifier("value"),
											createIdentifier("trim"),
										),
										undefined,
										[],
									),
									ts.SyntaxKind.ExclamationEqualsEqualsToken,
									ts.factory.createStringLiteral(""),
								),
							),
						),
					),
				),
			),
		),
		undefined,
		[argument],
	);
}

function lowerIfExpression(
	args: readonly unknown[],
	lowerCondition: (value: unknown) => ts.Expression,
	lowerValue: (value: unknown) => ts.Expression,
): ts.Expression {
	if (args.length < 3 || args.length % 2 === 0) {
		throw new UnsupportedTypeScriptExpressionError(
			"if requires an odd number of arguments with a trailing else branch",
		);
	}

	const lowerChain = (offset: number): ts.Expression => {
		if (offset === args.length - 1) {
			return lowerValue(args[offset]);
		}

		return ts.factory.createConditionalExpression(
			createDefaultTruthiness(lowerCondition(args[offset])),
			ts.factory.createToken(ts.SyntaxKind.QuestionToken),
			lowerValue(args[offset + 1]),
			ts.factory.createToken(ts.SyntaxKind.ColonToken),
			lowerChain(offset + 2),
		);
	};

	return lowerChain(0);
}

function lowerLogicalChain(
	operator: "and" | "or",
	args: readonly unknown[],
	lower: (value: unknown) => ts.Expression,
): ts.Expression {
	if (args.length === 0) {
		throw new UnsupportedTypeScriptExpressionError(
			`${operator} requires at least one argument`,
		);
	}

	const lowerChain = (offset: number): ts.Expression => {
		if (offset === args.length - 1) {
			return lower(args[offset]);
		}

		const current = lower(args[offset]);
		const remainder = lowerChain(offset + 1);

		return operator === "and"
			? ts.factory.createConditionalExpression(
					createDefaultTruthiness(current),
					ts.factory.createToken(ts.SyntaxKind.QuestionToken),
					remainder,
					ts.factory.createToken(ts.SyntaxKind.ColonToken),
					current,
				)
			: ts.factory.createConditionalExpression(
					createDefaultTruthiness(current),
					ts.factory.createToken(ts.SyntaxKind.QuestionToken),
					current,
					ts.factory.createToken(ts.SyntaxKind.ColonToken),
					remainder,
				);
	};

	return lowerChain(0);
}

export const lowerLogicOperator: TypeScriptNativeOperatorLowerer = (
	operator,
	args,
	context,
	lower,
) => {
	switch (operator) {
		case "required": {
			if (args.length !== 1) {
				throw new UnsupportedTypeScriptExpressionError(
					"required requires exactly one argument",
				);
			}

			const [value] = args as readonly [(typeof args)[number]];
			return lowerRequiredExpression(lower(value, context));
		}

		case "if":
			return lowerIfExpression(
				args,
				(value) => lower(value as never, context),
				(value) => lower(value as never, context),
			);

		case "and":
			return lowerLogicalChain("and", args, (value) =>
				lower(value as never, context),
			);

		case "or":
			return lowerLogicalChain("or", args, (value) =>
				lower(value as never, context),
			);

		case "!": {
			if (args.length !== 1) {
				throw new UnsupportedTypeScriptExpressionError(
					"! requires exactly one argument",
				);
			}

			const [value] = args as readonly [(typeof args)[number]];
			return ts.factory.createPrefixUnaryExpression(
				ts.SyntaxKind.ExclamationToken,
				createDefaultTruthiness(lower(value, context)),
			);
		}

		case "!!": {
			if (args.length !== 1) {
				throw new UnsupportedTypeScriptExpressionError(
					"!! requires exactly one argument",
				);
			}

			const [value] = args as readonly [(typeof args)[number]];
			return createDefaultTruthiness(lower(value, context));
		}

		default:
			return undefined;
	}
};
