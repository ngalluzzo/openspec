---
outline: [2, 3]
---

# Custom Adapters

Write a parser adapter for any language or AST format.

## The ParserAdapter Interface

Every adapter implements this contract:

```ts
interface ParserAdapter<TNode> {
  language: string
  parse(source: string, options?): TNode
  parseSnippet(source: string, options?): TNode
  walk(root: TNode, visitor: NodeVisitor<TNode>): void
  locate(node: TNode): SourceLocation | null
  typeOf(node: TNode): string
  print?(node: TNode): string
}
```

## Step-by-Step Example: Babel Adapter

### 1. Define the adapter structure

```ts
import type { ParserAdapter, NodeVisitor, SourceLocation } from "@reforge/core"
import type { Node as BabelNode } from "@babel/types"

interface BabelParseOptions {
  sourceType?: "module" | "script" | "unambiguous"
}
```

### 2. Implement parse()

```ts
import * as babelParser from "@babel/parser"

const parse: ParserAdapter<BabelNode>["parse"] = (source, options?) => {
  return babelParser.parse(source, {
    sourceType: "module",
    allowReturnOutsideFunction: true,
    ...options,
  })
}
```

### 3. Implement parseSnippet()

```ts
const parseSnippet: ParserAdapter<BabelNode>["parseSnippet"] = (source) => {
  const ast = babelParser.parseExpression(source)
  return ast
}
```

### 4. Implement walk()

```ts
const walk: ParserAdapter<BabelNode>["walk"] = (root, visitor) => {
  function visit(node: BabelNode, parent: BabelNode | null, key: string | null): void {
    const ctrl = visitor.enter?.(node, parent, key)
    if (ctrl === "stop") return
    if (ctrl !== "skip" && node.type) {
      const fields = (babelParser).default?.visitors?.generators?.[node.type]
      // Use @babel/traverse for robust walking
    }
    visitor.leave?.(node, parent, key)
  }
  visit(root as BabelNode, null, null)
}
```

### 5. Implement locate()

```ts
const locate: ParserAdapter<BabelNode>["locate"] = (node) => {
  if (!node.start || !node.end) return null

  const lines = node.loc?.start ? node.loc.start.line : 1
  const columns = node.loc?.start ? node.loc.start.column : 0

  return {
    start: { offset: node.start, line: lines, column: columns },
    end: {
      offset: node.end,
      line: node.loc?.end?.line ?? lines,
      column: node.loc?.end?.column ?? columns,
    },
  }
}
```

### 6. Implement typeOf()

```ts
const typeOf: ParserAdapter<BabelNode>["typeOf"] = (node) => {
  return node.type
}
```

### 7. Implement print() (optional but recommended)

```ts
import * as babelGenerator from "@babel/generator"

const print: ParserAdapter<BabelNode>["print"] = (node) => {
  const { code } = babelGenerator.default(node)
  return code
}
```

### 8. Assemble the adapter

```ts
export const babelAdapter: ParserAdapter<BabelNode> = {
  language: "babel",
  parse,
  parseSnippet,
  walk,
  locate,
  typeOf,
  print,
}
```

## Key Implementation Details

### Source Location Convention

Reforge uses a specific coordinate system:
- **offset**: 0-based byte offset from the start of the source
- **line**: 1-based line number (matches most editors)
- **column**: 0-based column offset

```ts
interface SourceLocation {
  start: { offset: number; line: number; column: number }
  end:   { offset: number; line: number; column: number }
}
```

### Walking the AST

The `walk()` method receives a visitor with `enter` and `leave` hooks:

```ts
walk(root, {
  enter(node, parent, key) {
    // Called before visiting children
    if (shouldSkip(node)) return "skip"  // Skip children
    if (shouldStop()) return "stop"      // Stop entire walk
  },
  leave(node, parent, key) {
    // Called after visiting children
  },
})
```

Return values from `enter()`:
- `"skip"` — Don't visit children of this node
- `"stop"` — Stop the entire walk immediately
- `undefined` / `void` — Continue normally

### The print() Method

The `print()` method is optional. If not provided, reforge can still print nodes that exist in the original source (via shadow-copy), but cannot reprint programmatically-built nodes.

Including `print()` enables:
- Inserting new nodes created via `snippet()`
- Replacing nodes with newly-built ASTs
- Full programmatic manipulation beyond simple property changes

### Registering the Adapter

```ts
import { babelAdapter } from "./babel-adapter"

codemod({
  include: ["src/**/*.js"],
  adapterFor(filePath) {
    if (filePath.endsWith(".js")) return babelAdapter
    return tsAdapter
  },
})
```

## Common Pitfalls

1. **Column offset convention** — PostCSS uses 1-based columns; reforge uses 0-based. Convert with `column - 1`.
2. **Source location accuracy** — Inaccurate locations cause incorrect source slices and broken format preservation.
3. **Walking order** — Ensure children are visited in the correct order (usually source order).
4. **Missing print()** — Without a printer, you can only mutate existing nodes, not insert new ones.
