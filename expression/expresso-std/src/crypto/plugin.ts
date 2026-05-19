import type { Plugin } from "@gooi/expresso-core";

import {
	registerBase64Decode,
	registerBase64Encode,
	registerHash,
	registerHmac,
	registerUuidGenerate,
	registerUuidValidate,
} from "./operators";

const cryptoPlugin: Plugin = {
	name: "@std/crypto",
	version: "1.0.0",
	description: "Standard crypto operators for Expresso",
	category: "crypto",
	operators: [
		"hash",
		"hmac",
		"uuid_generate",
		"uuid_validate",
		"base64_encode",
		"base64_decode",
	],

	register({ operatorRegistry }) {
		registerHash(operatorRegistry);
		registerHmac(operatorRegistry);
		registerUuidGenerate(operatorRegistry);
		registerUuidValidate(operatorRegistry);
		registerBase64Encode(operatorRegistry);
		registerBase64Decode(operatorRegistry);
	},

	unregister() {
		// Unregister all operators when plugin is unloaded
		// This requires the registry to support unregistration
	},
};

export default cryptoPlugin;
