import * as ts from "typescript";
import type { Rule } from "../../../runtime/contracts/types";
import { UnsupportedTypeScriptExpressionError } from "../errors";
import type { TypeScriptNativeOperatorLowerer } from "./shared";
import { assertSupportedPath, createHelperCall } from "../ast";

export const lowerAccessOperator: TypeScriptNativeOperatorLowerer = (
	operator,
	args,
	context,
	lower,
) => {
	switch (operator) {
		case "var": {
			const [path, defaultValue] = args;
			if (typeof path !== "string") {
				throw new UnsupportedTypeScriptExpressionError(
					"var requires a static string path for native TypeScript emission",
				);
			}

			assertSupportedPath(path);
			return createHelperCall(context, "getPathValue", [
				context.rootReference,
				ts.factory.createStringLiteral(path),
				...(defaultValue === undefined ? [] : [lower(defaultValue, context)]),
			]);
		}

		case "get": {
			const [target, path, defaultValue] = args;
			if (typeof path !== "string") {
				throw new UnsupportedTypeScriptExpressionError(
					"get requires a static string path for native TypeScript emission",
				);
			}

			assertSupportedPath(path);
			return createHelperCall(context, "getPathValue", [
				lower(target as Rule, context),
				ts.factory.createStringLiteral(path),
				...(defaultValue === undefined ? [] : [lower(defaultValue, context)]),
			]);
		}

		case "has": {
			const [target, path] = args;
			if (typeof path !== "string") {
				throw new UnsupportedTypeScriptExpressionError(
					"has requires a static string path for native TypeScript emission",
				);
			}

			assertSupportedPath(path);
			return createHelperCall(context, "hasPathValue", [
				lower(target as Rule, context),
				ts.factory.createStringLiteral(path),
			]);
		}

		case "set": {
			const [baseObject, path, value] = args;
			if (typeof path !== "string") {
				throw new UnsupportedTypeScriptExpressionError(
					"set requires a static string path for native TypeScript emission",
				);
			}

			assertSupportedPath(path);
			return createHelperCall(context, "setPathValue", [
				lower(baseObject as Rule, context),
				ts.factory.createStringLiteral(path),
				lower(value as Rule, context),
			]);
		}

		default:
			return undefined;
	}
};
