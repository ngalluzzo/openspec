import { beforeEach } from "bun:test";
import { clearRegistry } from "@gooi/expresso-core";

import { verifyPlugin } from "@gooi/expresso-std/testing/verify-plugin";
import cryptoPlugin from "./plugin";

// Ensure clean registry before tests
beforeEach(() => {
	clearRegistry();
});

verifyPlugin(cryptoPlugin);
