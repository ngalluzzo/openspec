---
outline: [2, 3]
---

# Comments & Gaps

Manage comments and blank lines through reforge's gap override system.

## What Are Gaps?

In the shadow-copy model, "gaps" are the whitespace and comments between AST nodes. They're not part of any node — they live in the spaces between them.

```
type Foo = {
  // leading comment
  bar: string   // trailing comment
  
  baz: number
}
```

Each gap between nodes can contain:
- Whitespace (spaces, tabs, newlines)
- Leading comments (before a node)
- Trailing comments (after a node, before the next one)

## Gap Override Map

Instead of manipulating fake comment nodes in the AST, reforge uses a side-channel `GapOverrideMap` (backed by a `WeakMap`) to manage gaps:

```ts
import { createGapOverrideMap } from "@reforge/core"

const gapOverrides = createGapOverrideMap()
```

Pass this map to `print()` and it will apply your overrides when reprinting:

```ts
const output = print(result, { gapOverrides })
```

## Setting Blank Lines

Control leading newlines before a node:

```ts
import { setLeadingNewlines, applyGapOverride } from "@reforge/core"

// Ensure 2 blank lines before a node
gapOverrides.set(path.node, {
  leading: setLeadingNewlines(2),
})
```

## Comment Operations

The comments module provides utilities for reading and manipulating comments in gaps:

### Reading Comments

```ts
import { parseGapComments, findJsdoc } from "@reforge/core"

// Parse comments from a gap string
const comments = parseGapComments(gapText, baseOffset)

// Find JSDoc comment among a list of comments
const jsdoc = findJsdoc(comments)
```

### Writing Comments

```ts
import {
  prependCommentToGap,
  stripCommentsFromGap,
  replaceCommentInGap,
} from "@reforge/core"

// Prepend a comment to a gap
gapText = prependCommentToGap(gapText, "// New comment")

// Strip all comments from a gap
gapText = stripCommentsFromGap(gapText)

// Replace a specific comment
gapText = replaceCommentInGap(
  gapText,
  (c) => c.text.includes("old"),
  "// New comment text"
)
```

### Applying Overrides to Gaps

```ts
import { applyCommentOverrides, applyGapOverride } from "@reforge/core"

gapText = applyCommentOverrides(gapText, overrides, baseOffset)
gapText = applyGapOverride(gapText, gapOverrides, "leading")
```

## Path API Integration

The `Path` object in `@reforge/transform` provides a convenient interface for comment and blank-line management:

```ts
query.find("FunctionDeclaration").mutate((path) => {
  // Add a leading comment
  path.addLeadingComment("// TODO: refactor")

  // Remove all leading comments
  path.removeLeadingComments()

  // Ensure blank line before this node
  path.ensureBlankLineBefore()

  // Set exactly 2 blank lines after this node
  path.setBlankLinesAfter(2)

  // Read comments on a node
  const leading = path.leadingComments()
  const trailing = path.trailingComments()
  const jsdoc = path.jsdoc()
})
```

## ASI Safety

After printing, reforge runs a post-pass to detect and patch Automatic Semicolon Insertion hazards:

```ts
import { isAsiHazard, patchGap } from "@reforge/core"

// Check if a gap between two slices creates an ASI hazard
if (isAsiHazard(prevSlice, nextSlice)) {
  const safeGap = patchGap(gap)
}
```

Common ASI hazards:
- `foo\n(bar)` → becomes `foo(bar)` (function call instead of addition)
- `a\n[b]` → becomes `a[b]` (property access instead of array indexing)

Reforge patches these automatically during printing.
