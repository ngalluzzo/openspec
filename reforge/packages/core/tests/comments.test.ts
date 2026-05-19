import { describe, expect, it } from "bun:test";
import {
	applyCommentOverrides,
	findJsdoc,
	parseGapComments,
	parseTrailingComment,
	prependCommentToGap,
	replaceCommentInGap,
	stripCommentsFromGap,
} from "../src/comments.js";

function first<T>(arr: T[]): T {
	if (arr.length === 0) throw new Error("array is empty");
	const item = arr[0];
	if (item == null) throw new Error("array element is null");
	return item;
}

// ─── parseGapComments ─────────────────────────────────────────────────────────

describe("parseGapComments", () => {
	it("returns empty array for gap with no comments", () => {
		expect(parseGapComments("\n  ")).toEqual([]);
		expect(parseGapComments("")).toEqual([]);
		expect(parseGapComments("   ")).toEqual([]);
	});

	it("parses a single line comment", () => {
		const gap = "// hello world\n";
		const comments = parseGapComments(gap);
		expect(comments).toHaveLength(1);
		const c = first(comments);
		expect(c.kind).toBe("line");
		expect(c.text).toBe("hello world");
		expect(c.raw).toBe("// hello world");
		expect(c.start).toBe(0);
		expect(c.end).toBe(14);
	});

	it("parses a line comment with leading whitespace in gap", () => {
		const gap = "\n  // leading\n";
		const comments = parseGapComments(gap);
		expect(comments).toHaveLength(1);
		const c = first(comments);
		expect(c.kind).toBe("line");
		expect(c.text).toBe("leading");
		expect(c.start).toBe(3); // after \n + 2 spaces
	});

	it("parses a single block comment", () => {
		const gap = "\n/* a block comment */\n";
		const comments = parseGapComments(gap);
		expect(comments).toHaveLength(1);
		const c = first(comments);
		expect(c.kind).toBe("block");
		expect(c.text).toBe("a block comment");
		expect(c.raw).toBe("/* a block comment */");
	});

	it("parses a JSDoc block comment", () => {
		const gap = "\n/**\n * @param x the value\n * @returns something\n */\n";
		const comments = parseGapComments(gap);
		expect(comments).toHaveLength(1);
		const c = first(comments);
		expect(c.kind).toBe("block");
		expect(c.raw).toContain("/**");
		expect(c.text).toContain("@param x the value");
		expect(c.text).toContain("@returns something");
	});

	it("parses multiple comments in one gap", () => {
		const gap = "// first\n// second\n// third\n";
		const comments = parseGapComments(gap);
		expect(comments).toHaveLength(3);
		expect(comments.map((c) => c?.text)).toEqual(["first", "second", "third"]);
	});

	it("parses mixed line and block comments", () => {
		const gap = "// line one\n/* block */\n// line two\n";
		const comments = parseGapComments(gap);
		expect(comments).toHaveLength(3);
		expect(comments[0]?.kind).toBe("line");
		expect(comments[1]?.kind).toBe("block");
		expect(comments[2]?.kind).toBe("line");
	});

	it("applies baseOffset to positions", () => {
		const gap = "// comment\n";
		const comments = parseGapComments(gap, 100);
		expect(comments).toHaveLength(1);
		const c = first(comments);
		expect(c.start).toBe(100);
		expect(c.end).toBe(110);
	});

	it("handles block comment spanning multiple lines", () => {
		const gap = "\n/*\n * line one\n * line two\n */\n";
		const comments = parseGapComments(gap);
		expect(comments).toHaveLength(1);
		const c = first(comments);
		expect(c.kind).toBe("block");
		expect(c.text).toContain("line one");
		expect(c.text).toContain("line two");
	});

	it("ignores a lone / that is not a comment", () => {
		const gap = "\n  a / b\n";
		expect(parseGapComments(gap)).toHaveLength(0);
	});

	it("handles gap ending without newline after line comment", () => {
		const gap = "// no newline";
		const comments = parseGapComments(gap);
		expect(comments).toHaveLength(1);
		const c = first(comments);
		expect(c.kind).toBe("line");
		expect(c.text).toBe("no newline");
		expect(c.end).toBe(13);
	});
});

