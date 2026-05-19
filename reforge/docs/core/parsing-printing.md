---
outline: [2, 3]
---

# Parsing & Printing

The core workflow: parse source into an AST, mutate it, print it back — with formatting preserved.

## Parsing

### parse()

The main entry point. Takes source code and a parser adapter, returns a `ParseResult`:

```ts
import { parse } from "@reforge/core"
import { tsAdapter } from "@reforge/adapters/typescript"

const result = parse(source, { adapter: tsAdapter })
// result.node is the root AST node
```

The shadow-copy index records every node's original source slice. You never need to manage this — it happens automatically during parsing.

### snippet()

Parse a standalone code expression without surrounding context:

```ts
const node = snippet("foo()", { adapter: tsAdapter })
// Returns the CallExpression, not an ExpressionStatement
```

Useful for generating replacement nodes programmatically.

## Printing

### print()

Reprints the AST back to source code. Unmodified subtrees are emitted verbatim from the original source:

```ts
import { print } from "@reforge/core"

const output = print(result)
// output.source contains the transformed code
```

### How Format Preservation Works

1. During parsing, each AST node is associated with its original source slice via a `WeakMap`
2. During printing, reforge walks the tree and compares each node to its original form
3. If a node is unchanged, its source slice is copied directly from the original
4. If a node changed, it's reprinted using the adapter's `print()` method
5. Gaps (whitespace, comments between nodes) are handled by the gap override system

This means your indentation, line breaks, and comment placement survive intact — unless you explicitly change them.

## Source Maps

`print()` returns a source map that maps positions in the output back to positions in the original source:

```ts
const { source, map } = print(result)
// map maps output positions → original positions
```

This is useful for editor integrations and error reporting.

## Error Handling

If a node can't be printed (e.g., a built node without source location), reforge throws `ReforgeNoPrinterError`:

```ts
class ReforgeNoPrinterError extends Error {
  constructor(message: string, public node: any) {
    super(message)
  }
}
```

## Next Steps

- [Adapters](/core/adapters) — Learn about the ParserAdapter interface and writing custom adapters
- [Comments & Gaps](/core/comments-gaps) — Manage whitespace and comments
