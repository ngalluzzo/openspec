import * as ts from "typescript";
import { UnsupportedTypeScriptExpressionError } from "../errors";
import { createIdentifier, createStringCoercion } from "../ast";
import type { TypeScriptNativeOperatorLowerer } from "./shared";

export const lowerStringOperator: TypeScriptNativeOperatorLowerer = (
	operator,
	args,
	context,
	lower,
) => {
	switch (operator) {
		case "trim": {
			if (args.length !== 1) {
				throw new UnsupportedTypeScriptExpressionError(
					"trim requires exactly one argument",
				);
			}

			const [value] = args as readonly [(typeof args)[number]];
			return ts.factory.createCallExpression(
				ts.factory.createPropertyAccessExpression(
					createStringCoercion(lower(value, context)),
					createIdentifier("trim"),
				),
				undefined,
				[],
			);
		}

		case "cat": {
			if (args.length === 0) {
				throw new UnsupportedTypeScriptExpressionError(
					"cat requires at least one argument",
				);
			}

			return ts.factory.createCallExpression(
				ts.factory.createPropertyAccessExpression(
					ts.factory.createCallExpression(
						ts.factory.createPropertyAccessExpression(
							ts.factory.createArrayLiteralExpression(
								args.map((arg) => lower(arg, context)),
								false,
							),
							createIdentifier("map"),
						),
						undefined,
						[
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
								createStringCoercion(createIdentifier("value")),
							),
						],
					),
					createIdentifier("join"),
				),
				undefined,
				[ts.factory.createStringLiteral("")],
			);
		}

		default:
			return undefined;
	}
};
