import type {
	Operator,
	OperatorHandler,
	ValidationSchema,
} from "../runtime/contracts/types";
import type { OperatorMetadata } from "../types/metadata";

export class OperatorRegistry {
	private operators = new Map<string, Operator>();

	register<TInput = unknown, TOutput = unknown>(
		name: string,
		operator: Operator<TInput, TOutput>,
	): void {
		if (this.operators.has(name)) {
			// Allow idempotent registration and intentional overrides.
			this.operators.set(name, operator as Operator);
			return;
		}
		this.operators.set(name, operator as Operator);
	}

	registerSync<TInput = unknown, TOutput = unknown>(
		name: string,
		handler: OperatorHandler<TInput, TOutput>,
		options?: {
			inputSchema?: ValidationSchema;
			outputSchema?: ValidationSchema;
			eager?: boolean;
			metadata?: OperatorMetadata;
		},
	): void {
		const operator = {
			handler,
			...options,
			async: false,
		};
		this.register(name, operator);

		if (options?.metadata?.aliases) {
			options.metadata.aliases.forEach((alias) => {
				if (alias !== name && !this.operators.has(alias)) {
					this.operators.set(alias, operator as Operator);
				}
			});
		}
	}

	registerAsync<TInput = unknown, TOutput = unknown>(
		name: string,
		handler: OperatorHandler<TInput, Promise<TOutput>>,
		options?: {
			inputSchema?: ValidationSchema;
			outputSchema?: ValidationSchema;
			eager?: boolean;
			metadata?: OperatorMetadata;
		},
	): void {
		const operator = {
			handler: handler as OperatorHandler<TInput, TOutput>,
			...options,
			async: true,
		};
		this.register(name, operator);

		if (options?.metadata?.aliases) {
			options.metadata.aliases.forEach((alias) => {
				if (alias !== name && !this.operators.has(alias)) {
					this.operators.set(alias, operator as Operator);
				}
			});
		}
	}

	createOperatorDefinition<TInput = unknown, TOutput = unknown>(
		id: string,
		handler: OperatorHandler<TInput, TOutput>,
		options?: {
			inputSchema?: ValidationSchema;
			outputSchema?: ValidationSchema;
			eager?: boolean;
			metadata?: OperatorMetadata;
			async?: boolean;
		},
	): () => void {
		return () => {
			if (options?.async) {
				this.registerAsync(
					id,
					handler as OperatorHandler<TInput, Promise<TOutput>>,
					options,
				);
			} else {
				this.registerSync(id, handler, options);
			}
		};
	}

	get(name: string): Operator | undefined {
		return this.operators.get(name);
	}

	has(name: string): boolean {
		if (this.operators.has(name)) {
			return true;
		}

		// Also check if any existing operator has this as an alias
		for (const [, operator] of this.operators) {
			if (operator.metadata?.aliases?.includes(name)) {
				return true;
			}
		}

		return false;
	}

	getAll(): Map<string, Operator> {
		return new Map(this.operators);
	}

	list(): string[] {
		return Array.from(this.operators.keys());
	}

	unregister(name: string): boolean {
		return this.operators.delete(name);
	}

	clear(): void {
		this.operators.clear();
	}

	validateArgs(name: string, args: unknown): boolean {
		const op = this.get(name);
		if (!op?.inputSchema) {
			return true;
		}

		const result = op.inputSchema.safeParse(args);
		return result.success;
	}

	getSchema(
		name: string,
	): { input?: ValidationSchema; output?: ValidationSchema } | undefined {
		const op = this.get(name);
		if (!op) return undefined;

		return {
			...(op.inputSchema !== undefined && { input: op.inputSchema }),
			...(op.outputSchema !== undefined && { output: op.outputSchema }),
		};
	}
}

const globalOperatorRegistry = new OperatorRegistry();

export const createOperatorRegistry = (): OperatorRegistry =>
	new OperatorRegistry();

export const register = <TInput = unknown, TOutput = unknown>(
	operatorRegistry: OperatorRegistry = globalOperatorRegistry,
	name: string,
	operator: Operator<TInput, TOutput>,
): void => operatorRegistry.register(name, operator);

export const registerSync = <TInput = unknown, TOutput = unknown>(
	operatorRegistry: OperatorRegistry = globalOperatorRegistry,
	name: string,
	handler: OperatorHandler<TInput, TOutput>,
	options?: {
		inputSchema?: ValidationSchema;
		outputSchema?: ValidationSchema;
		eager?: boolean;
		metadata?: OperatorMetadata;
	},
): void => operatorRegistry.registerSync(name, handler, options);

export const registerAsync = <TInput = unknown, TOutput = unknown>(
	operatorRegistry: OperatorRegistry = globalOperatorRegistry,
	name: string,
	handler: OperatorHandler<TInput, Promise<TOutput>>,
	options?: {
		inputSchema?: ValidationSchema;
		outputSchema?: ValidationSchema;
		eager?: boolean;
		metadata?: OperatorMetadata;
	},
): void => operatorRegistry.registerAsync(name, handler, options);

export const createOperatorDefinition = <TInput = unknown, TOutput = unknown>(
	operatorRegistry: OperatorRegistry = globalOperatorRegistry,
	id: string,
	handler: OperatorHandler<TInput, TOutput>,
	options?: {
		inputSchema?: ValidationSchema;
		outputSchema?: ValidationSchema;
		eager?: boolean;
		metadata?: OperatorMetadata;
		async?: boolean;
	},
): (() => void) =>
	operatorRegistry.createOperatorDefinition(id, handler, options);

export const getOperator = (
	operatorRegistry: OperatorRegistry = globalOperatorRegistry,
	name: string,
): Operator | undefined => operatorRegistry.get(name);

export const hasOperator = (
	operatorRegistry: OperatorRegistry = globalOperatorRegistry,
	name: string,
): boolean => operatorRegistry.has(name);

export const clearRegistry = (
	operatorRegistry: OperatorRegistry = globalOperatorRegistry,
): void => operatorRegistry.clear();

export const getSchema = (
	operatorRegistry: OperatorRegistry = globalOperatorRegistry,
	name: string,
): { input?: ValidationSchema; output?: ValidationSchema } | undefined =>
	operatorRegistry.getSchema(name);

export const validateArgs = (
	operatorRegistry: OperatorRegistry = globalOperatorRegistry,
	name: string,
	args: unknown,
): boolean => operatorRegistry.validateArgs(name, args);

export const getAllOperators = (
	operatorRegistry: OperatorRegistry = globalOperatorRegistry,
): Map<string, Operator> => operatorRegistry.getAll();

export const listOperators = (
	operatorRegistry: OperatorRegistry = globalOperatorRegistry,
): string[] => operatorRegistry.list();

export const unregister = (
	operatorRegistry: OperatorRegistry = globalOperatorRegistry,
	name: string,
): boolean => operatorRegistry.unregister(name);

export const getDefaultOperatorRegistry = (): OperatorRegistry =>
	globalOperatorRegistry;
