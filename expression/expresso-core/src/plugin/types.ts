import type { OperatorRegistry } from "../operators/registry";
import type { OperatorCategory } from "../types/metadata";

export interface PluginRegistrationContext {
	operatorRegistry: OperatorRegistry;
}

export interface OperatorBinding {
	/** logicalId value. */
	logicalId: string;
	/** runtimeId value. */
	runtimeId: string;
}

/**
 * Plugin contract.
 */
export interface Plugin {
	/** name value. */
	name: string;
	/** version value. */
	version: string;
	/** description value. */
	description?: string;
	/** category value. */
	category: OperatorCategory;
	/** operators value. */
	operators: string[];
	/** operatorBindings value. */
	operatorBindings?: OperatorBinding[];
	/** dependencies value. */
	dependencies?: string[];
	/** register value. */
	register: (context: PluginRegistrationContext) => void | Promise<void>;
	/** unregister value. */
	unregister?: (context: PluginRegistrationContext) => void | Promise<void>;
}

/**
 * PluginManifest contract.
 */
export interface PluginManifest {
	/** name value. */
	name: string;
	/** version value. */
	version: string;
	/** description value. */
	description?: string;
	/** main value. */
	main: string;
	/** operators value. */
	operators: string[];
	/** operatorBindings value. */
	operatorBindings?: OperatorBinding[];
	/** dependencies value. */
	dependencies?: string[];
	/** namespace value. */
	namespace?: string;
	/** author value. */
	author?: {
		name: string;
		email?: string;
	};
	/** repository value. */
	repository?: string;
	/** homepage value. */
	homepage?: string;
	/** keywords value. */
	keywords?: string[];
	/** license value. */
	license?: string;
}

/**
 * PluginLoadOptions contract.
 */
export interface PluginLoadOptions {
	/** validateManifest value. */
	validateManifest?: boolean;
	/** autoRegister value. */
	autoRegister?: boolean;
	/** checkDependencies value. */
	checkDependencies?: boolean;
}

/**
 * CreatePluginOptions contract.
 */
export interface CreatePluginOptions {
	/** name value. */
	name: string;
	/** version value. */
	version: string;
	/** description value. */
	description?: string;
	/** category value. */
	category: OperatorCategory;
	/** operators value. */
	operators: string[];
	/** operatorBindings value. */
	operatorBindings?: OperatorBinding[];
	/** dependencies value. */
	dependencies?: string[];
	/** register value. */
	register: (context: PluginRegistrationContext) => void;
	/** unregister value. */
	unregister?: (context: PluginRegistrationContext) => void;
}

/**
 * PluginLoadResult contract.
 */
export interface PluginLoadResult {
	/** success value. */
	success: boolean;
	/** plugin value. */
	plugin: Plugin;
	/** errors value. */
	errors?: string[];
	/** warnings value. */
	warnings?: string[];
}

/**
 * PluginRegistryState contract.
 */
export interface PluginRegistryState {
	/** plugins value. */
	plugins: Map<string, Plugin>;
	/** namespaces value. */
	namespaces: Map<string, Set<string>>;
	/** loadedAt value. */
	loadedAt: Date;
}