// ─── parseTrailingComment ─────────────────────────────────────────────────────

describe("parseTrailingComment", () => {
	it("returns null when no comment on same line", () => {
		expect(parseTrailingComment("\n  next")).toBeNull();
		expect(parseTrailingComment("  \n")).toBeNull();
	});

	it("parses a trailing line comment", () => {
		const c = parseTrailingComment(" // inline comment\n  next");
		expect(c).not.toBeNull();
		expect(c?.kind).toBe("line");
		expect(c?.text).toBe("inline comment");
	});

	it("ignores content on subsequent lines", () => {
		const c = parseTrailingComment(" // first\n// second\n");
		expect(c?.text).toBe("first");
	});

	it("returns null for only whitespace on same line", () => {
		expect(parseTrailingComment("   \nnext")).toBeNull();
	});

	it("applies baseOffset", () => {
		const c = parseTrailingComment(" // hi\n", 50);
		expect(c?.start).toBe(51); // 50 + 1 space
	});
});

// ─── findJsdoc ────────────────────────────────────────────────────────────────

describe("findJsdoc", () => {
	it("returns null for no comments", () => {
		expect(findJsdoc([])).toBeNull();
	});

	it("returns null when only line comments", () => {
		const comments = parseGapComments("// not jsdoc\n");
		expect(findJsdoc(comments)).toBeNull();
	});

	it("returns null for regular block comment", () => {
		const comments = parseGapComments("/* not jsdoc */\n");
		expect(findJsdoc(comments)).toBeNull();
	});

	it("returns JSDoc block comment (starts with /**)", () => {
		const comments = parseGapComments("/** @param x foo */\n");
		const jsdoc = findJsdoc(comments);
		expect(jsdoc).not.toBeNull();
		expect(jsdoc?.kind).toBe("block");
		expect(jsdoc?.raw).toMatch(/^\/\*\*/);
	});

	it("returns last JSDoc when multiple block comments", () => {
		const comments = parseGapComments("/** first */\n/** second */\n");
		const jsdoc = findJsdoc(comments);
		expect(jsdoc?.text).toBe("second");
	});

	it("ignores non-JSDoc block before JSDoc", () => {
		const comments = parseGapComments("/* note */\n/** @returns x */\n");
		const jsdoc = findJsdoc(comments);
		expect(jsdoc?.raw).toContain("@returns");
	});
});

// ─── prependCommentToGap ──────────────────────────────────────────────────────

describe("prependCommentToGap", () => {
	it("prepends line comment before gap", () => {
		expect(prependCommentToGap("\n  ", "// new comment")).toBe(
			"// new comment\n  ",
		);
	});

	it("prepends block comment before gap", () => {
		expect(prependCommentToGap("\n  ", "/** @deprecated */")).toBe(
			"/** @deprecated */\n  ",
		);
	});

	it("strips leading whitespace from gap to avoid double indentation", () => {
		expect(prependCommentToGap("  \n  ", "// hello")).toBe("// hello\n  ");
	});

	it("trims trailing newline from comment text", () => {
		expect(prependCommentToGap("\n", "// comment\n\n")).toBe("// comment\n");
	});
});

// ─── stripCommentsFromGap ─────────────────────────────────────────────────────

