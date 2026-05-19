import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";
import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import { init } from "../runtime/bootstrap/init";
import { apply } from "../runtime/compile/apply";

describe("Validation Plugin", () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	describe("Type checking operators", () => {
		test("is_null should identify null values", () => {
			expect(apply({ is_null: [null] }, {})).toBe(true);
			expect(apply({ is_null: [0] }, {})).toBe(false);
			expect(apply({ is_null: [""] }, {})).toBe(false);
		});

		test("is_nil should identify null and undefined", () => {
			expect(apply({ is_nil: [null] }, {})).toBe(true);
			expect(apply({ is_nil: [0] }, {})).toBe(false);
			expect(apply({ is_nil: [""] }, {})).toBe(false);
		});

		test("is_number should include NaN", () => {
			expect(apply({ is_number: [42] }, {})).toBe(true);
			expect(apply({ is_number: [NaN] }, {})).toBe(true);
			expect(apply({ is_number: ["42"] }, {})).toBe(false);
		});

		test("is_finite_number should exclude NaN", () => {
			expect(apply({ is_finite_number: [42] }, {})).toBe(true);
			expect(apply({ is_finite_number: [NaN] }, {})).toBe(false);
			expect(apply({ is_finite_number: [Infinity] }, {})).toBe(false);
		});
	});

	describe("Format validation operators", () => {
		test("is_email should validate email format", () => {
			expect(apply({ is_email: ["user@example.com"] }, {})).toBe(true);
			expect(apply({ is_email: ["user@mail.example.com"] }, {})).toBe(true);
			expect(apply({ is_email: ["invalid-email"] }, {})).toBe(false);
		});

		test("is_url should validate URL format", () => {
			expect(apply({ is_url: ["https://example.com"] }, {})).toBe(true);
			expect(apply({ is_url: ["http://example.com/path"] }, {})).toBe(true);
			expect(apply({ is_url: ["example.com"] }, {})).toBe(false);
		});

		test("is_uuid should validate UUID v4 format", () => {
			expect(
				apply({ is_uuid: ["550e8400-e29b-41d4-a716-446655440000"] }, {}),
			).toBe(true);
			expect(apply({ is_uuid: ["not-uuid"] }, {})).toBe(false);
			expect(
				apply({ is_uuid: ["550E8400-E29B-41D4-A716-446655440000"] }, {}),
			).toBe(false);
		});
	});

	describe("Range validation operators", () => {
		test("min_length should check string/array minimum length", () => {
			expect(apply({ min_length: ["hello world", 5] }, {})).toBe(true);
			expect(apply({ min_length: ["abc", 5] }, {})).toBe(false);
			expect(apply({ min_length: [[1, 2, 3, 4, 5], 3] }, {})).toBe(true);
		});

		test("max_length should check string/array maximum length", () => {
			expect(apply({ max_length: ["hello", 10] }, {})).toBe(true);
			expect(apply({ max_length: ["very long string", 5] }, {})).toBe(false);
			expect(apply({ max_length: [[1, 2, 3], 5] }, {})).toBe(true);
		});

		test("range should check number is within range", () => {
			expect(apply({ range: [5, 1, 10] }, {})).toBe(true);
			expect(apply({ range: [0, 1, 10] }, {})).toBe(false);
			expect(apply({ range: [15, 1, 10] }, {})).toBe(false);
			expect(apply({ range: [10, 1, 10] }, {})).toBe(true);
		});

		test("equals_length should check exact length", () => {
			expect(apply({ equals_length: ["hello", 5] }, {})).toBe(true);
			expect(apply({ equals_length: ["world", 3] }, {})).toBe(false);
			expect(apply({ equals_length: [[1, 2, 3], 3] }, {})).toBe(true);
		});

		test("between_length should check length is in range", () => {
			expect(apply({ between_length: ["hello", 3, 6] }, {})).toBe(true);
			expect(apply({ between_length: ["hi", 3, 6] }, {})).toBe(false);
			expect(apply({ between_length: [[1, 2, 3, 4], 2, 5] }, {})).toBe(true);
		});
	});
});
