import { defineProtocol } from "../protocol/define-protocol.ts";

const noopLower = async (_doc: unknown, context: { document: { protocol: string; id: string } }) => ({
	protocol: context.document.protocol,
	documentId: context.document.id,
});

export const patternProtocol = defineProtocol<unknown>({
	id: "openspec.pattern.v1",
	lower: noopLower,
});

export const providerProtocol = defineProtocol<unknown>({
	id: "openspec.provider.v1",
	lower: noopLower,
});