describe("stripCommentsFromGap", () => {
	it("removes all comments when no predicate", () => {
		const gap = "\n// first\n// second\n  ";
		const result = stripCommentsFromGap(gap);
		expect(result).not.toContain("//");
		expect(result).toContain("  "); // indent preserved
	});

	it("removes only matching comments with predicate", () => {
		const gap = "\n// keep\n// DEBUG: remove\n  ";
		const result = stripCommentsFromGap(gap, (c) => c.text.includes("DEBUG"));
		expect(result).toContain("// keep");
		expect(result).not.toContain("DEBUG");
	});

	it("no-op when no comments match predicate", () => {
		const gap = "\n// keep this\n  ";
		const result = stripCommentsFromGap(gap, (c) => c.text.includes("NOPE"));
		expect(result).toBe(gap);
	});

	it("no-op on gap with no comments", () => {
		const gap = "\n  ";
		expect(stripCommentsFromGap(gap)).toBe(gap);
	});

	it("removes block comments", () => {
		const gap = "\n/* remove me */\n  code";
		const result = stripCommentsFromGap(gap);
		expect(result).not.toContain("/*");
		expect(result).toContain("code");
	});

	it("strips the newline after a removed line comment", () => {
		const gap = "// comment\n  ";
		const result = stripCommentsFromGap(gap);
		expect(result).toBe("  "); // newline consumed with comment
	});
});

// ─── replaceCommentInGap ─────────────────────────────────────────────────────

describe("replaceCommentInGap", () => {
	it("replaces a matching line comment", () => {
		const gap = "\n// @param oldName description\n  ";
		const result = replaceCommentInGap(
			gap,
			(c) => c.text.includes("oldName"),
			"// @param newName description",
		);
		expect(result).toContain("// @param newName description");
		expect(result).not.toContain("oldName");
	});

	it("no-op when no comment matches", () => {
		const gap = "\n// unrelated\n";
		const result = replaceCommentInGap(
			gap,
			(c) => c.text.includes("NOPE"),
			"// x",
		);
		expect(result).toBe(gap);
	});

	it("replaces only the first matching comment", () => {
		const gap = "\n// old\n// old\n";
		const result = replaceCommentInGap(gap, (c) => c.text === "old", "// new");
		const count = (result.match(/\/\/ new/g) ?? []).length;
		expect(count).toBe(1);
		expect(result).toContain("// old"); // second one untouched
	});

	it("replaces a JSDoc comment", () => {
		const gap = "\n/** @deprecated use foo */\n  ";
		const result = replaceCommentInGap(
			gap,
			(c) => c.text.includes("@deprecated"),
			"/** @deprecated use bar */",
		);
		expect(result).toContain("use bar");
		expect(result).not.toContain("use foo");
	});
});

// ─── applyCommentOverrides ────────────────────────────────────────────────────

describe("applyCommentOverrides", () => {
	it("applies prependComment", () => {
		const result = applyCommentOverrides("\n  ", {
			prependComment: "// generated",
		});
		expect(result).toBe("// generated\n  ");
	});

	it("applies stripAllLeadingComments", () => {
		const gap = "\n// remove me\n  ";
		const result = applyCommentOverrides(gap, {
			stripAllLeadingComments: true,
		});
		expect(result).not.toContain("//");
	});

	it("applies selective stripLeadingComments", () => {
		const gap = "\n// keep\n// DEBUG\n  ";
		const result = applyCommentOverrides(gap, {
			stripLeadingComments: (c) => c.text.includes("DEBUG"),
		});
		expect(result).toContain("// keep");
		expect(result).not.toContain("DEBUG");
	});

	it("applies replaceLeadingComment", () => {
		const gap = "\n// @param old value\n  ";
		const result = applyCommentOverrides(gap, {
			replaceLeadingComment: {
				match: (c) => c.text.includes("old"),
				replacement: "// @param new value",
			},
		});
		expect(result).toContain("new value");
		expect(result).not.toContain("old");
	});

	it("applies strip then prepend in correct order", () => {
		// Strip old comments, then prepend new one
		const gap = "\n// old comment\n  ";
		const result = applyCommentOverrides(gap, {
			stripAllLeadingComments: true,
			prependComment: "// new comment",
		});
		expect(result).not.toContain("old");
		expect(result).toContain("// new comment");
	});

	it("no-op on empty override object", () => {
		const gap = "\n// keep me\n  ";
		expect(applyCommentOverrides(gap, {})).toBe(gap);
	});
});
