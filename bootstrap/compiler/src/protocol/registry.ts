import { type Diagnostic, error } from "@openspec/kernel";
import type { AnyProtocol } from "./types.ts";

export type ProtocolRegistry = {
	protocols: AnyProtocol[];
	diagnostics: Diagnostic[];
	get(id: string): AnyProtocol | undefined;
};

export function createProtocolRegistry(
	protocols: readonly AnyProtocol[],
): ProtocolRegistry {
	const byId = new Map<string, AnyProtocol>();
	const diagnostics: Diagnostic[] = [];

	for (const protocol of protocols) {
		const existing = byId.get(protocol.id);
		if (existing) {
			diagnostics.push(
				error({
					code: "protocol.duplicate",
					message: `Protocol '${protocol.id}' is registered more than once.`,
					details: {
						protocol: protocol.id,
					},
				}),
			);
			continue;
		}
		byId.set(protocol.id, protocol);
	}

	return {
		protocols: [...byId.values()],
		diagnostics,
		get(id) {
			return byId.get(id);
		},
	};
}
