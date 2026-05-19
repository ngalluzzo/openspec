export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = {
	[key: string]: JsonValue;
};

export type SourceRef = {
	path?: string;
	range?: {
		start: number;
		end: number;
	};
};

export type Provenance = {
	protocol: string;
	documentId: string;
	contribution: number;
	source?: SourceRef;
};
