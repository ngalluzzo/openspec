import type { Protocol } from "./types.ts";

export function defineProtocol<TDocument>(
	input: Protocol<TDocument>,
): Protocol<TDocument> {
	return input;
}
