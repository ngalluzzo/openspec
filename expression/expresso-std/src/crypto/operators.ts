import { defineAsyncOperator, defineSyncOperator } from "@gooi/expresso-core";
import type { OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers hash.
 *
 * @returns The result produced by `registerHash`.
 *
 * @example
 * registerHash();
 */

export function registerHash(operatorRegistry: OperatorRegistry) {
	defineAsyncOperator<[string, string], string>("hash", {
		handler: async ([algorithm, value]) => {
			const str = String(value ?? "");
			const validAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

			if (!validAlgorithms.includes(algorithm)) {
				throw new Error(
					`Unsupported hash algorithm: ${algorithm}. Supported: ${validAlgorithms.join(", ")}`,
				);
			}

			const encoder = new TextEncoder();
			const data = encoder.encode(str);
			const hashBuffer = await crypto.subtle.digest(algorithm, data);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			const hashHex = hashArray
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");
			return hashHex;
		},
		inputSchema: z.tuple([z.string(), z.string()]),
		outputSchema: z.string(),
		eager: true,
		metadata: {
			name: "hash",
			title: "Hash",
			description:
				"Compute hash of a string using specified algorithm (SHA-1, SHA-256, SHA-384, SHA-512)",
			category: "crypto",
			tags: ["crypto", "hash", "security", "async"],
			examples: [
				{
					description: "SHA-256 hash",
					input: {},
					rule: { hash: ["SHA-256", "Hello, World!"] },
					output:
						"dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f",
				},
				{
					description: "SHA-1 hash",
					input: {},
					rule: { hash: ["SHA-1", "Hello, World!"] },
					output: "0a0a9f2a6772942557ab5355d76af442f8f65e01",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers hmac.
 *
 * @returns The result produced by `registerHmac`.
 *
 * @example
 * registerHmac();
 */

export function registerHmac(operatorRegistry: OperatorRegistry) {
	defineAsyncOperator<[string, string, string], string>("hmac", {
		handler: async ([algorithm, key, message]) => {
			const validAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

			if (!validAlgorithms.includes(algorithm)) {
				throw new Error(
					`Unsupported HMAC algorithm: ${algorithm}. Supported: ${validAlgorithms.join(", ")}`,
				);
			}

			const encoder = new TextEncoder();
			const keyData = encoder.encode(key);
			const messageData = encoder.encode(message);

			const cryptoKey = await crypto.subtle.importKey(
				"raw",
				keyData,
				{ name: "HMAC", hash: algorithm },
				false,
				["sign"],
			);

			const signature = await crypto.subtle.sign(
				"HMAC",
				cryptoKey,
				messageData,
			);
			const signatureArray = Array.from(new Uint8Array(signature));
			const signatureHex = signatureArray
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");
			return signatureHex;
		},
		inputSchema: z.tuple([z.string(), z.string(), z.string()]),
		outputSchema: z.string(),
		eager: true,
		metadata: {
			name: "hmac",
			title: "HMAC",
			description:
				"Compute HMAC signature of a message using specified algorithm and key",
			category: "crypto",
			tags: ["crypto", "hmac", "security", "async"],
			examples: [
				{
					description: "HMAC-SHA256 signature",
					input: {},
					rule: { hmac: ["SHA-256", "key", "data"] },
					output:
						"5031fe3d989c6d1537a013fa6e739da23463fdaec3b70137d828e36ace221bd0",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers uuid generate.
 *
 * @returns The result produced by `registerUuidGenerate`.
 *
 * @example
 * registerUuidGenerate();
 */

export function registerUuidGenerate(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[], string>("uuid_generate", {
		handler: () => {
			return crypto.randomUUID();
		},
		inputSchema: z.tuple([]),
		outputSchema: z.string(),
		metadata: {
			name: "uuid_generate",
			title: "Generate UUID",
			description: "Generate a random UUID v4",
			category: "crypto",
			tags: ["crypto", "uuid", "identifier"],
			examples: [
				{
					description: "Generate UUID",
					input: {},
					rule: { uuid_generate: [] },
					output:
						/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers uuid validate.
 *
 * @returns The result produced by `registerUuidValidate`.
 *
 * @example
 * registerUuidValidate();
 */

export function registerUuidValidate(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], boolean>("uuid_validate", {
		handler: ([uuid]) => {
			const str = String(uuid ?? "");
			const uuidRegex =
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			return uuidRegex.test(str);
		},
		inputSchema: z.tuple([z.string()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "uuid_validate",
			title: "Validate UUID",
			description: "Validate if a string is a valid UUID v4 format",
			category: "crypto",
			tags: ["crypto", "uuid", "validation"],
			examples: [
				{
					description: "Valid UUID",
					input: {},
					rule: { uuid_validate: ["550e8400-e29b-41d4-a716-446655440000"] },
					output: true,
				},
				{
					description: "Invalid UUID",
					input: {},
					rule: { uuid_validate: ["not-a-uuid"] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers base64 encode.
 *
 * @returns The result produced by `registerBase64Encode`.
 *
 * @example
 * registerBase64Encode();
 */

export function registerBase64Encode(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], string>("base64_encode", {
		handler: ([value]) => {
			const str = String(value ?? "");
			return btoa(str);
		},
		inputSchema: z.tuple([z.string()]),
		outputSchema: z.string(),
		metadata: {
			name: "base64_encode",
			title: "Base64 Encode",
			description: "Encode a string to Base64",
			category: "crypto",
			tags: ["crypto", "base64", "encoding"],
			examples: [
				{
					description: "Encode string",
					input: {},
					rule: { base64_encode: ["Hello, World!"] },
					output: "SGVsbG8sIFdvcmxkIQ==",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers base64 decode.
 *
 * @returns The result produced by `registerBase64Decode`.
 *
 * @example
 * registerBase64Decode();
 */

export function registerBase64Decode(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], string>("base64_decode", {
		handler: ([value]) => {
			const str = String(value ?? "");
			try {
				return atob(str);
			} catch {
				throw new Error(`Invalid Base64 string: ${str}`);
			}
		},
		inputSchema: z.tuple([z.string()]),
		outputSchema: z.string(),
		metadata: {
			name: "base64_decode",
			title: "Base64 Decode",
			description: "Decode a Base64 string",
			category: "crypto",
			tags: ["crypto", "base64", "decoding"],
			examples: [
				{
					description: "Decode Base64",
					input: {},
					rule: { base64_decode: ["SGVsbG8sIFdvcmxkIQ=="] },
					output: "Hello, World!",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
