import * as ModelTypes from "./capability-assembler-types.generated";

export type CapabilityAssemblerAdapter = { assemble: (input: unknown) => Promise<unknown>; };

export type CapabilityAssemblerAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof CapabilityAssemblerAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const capabilityAssemblerAdapterContract: CapabilityAssemblerAdapterContract = { capability: "capability.assembler", methods: [{ name: "assemble", guards: [] }] };

export function implementCapabilityAssemblerAdapter(adapter: CapabilityAssemblerAdapter): CapabilityAssemblerAdapter {
	return adapter;
}

export type CapabilityAssembler = CapabilityAssemblerAdapter;
